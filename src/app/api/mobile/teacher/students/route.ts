import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { parseSchoolDay } from "@/lib/schoolDay";

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


    if (!classId || !/^\d+$/.test(classId) || !Number.isSafeInteger(Number(classId)) || Number(classId) < 1) {
      return NextResponse.json({ error: "Invalid classId" }, { status: 400 });
    }
    const selectedDay = parseSchoolDay(date);
    if (!selectedDay) return NextResponse.json({ error: "Invalid date. Use YYYY-MM-DD." }, { status: 400 });
    const { date: today, start: dayStart, end: dayEnd, day: dayName } = selectedDay;
    const schoolClass = await prisma.class.findFirst({ where: { id: Number(classId), schoolId }, select: { id: true } });
    if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });

    // Sunday has no database Day enum value. Reuse the empty-session response below.
    const [lessons, allTimetableSlots] = dayName ? await Promise.all([
      prisma.lesson.findMany({
        where: {
          classId: parseInt(classId), schoolId,
          day: dayName
        }
      }),
      prisma.timetableSlot.findMany({ // Get all slots for mapping to match admin API exactly
        where: {
          classId: parseInt(classId), schoolId,
          day: dayName,
          isDraft: false
        },
        include: { subject: true },
        orderBy: { slotNumber: "asc" }
      })
    ]) : [[], []];
    const teacherTimetableSlots = allTimetableSlots.filter(slot => slot.teacherId === userId || slot.teacherId === null);

    const activeSlotId = slotIdParam;

    if (!dayName || !teacherTimetableSlots.length) {
      const classStudents = await prisma.student.findMany({
        where: { classId: parseInt(classId), schoolId },
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
      where: { classId: parseInt(classId), schoolId },
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

    const [assignments, resources] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          lesson: { classId: parseInt(classId), schoolId },
          dueDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.resource.findMany({
        where: {
          lesson: { classId: parseInt(classId), schoolId, day: dayName }
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
    return new NextResponse(JSON.stringify({ error: "Unable to load the class. Please try again." }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
