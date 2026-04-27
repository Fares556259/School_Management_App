import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";
import { AttendanceStatus } from "@prisma/client";
import { createAttendanceNotification } from "@/lib/notifications";
import { getSchoolId } from "@/lib/school";

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
  const schoolId = await getSchoolId();
  console.log(`[Attendance API] Fetching for School: ${schoolId}`);
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
      schoolId,
      classId: parseInt(classId),
      day: dayEnum as any,
    },
    include: { subject: true },
    orderBy: { slotNumber: "asc" },
  });

  // Resolve real Lesson IDs for the UI slots if they exist
  const lessonIds = await prisma.lesson.findMany({
    where: { schoolId, classId: parseInt(classId), day: dayEnum as any },
    select: { id: true, subjectId: true }
  });

  const lessonsForUI = slots.map(s => {
    const realLesson = lessonIds.find(l => l.subjectId === s.subjectId);
    return {
      id: `slot-${s.id}`,
      name: s.subject?.name || "Free Period",
      startTime: `${dateStr}T${s.startTime}:00`,
      subject: s.subject,
      slotId: s.id,
      realLessonId: realLesson?.id || null,
    };
  });

  let targetLessonId: number | null = null;
  const isAll = !lessonIdParam || lessonIdParam === "ALL";
  
  if (!isAll) {
    if (lessonIdParam!.startsWith("slot-")) {
      const slotId = parseInt(lessonIdParam!.replace("slot-", ""));
      const targetSlot = slots.find(s => s.id === slotId);
      if (targetSlot?.subjectId) {
          const lesson = await prisma.lesson.findFirst({
            where: { schoolId, classId: parseInt(classId), subjectId: targetSlot.subjectId, day: dayEnum as any }
          });
          if (lesson) targetLessonId = lesson.id;
      }
    } else {
      const parsedId = parseInt(lessonIdParam!);
      if (!isNaN(parsedId)) {
        targetLessonId = parsedId;
      }
    }
  }

  const now = new Date();
  
  const students = await prisma.student.findMany({
    where: { schoolId, classId: parseInt(classId) },
    select: {
      id: true,
      name: true,
      surname: true,
      img: true,
      parent: {
        select: {
          name: true,
          surname: true,
          phone: true,
        }
      },
      attendance: {
        where: {
          date: { gte: dayStart, lt: dayEnd },
          // If not 'isAll', filter by specific lesson. Otherwise, get all for the day.
          lessonId: isAll ? undefined : targetLessonId,
        },
        select: { id: true, status: true, note: true, lessonId: true },
        orderBy: { id: "desc" },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  // If 'isAll', we aggregate the attendance into a single representative status for the day
  // Prioritizing ABSENT > LATE > PRESENT
  const aggregatedStudents = students.map((s) => {
    if (isAll) {
      let finalStatus: string | null = null;
      let finalId: any = -1;
      let finalNote: string | null = null;

      if (s.attendance.length > 0) {
        const statuses = s.attendance.map(a => a.status);
        if (statuses.includes("ABSENT")) finalStatus = "ABSENT";
        else if (statuses.includes("LATE")) finalStatus = "LATE";
        else finalStatus = "PRESENT";
        
        const mainRecord = s.attendance.find(a => a.status === finalStatus) || s.attendance[0];
        finalId = mainRecord.id;
        finalNote = mainRecord.note;
      } else {
        finalStatus = "PRESENT"; // Default to present for the overview if no records
      }

      return {
        ...s,
        attendance: [{ id: finalId, status: finalStatus, note: finalNote }]
      };
    }
    
    // If specific lesson, handle virtual presence for past slots
    if (s.attendance.length === 0 && !isAll) {
      const slotId = lessonIdParam!.startsWith("slot-") ? parseInt(lessonIdParam!.replace("slot-", "")) : null;
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

  // Fetch Assignments and Resources if we have a target lesson
  let assignments: any[] = [];
  let resources: any[] = [];

  if (targetLessonId) {
    [assignments, resources] = await Promise.all([
      prisma.assignment.findMany({ where: { lessonId: targetLessonId, schoolId } }),
      prisma.resource.findMany({ where: { lessonId: targetLessonId, schoolId } }),
    ]);
  }

  // Calculate monthly stats for insights
  const monthStart = new Date(dayStart.getFullYear(), dayStart.getMonth(), 1);
  const monthEnd = new Date(dayStart.getFullYear(), dayStart.getMonth() + 1, 0);

  // Fetch all absences for this class in the current month to build real history
  const monthlyAbsences = await prisma.attendance.findMany({
    where: {
      schoolId,
      date: { gte: monthStart, lte: monthEnd },
      status: 'ABSENT',
      student: { classId: parseInt(classId) }
    },
    include: {
      lesson: {
        select: { 
          name: true,
          startTime: true
        }
      }
    },
    orderBy: { date: 'desc' }
  });

  // Group by studentId
  const historyMap: Record<string, any[]> = {};
  const countMap: Record<string, number> = {};

  monthlyAbsences.forEach(a => {
    if (!historyMap[a.studentId]) historyMap[a.studentId] = [];
    historyMap[a.studentId].push({
      date: a.date,
      lessonName: a.lesson?.name || "Session",
      startTime: a.lesson?.startTime
    });
    countMap[a.studentId] = (countMap[a.studentId] || 0) + 1;
  });

  const finalStudents = aggregatedStudents.map(s => ({
    ...s,
    monthlyAbsences: countMap[s.id] || 0,
    absenceHistory: historyMap[s.id] || []
  }));

  return NextResponse.json({ 
    students: finalStudents, 
    lessons: lessonsForUI,
    assignments,
    resources
  });
}

// POST /api/attendance
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const schoolId = await getSchoolId();
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
        const targetSlot = await prisma.timetableSlot.findFirst({ where: { id: slotId, schoolId }, include: { subject: true } });
        if (targetSlot && targetSlot.subjectId) {
          let lesson = await prisma.lesson.findFirst({
            where: { schoolId, classId: targetSlot.classId, subjectId: targetSlot.subjectId, day: targetSlot.day }
          });
          if (!lesson) {
            // Need a teacherId fallback, find subject teacher or use a default
            const anyTeacher = await prisma.teacher.findFirst({ where: { schoolId } });
            lesson = await prisma.lesson.create({
              data: {
                name: targetSlot.subject?.name || "Session",
                day: targetSlot.day,
                startTime: dayStart,
                endTime: dayStart,
                subjectId: targetSlot.subjectId,
                classId: targetSlot.classId,
                teacherId: targetSlot.teacherId || anyTeacher!.id,
                schoolId,
              }
            });
          }
          targetLessonId = lesson.id;
        }
      } else {
        targetLessonId = parseInt(lessonId);
      }
    }

    // Parallelize operations to avoid timeout and improve speed
    const ops = records.map(async (r) => {
      const existing = await prisma.attendance.findFirst({
        where: {
          schoolId,
          studentId: r.studentId,
          date: dayStart,
          lessonId: targetLessonId,
        },
        select: { id: true }
      });

      if (existing) {
        return prisma.attendance.update({
          where: { id: existing.id },
          data: { status: r.status as AttendanceStatus, note: r.note ?? null },
        });
      } else {
        return prisma.attendance.create({
          data: {
            studentId: r.studentId,
            date: dayStart,
            status: r.status as AttendanceStatus,
            note: r.note ?? null,
            lessonId: targetLessonId,
            schoolId,
          },
        });
      }
    });

    await Promise.all(ops);

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
