import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// Map JS day number to Prisma Day enum
const DAY_MAP: Record<number, string> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    // Determine today's day
    let now = new Date();
    const dateStr = searchParams.get("date");
    if (dateStr) {
      // The app sends a day string like "25". We assume March 2026 for now as the app is hardcoded.
      now = new Date(2026, 2, parseInt(dateStr));
    }

    const dayNum = now.getDay(); // 0 = Sunday
    const todayEnum = DAY_MAP[dayNum];

    // If it's Sunday (0) or unknown, return empty
    if (!todayEnum) {
      return NextResponse.json({ sessions: [], assignments: [], todayAttendance: [] });
    }

    // Get the student's class
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // 1. Today's timetable slots
    const slots = await prisma.timetableSlot.findMany({
      where: {
        classId: student.classId,
        day: todayEnum as any,
      },
      include: {
        subject: true,
        teacher: true,
      },
      orderBy: { slotNumber: "asc" },
    });

    // 2. Attendance for today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const attendance = await prisma.attendance.findMany({
      where: {
        studentId,
        date: { gte: todayStart, lt: todayEnd },
      },
    });

    // 3. Today's lessons (for assignments)
    const todayLessons = await prisma.lesson.findMany({
      where: {
        classId: student.classId,
        day: todayEnum as any,
      },
      select: { id: true, subjectId: true, teacherId: true },
    });

    const lessonIds = todayLessons.map((l) => l.id);

    // 4. Assignments due today (tasks to submit)
    const tasksDue = await prisma.assignment.findMany({
      where: {
        lessonId: { in: lessonIds },
        dueDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        lesson: { include: { subject: true, teacher: true } },
      },
    });

    // 5. Assignments given today (tasks given)
    const tasksGiven = await prisma.assignment.findMany({
      where: {
        lessonId: { in: lessonIds },
        startDate: { gte: todayStart, lt: todayEnd },
      },
      include: {
        lesson: { include: { subject: true, teacher: true } },
      },
    });

    // 6. Upcoming exams (next 7 days)
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingExams = await prisma.exam.findMany({
      where: {
        lessonId: { in: lessonIds },
        startTime: { gte: todayStart, lt: weekEnd },
      },
      include: {
        lesson: { include: { subject: true, teacher: true } },
      },
      orderBy: { startTime: "asc" },
    });

    // 7. Recent teacher remarks (grade sheets with notes for this class)
    const teacherRemarks = await prisma.gradeSheet.findMany({
      where: {
        classId: student.classId,
        notes: { not: "" },
        updatedAt: {
          gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        },
      },
      include: {
        subject: true,
        teacher: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    });

    // Build session list with attendance status
    const sessions = slots.map((slot) => {
      // Match attendance by lessonId or fallback to first attendance of day
      const att = attendance.find((a) => a.lessonId === null) || attendance[0];
      return {
        id: slot.id,
        slotNumber: slot.slotNumber,
        subject: slot.subject?.name || "Free Period",
        teacher: slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : null,
        teacherImg: slot.teacher?.img || null,
        room: slot.room || "TBD",
        startTime: slot.startTime,
        endTime: slot.endTime,
        attendance: att?.status || null, // PRESENT | ABSENT | LATE | null (not marked yet)
      };
    });

    return NextResponse.json({
      sessions,
      tasksDue: tasksDue.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
      })),
      tasksGiven: tasksGiven.map((a) => ({
        id: a.id,
        title: a.title,
        subject: a.lesson.subject.name,
        teacher: `${a.lesson.teacher.name} ${a.lesson.teacher.surname}`,
        dueDate: a.dueDate,
      })),
      upcomingExams: upcomingExams.map((e) => ({
        id: e.id,
        title: e.title,
        subject: e.lesson.subject.name,
        teacher: `${e.lesson.teacher.name} ${e.lesson.teacher.surname}`,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
      teacherRemarks: teacherRemarks.map((r) => ({
        id: r.id,
        subject: r.subject.name,
        teacher: r.teacher ? `${r.teacher.name} ${r.teacher.surname}` : "Unknown",
        note: r.notes,
        date: r.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("[Mobile Home Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message, stack: error.stack }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
