import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import moment from "moment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const date = searchParams.get("date");
    const slotIdParam = searchParams.get("slotId");
    const subjectIdParam = searchParams.get("subjectId"); // For backward compatibility

    if (teacherId && teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }


    if (!classId) {
      return new NextResponse("Missing classId", { status: 400 });
    }

    let today = new Date();
    let dayStart, dayEnd;
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        dayStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        dayEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]) + 1);
        // For backwards compatibility in other parts of the file
        today = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      } else {
        today = new Date(date);
        today.setUTCHours(0, 0, 0, 0);
        dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      }
    } else {
      today = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
      const now = new Date();
      dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    }

    // Identify the specific lesson context for this teacher and class
    const dayName = moment(date || new Date()).format('dddd').toUpperCase();
    const [lessons, allTimetableSlots, teacherTimetableSlots] = await Promise.all([
      prisma.lesson.findMany({
        where: {
          classId: parseInt(classId),
          day: dayName as any
        }
      }),
      prisma.timetableSlot.findMany({ // Get all slots for mapping to match admin API exactly
        where: {
          classId: parseInt(classId),
          day: dayName as any,
          isDraft: false
        },
        include: { subject: true },
        orderBy: { slotNumber: "asc" }
      }),
      prisma.timetableSlot.findMany({ // Get only teacher's slots for UI
        where: {
          classId: parseInt(classId),
          OR: [
            { teacherId: teacherId || undefined },
            { teacherId: null }
          ],
          day: dayName as any,
          isDraft: false
        },
        include: { subject: true },
        orderBy: { slotNumber: "asc" }
      })
    ]);

    const activeSlotId = slotIdParam;

    if (!teacherTimetableSlots.length) {
      const classStudents = await prisma.student.findMany({
        where: { classId: parseInt(classId) },
        orderBy: { name: "asc" }
      });
      return NextResponse.json({
        students: classStudents.map(s => ({
          id: s.id,
          name: s.name,
          surname: s.surname,
          img: s.img,
          attendanceStatus: null,
          note: "",
          score: 0
        })),
        assignments: [],
        resources: [],
        hasLesson: false,
        lessonId: null,
        sessions: [],
        activeSlotId: null,
        message: "No sessions found for this class today."
      });
    }

    // Build the sessions array for the UI to render the pills
    const sessions = teacherTimetableSlots.map((slot) => ({
      slotId: slot.id,
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name || "Session",
      startTime: slot.startTime,
      endTime: slot.endTime
    }));

    const activeSlot = activeSlotId 
      ? teacherTimetableSlots.find(s => s.id === parseInt(activeSlotId))
      : teacherTimetableSlots[0];

    if (!activeSlot) {
      return NextResponse.json({ error: "Active slot not found" }, { status: 404 });
    }

    // Use the active slot to figure out which lesson to match
    let lesson = null;
    if (activeSlot) {
      // Get all slots for this subject (across all teachers) to ensure mapping aligns exactly with Admin API
      const subjectSlots = allTimetableSlots.filter(s => s.subjectId === activeSlot.subjectId);
      const slotIndex = subjectSlots.findIndex(s => s.id === activeSlot.id);
      
      // Match lesson exactly like the Admin API does to ensure 100% sync
      const expectedName = `${activeSlot.subject?.name || "Session"} - ${activeSlot.startTime}`;
      let matchedLesson = lessons.find((l) => l.subjectId === activeSlot.subjectId && l.name === expectedName) || null;
      
      if (!matchedLesson) {
        const usedLegacyLessonIds = new Set<number>();
        // Replicate Admin API fallback logic by walking through slots in order
        for (const s of subjectSlots) {
           const sExpectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
           let currentMatch = lessons.find((l) => l.subjectId === s.subjectId && l.name === sExpectedName);
           
           if (!currentMatch) {
             const legacyLesson = lessons.find((l) => l.subjectId === s.subjectId && l.name === (s.subject?.name || "Session") && !usedLegacyLessonIds.has(l.id));
             if (legacyLesson) {
               currentMatch = legacyLesson;
               usedLegacyLessonIds.add(legacyLesson.id);
             }
           }
           
           if (!currentMatch) {
             const anyLesson = lessons.find((l) => l.subjectId === s.subjectId && !usedLegacyLessonIds.has(l.id));
             if (anyLesson) {
               currentMatch = anyLesson;
               usedLegacyLessonIds.add(anyLesson.id);
             }
           }
           
           if (s.id === activeSlot.id) {
             matchedLesson = currentMatch || null;
             break;
           }
        }
      }
      
      lesson = matchedLesson;
    } else if (lessons.length > 0) {
      lesson = lessons[0];
    }
    
    const lessonId = lesson?.id || null;
    const hasLesson = lessons.length > 0 || allTimetableSlots.length > 0;
    const activeSlotIdToReturn = activeSlot?.id || null;

    const students = await prisma.student.findMany({
      where: { classId: parseInt(classId) },
      include: {
        attendance: {
          where: {
            date: { gte: dayStart, lt: dayEnd },
            lessonId: lessonId ? lessonId : null // Force strict match on null so it doesn't fallback to picking up attendance from the first session
          },
          orderBy: { id: "desc" },
          take: 1,
        }
      },
      orderBy: { name: "asc" }
    });

    // Fetch assignments and resources for this class and date
    // Use the date string directly for moment to avoid timezone shifting issues with new Date()

    if (dayName === "SUNDAY") {
      return NextResponse.json({
        students: students.map(s => ({
          id: s.id,
          name: s.name,
          surname: s.surname,
          img: s.img,
          attendanceStatus: s.attendance[0]?.status || null
        })),
        assignments: [],
        resources: [],
        hasLesson: false
      });
    }
    
    const [assignments, resources] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          lesson: { classId: parseInt(classId) },
          dueDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.resource.findMany({
        where: {
          lesson: { classId: parseInt(classId), day: dayName as any }
        }
      })
    ]);

    const studentData = students.map(s => {
      const att = s.attendance[0];
      let displayNote = att?.note || "";
      // If it's a JSON string, try to extract the first text
      if (displayNote.startsWith("[")) {
        try {
          const parsed = JSON.parse(displayNote);
          displayNote = parsed[0]?.text || "";
        } catch (e) {}
      }

      return {
        id: s.id,
        name: s.name,
        surname: s.surname,
        img: s.img,
        attendanceStatus: att?.status || null,
        note: displayNote,
        score: att?.score || 0
      };
    });

    return NextResponse.json({
      students: studentData,
      assignments,
      resources,
      hasLesson,
      lessonId,
      sessions,
      activeSlotId: activeSlotIdToReturn
    });
  } catch (error: any) {
    console.error("[Teacher Students API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
