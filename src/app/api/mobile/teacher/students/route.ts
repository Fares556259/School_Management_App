import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
    const date = searchParams.get("date");
    const subjectIdParam = searchParams.get("subjectId");

    if (!classId) {
      return new NextResponse("Missing classId", { status: 400 });
    }

    let today = new Date();
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        today = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      } else {
        today = new Date(date);
        today.setUTCHours(0, 0, 0, 0);
      }
    } else {
      today = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    }

    // Identify the specific lesson context for this teacher and class
    const dayName = moment(date || new Date()).format('dddd').toUpperCase();
    const [lessons, timetableSlots] = await Promise.all([
      prisma.lesson.findMany({
        where: {
          classId: parseInt(classId),
          teacherId: teacherId || undefined,
          day: dayName as any
        }
      }),
      prisma.timetableSlot.findMany({
        where: {
          classId: parseInt(classId),
          teacherId: teacherId || undefined,
          day: dayName as any,
          isDraft: false
        },
        include: { subject: true },
        orderBy: { slotNumber: "asc" }
      })
    ]);

    const parsedSubjectId = subjectIdParam ? parseInt(subjectIdParam) : null;

    // Build the sessions array for the UI to render the pills
    const sessions = timetableSlots.map(slot => ({
      slotId: slot.id,
      subjectId: slot.subjectId,
      subjectName: slot.subject?.name || "Session",
      startTime: slot.startTime,
      endTime: slot.endTime
    }));

    // Determine the active slot
    let activeSlot = timetableSlots[0] || null;
    if (parsedSubjectId) {
      activeSlot = timetableSlots.find(s => s.subjectId === parsedSubjectId) || timetableSlots[0];
    }
    
    // Use the active slot to figure out which lesson to match
    let lesson = null;
    if (activeSlot) {
      lesson = lessons.find(l => l.subjectId === activeSlot.subjectId) || null;
    } else if (lessons.length > 0) {
      lesson = lessons[0];
    }
    
    const lessonId = lesson?.id || null;
    const hasLesson = lessons.length > 0 || timetableSlots.length > 0;
    const activeSubjectId = activeSlot?.subjectId || null;

    const students = await prisma.student.findMany({
      where: { classId: parseInt(classId) },
      include: {
        attendance: {
          where: {
            date: today,
            lessonId: lessonId || undefined // Filter by specific lesson if known
          },
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
      activeSubjectId
    });
  } catch (error: any) {
    console.error("[Teacher Students API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
