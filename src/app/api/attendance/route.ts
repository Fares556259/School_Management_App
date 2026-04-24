import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";
import { AttendanceStatus } from "@prisma/client";
import { createAttendanceNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// Map JS day number to Prisma Day enum
const DAY_MAP: Record<number, string> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
  6: "SATURDAY",
  0: "SUNDAY",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const dateStr = searchParams.get("date");
  const lessonIdParam = searchParams.get("lessonId");

  if (!classId || !dateStr) {
    return NextResponse.json({ error: "Missing classId or date" }, { status: 400 });
  }

  const [year, month, day] = dateStr.split("-").map(Number);
  const dayStart = new Date(year, month - 1, day);
  const dayEnd = new Date(year, month - 1, day + 1);

  // Fetch today's Timetable slots for this class
  const dayNum = dayStart.getDay();
  const dayEnum = DAY_MAP[dayNum] || "MONDAY";

  // Use TimetableSlots for the dropdowns as they represent the recurring actual schedule!
  const slots = await prisma.timetableSlot.findMany({
    where: {
      classId: parseInt(classId),
      day: dayEnum as any,
    },
    include: { subject: true },
    orderBy: { slotNumber: "asc" },
  });

  const lessonsForUI = slots.map(s => ({
    id: `slot-${s.id}`,
    name: s.subject?.name || "Free Period",
    startTime: `${dateStr}T${s.startTime}:00`, // proxy for UI formatting
    subject: s.subject,
    slotId: s.id,
  }));

  let targetLessonId: number | null = null;
  
  if (lessonIdParam && lessonIdParam !== "ALL") {
    // UI is passing a TimetableSlot. We must resolve it to its concrete Lesson or fallback to subject inference later
    // Actually, when filtering in the UI, we just want to load the attendance.
    // Let's resolve the actual underlying Lesson ID if it exists:
    if (lessonIdParam.startsWith("slot-")) {
      const slotId = parseInt(lessonIdParam.replace("slot-", ""));
      const targetSlot = slots.find(s => s.id === slotId);
      if (targetSlot?.subjectId) {
         // find the lesson
         const lesson = await prisma.lesson.findFirst({
           where: { classId: parseInt(classId), subjectId: targetSlot.subjectId, day: dayEnum as any }
         });
         if (lesson) targetLessonId = lesson.id;
      }
    } else {
      targetLessonId = parseInt(lessonIdParam);
    }
  }

  const now = new Date();
  
  const students = await prisma.student.findMany({
    where: { classId: parseInt(classId) },
    select: {
      id: true,
      name: true,
      surname: true,
      img: true,
      attendance: {
        where: {
          date: { gte: dayStart, lt: dayEnd },
          lessonId: targetLessonId,
        },
        select: { id: true, status: true, note: true },
        orderBy: { id: "desc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  // Inject virtual "PRESENT" for sessions that are in the past
  const mappedStudents = students.map((s) => {
    if (s.attendance.length === 0 && lessonIdParam && lessonIdParam !== "ALL") {
      const slotId = lessonIdParam.startsWith("slot-") ? parseInt(lessonIdParam.replace("slot-", "")) : null;
      const slot = slots.find(sl => sl.id === slotId);
      
      if (slot?.endTime) {
        try {
          const { hours, minutes } = parseTime(slot.endTime);
          const sessionEnd = new Date(now);
          sessionEnd.setHours(hours, minutes, 0, 0);
          if (now > sessionEnd) {
            return {
              ...s,
              attendance: [{ id: `v-${s.id}-${slot.id}`, status: "PRESENT", note: null }],
            };
          }
        } catch (e) {
          console.error("[Time Parse Error Web]", e);
        }
      }
      
      return {
        ...s,
        attendance: [{ id: -1, status: "PRESENT", note: null }]
      };
    }
    return s;
  });

  return NextResponse.json({ students: mappedStudents, lessons: lessonsForUI });
}

// POST /api/attendance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, date, lessonId } = body as {
      records: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE"; note?: string }[];
      date: string;
      lessonId?: string | null;
    };

    if (!records || !date) {
      return NextResponse.json({ error: "Missing records or date" }, { status: 400 });
    }

    const [year, month, day] = date.split("-").map(Number);
    const dayStart = new Date(year, month - 1, day);
    let targetLessonId: number | null = null;

    if (lessonId && lessonId !== "ALL") {
      if (lessonId.startsWith("slot-")) {
        const slotId = parseInt(lessonId.replace("slot-", ""));
        const targetSlot = await prisma.timetableSlot.findUnique({ where: { id: slotId }, include: { subject: true } });
        if (targetSlot && targetSlot.subjectId) {
          let lesson = await prisma.lesson.findFirst({
            where: { classId: targetSlot.classId, subjectId: targetSlot.subjectId, day: targetSlot.day }
          });
          if (!lesson) {
            // Need a teacherId fallback, find subject teacher or use a default
            const anyTeacher = await prisma.teacher.findFirst();
            lesson = await prisma.lesson.create({
              data: {
                name: targetSlot.subject?.name || "Session",
                day: targetSlot.day,
                startTime: dayStart,
                endTime: dayStart,
                subjectId: targetSlot.subjectId,
                classId: targetSlot.classId,
                teacherId: targetSlot.teacherId || anyTeacher!.id,
              }
            });
          }
          targetLessonId = lesson.id;
        }
      } else {
        targetLessonId = parseInt(lessonId);
      }
    }

    // Sequentialize upserts to avoid connection pool pressure
    for (const r of records) {
      const existing = await prisma.attendance.findFirst({
        where: {
          studentId: r.studentId,
          date: dayStart,
          lessonId: targetLessonId,
        },
      });

      if (existing) {
        await prisma.attendance.update({
          where: { id: existing.id },
          data: { status: r.status as AttendanceStatus, note: r.note ?? null },
        });
      } else {
        await prisma.attendance.create({
          data: {
            studentId: r.studentId,
            date: dayStart,
            status: r.status as AttendanceStatus,
            note: r.note ?? null,
            lessonId: targetLessonId,
          },
        });
      }
    }

    // Trigger notifications asynchronously for ABSENT and LATE
    records.forEach(r => {
      if (r.status !== 'PRESENT') {
        createAttendanceNotification(r.studentId, r.status, dayStart);
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Attendance POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
