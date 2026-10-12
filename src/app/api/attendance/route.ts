import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { parseTime } from "@/lib/timeUtils";
import { AttendanceStatus } from "@prisma/client";
import { createAttendanceNotificationsBatch } from "@/lib/notifications";
import { getSchoolId } from "@/lib/school";
import { parseSchoolDay } from "@/lib/schoolDay";
import { selectChangedNonPresent } from "@/lib/attendanceNotifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const schoolId = await getSchoolId();
  const classId = searchParams.get("classId");
  const dateStr = searchParams.get("date");
  const lessonIdParam = searchParams.get("lessonId");
  const rosterView = searchParams.get("view") === "roster";

  if (!classId || !dateStr) {
    return NextResponse.json({ error: "Missing classId or date" }, { status: 400 });
  }

  const parsedClassId = Number(classId);
  const calendarDay = parseSchoolDay(dateStr);
  if (!Number.isSafeInteger(parsedClassId) || parsedClassId <= 0 || !calendarDay) {
    return NextResponse.json({ error: "Invalid classId or date" }, { status: 400 });
  }
  const schoolClass = await prisma.class.findFirst({ where: { id: parsedClassId, schoolId }, select: { id: true } });
  if (!schoolClass) return NextResponse.json({ error: "Class not found" }, { status: 404 });
  const dayStart = calendarDay.date;
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const dayEnum = calendarDay.day;
  if (!dayEnum) return NextResponse.json({ students: [], lessons: [], assignments: [], resources: [] });

  const weekEnd = new Date(dayStart);
  weekEnd.setDate(weekEnd.getDate() + 1);
  const weekStart = new Date(dayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  // 1. Fetch slots first to quickly check if there are classes today
  const slots = await prisma.timetableSlot.findMany({
    where: {
      schoolId,
      classId: parsedClassId,
      day: dayEnum,
      isDraft: false,
    },
    include: { subject: true },
    orderBy: { slotNumber: "asc" },
  });

  // If no slots exist for this day, return instantly without running heavy queries
  if (slots.length === 0) {
    return NextResponse.json({
      students: [],
      lessons: [],
      assignments: [],
      resources: [],
    });
  }

  // 2. Parallelize remaining database queries
  const [lessonIds, students, recentAbsences, recentNotifications] = await Promise.all([
    prisma.lesson.findMany({
      where: { schoolId, classId: parsedClassId, day: dayEnum },
      select: { id: true, subjectId: true, name: true },
    }),
    prisma.student.findMany({
      where: { schoolId, classId: parsedClassId },
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
          },
        },
        attendance: {
          where: {
            schoolId,
            date: { gte: dayStart, lt: dayEnd },
          },
          select: { id: true, status: true, note: true, lessonId: true },
          orderBy: { id: "desc" },
        },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.attendance.findMany({
      where: {
        schoolId,
        date: { gte: weekStart, lt: weekEnd },
        status: "ABSENT",
        student: { schoolId, classId: parsedClassId },
      },
      select: {
        studentId: true, date: true,
        lesson: {
          select: {
            name: true,
            startTime: true,
          },
        },
      },
      orderBy: { date: "desc" },
    }),
    prisma.notification.findMany({
      where: {
        schoolId,
        student: { schoolId, classId: parsedClassId },
        type: "ATTENDANCE",
        createdAt: { gte: weekStart },
        studentId: { not: null }
      },
      select: { studentId: true }
    }),
  ]);

  // Reading attendance must not create lessons. Missing slot lessons are resolved on save.
  const usedLegacyLessonIds = new Set<number>();

  const lessonsForUI = slots.map((s) => {
    const expectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
    let realLesson = lessonIds.find((l) => l.subjectId === s.subjectId && l.name === expectedName);
    
    if (!realLesson) {
      const legacyLesson = lessonIds.find((l) => l.subjectId === s.subjectId && l.name === (s.subject?.name || "Session"));
      if (legacyLesson && !usedLegacyLessonIds.has(legacyLesson.id)) {
        realLesson = legacyLesson;
        usedLegacyLessonIds.add(legacyLesson.id);
      }
    }
    if (!realLesson) {
      const anyLesson = lessonIds.find((l) => l.subjectId === s.subjectId && !usedLegacyLessonIds.has(l.id));
      if (anyLesson) {
        realLesson = anyLesson;
        usedLegacyLessonIds.add(anyLesson.id);
      }
    }

    
    let timeStr = "00:00:00";
    if (s.startTime) {
      try {
        const { hours, minutes } = parseTime(s.startTime);
        timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;
      } catch (e) {
        console.error("Failed to parse startTime", s.startTime);
      }
    }

    return {
      id: `slot-${s.id}`,
      name: s.subject?.name || "Free Period",
      // A timetable value is a school wall-clock time, not a UTC instant.
      startTime: timeStr.slice(0, 5),
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
      const targetSlot = slots.find((s) => s.id === slotId);
      if (targetSlot?.subjectId) {
        // Re-run the deterministic matching to find the right lesson for THIS slot
        const usedIds = new Set<number>();
        for (const s of slots) {
          const expectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
          let realLesson = lessonIds.find((l) => l.subjectId === s.subjectId && l.name === expectedName);
          
          if (!realLesson) {
            const legacyLesson = lessonIds.find((l) => l.subjectId === s.subjectId && l.name === (s.subject?.name || "Session"));
            if (legacyLesson && !usedIds.has(legacyLesson.id)) {
              realLesson = legacyLesson;
              usedIds.add(legacyLesson.id);
            }
          }
          if (!realLesson) {
            const anyLesson = lessonIds.find((l) => l.subjectId === s.subjectId && !usedIds.has(l.id));
            if (anyLesson) {
              realLesson = anyLesson;
              usedIds.add(anyLesson.id);
            }
          }

          if (s.id === slotId) {
            if (realLesson) targetLessonId = realLesson.id;
            break; // Found the target slot's lesson
          }
        }
      }
    } else {
      const parsedId = parseInt(lessonIdParam!);
      if (!isNaN(parsedId)) {
        targetLessonId = parsedId;
      }
    }
  }

  const now = new Date();

  // Process student attendance data in-memory
  const aggregatedStudents = students.map((s) => {
    const relevantAttendance = isAll
      ? s.attendance
      : s.attendance.filter((a) => a.lessonId === null || (targetLessonId !== null && a.lessonId === targetLessonId));

    if (rosterView) return s;

    if (isAll) {
      let finalStatus: string | null = null;
      let finalId: any = -1;
      let finalNote: string | null = null;

      if (relevantAttendance.length > 0) {
        const statuses = relevantAttendance.map((a) => a.status);
        if (statuses.includes("ABSENT")) finalStatus = "ABSENT";
        else if (statuses.includes("LATE")) finalStatus = "LATE";
        else finalStatus = "PRESENT";

        const mainRecord = relevantAttendance.find((a) => a.status === finalStatus) || relevantAttendance[0];
        finalId = mainRecord.id;
        finalNote = mainRecord.note;
      } else {
        finalStatus = "PRESENT"; // Default to present
      }

      return {
        ...s,
        attendance: [{ id: finalId, status: finalStatus, note: finalNote }],
      };
    }

    if (relevantAttendance.length === 0) {
      const slotId = lessonIdParam!.startsWith("slot-") ? parseInt(lessonIdParam!.replace("slot-", "")) : null;
      const slot = slots.find((sl) => sl.id === slotId);

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
        attendance: [{ id: -1, status: "PRESENT", note: null }],
      };
    }

    return {
      ...s,
      attendance: relevantAttendance,
    };
  });

  // Fetch Assignments and Resources if we have a target lesson
  let assignments: any[] = [];
  let resources: any[] = [];

  if (targetLessonId && !rosterView) {
    [assignments, resources] = await Promise.all([
      prisma.assignment.findMany({ where: { lessonId: targetLessonId, schoolId } }),
      prisma.resource.findMany({ where: { lessonId: targetLessonId, schoolId } }),
    ]);
  }

  // Group recent absences and notifications by studentId
  const historyMap: Record<string, any[]> = {};
  const countMap: Record<string, number> = {};
  const notifiedSet = new Set(recentNotifications.map(n => n.studentId));

  recentAbsences.forEach((a) => {
    if (!historyMap[a.studentId]) historyMap[a.studentId] = [];
    historyMap[a.studentId].push({
      date: a.date,
      lessonName: a.lesson?.name || "Session",
      startTime: a.lesson?.startTime,
    });
    countMap[a.studentId] = (countMap[a.studentId] || 0) + 1;
  });

  const finalStudents = aggregatedStudents.map((s) => ({
    ...s,
    recentAbsences: countMap[s.id] || 0,
    absenceHistory: historyMap[s.id] || [],
    hasRecentNotification: notifiedSet.has(s.id),
  }));

  return NextResponse.json({
    students: finalStudents,
    lessons: lessonsForUI,
    assignments,
    resources,
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

    const calendarDay = parseSchoolDay(date);
    if (!calendarDay?.day || !Array.isArray(records) || records.some(record =>
      !record || typeof record.studentId !== "string" || !["PRESENT", "ABSENT", "LATE"].includes(record.status))) {
      return NextResponse.json({ error: "Invalid attendance records or date" }, { status: 400 });
    }
    const studentIds = Array.from(new Set(records.map(record => record.studentId)));
    const allowedStudents = await prisma.student.findMany({ where: { schoolId, id: { in: studentIds } }, select: { id: true, classId: true } });
    if (allowedStudents.length !== studentIds.length) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    const dayStart = calendarDay.date;
    let targetLessonId: number | null = null;
    let sessionSubject: string | null = null;
    let sessionStartTime: string | null = null;

    if (lessonId && lessonId !== "ALL") {
      if (lessonId.startsWith("slot-")) {
        const slotId = parseInt(lessonId.replace("slot-", ""));
        const targetSlot = await prisma.timetableSlot.findFirst({
          where: { id: slotId, schoolId, isDraft: false, day: calendarDay.day },
          include: { subject: true },
        });
        if (!targetSlot?.subjectId || allowedStudents.some(student => student.classId !== targetSlot.classId)) {
          return NextResponse.json({ error: "Invalid session" }, { status: 400 });
        }
        if (targetSlot && targetSlot.subjectId) {
          sessionSubject = targetSlot.subject?.name || "Session";
          sessionStartTime = targetSlot.startTime;
          const lessonName = `${targetSlot.subject?.name || "Session"} - ${targetSlot.startTime}`;
          let lesson = await prisma.lesson.findFirst({
            where: { schoolId, classId: targetSlot.classId, subjectId: targetSlot.subjectId, day: targetSlot.day, name: lessonName },
          });

          if (!lesson) {
            // Fallback: check if there's an old lesson without the time suffix
            const oldLesson = await prisma.lesson.findFirst({
              where: { schoolId, classId: targetSlot.classId, subjectId: targetSlot.subjectId, day: targetSlot.day }
            });
            
            if (oldLesson && oldLesson.name === (targetSlot.subject?.name || "Session")) {
               // Update it to have the time suffix so we don't lose old attendance history
               lesson = await prisma.lesson.update({
                 where: { id: oldLesson.id },
                 data: { name: lessonName }
               });
            } else {
               // Completely new slot
               const anyTeacher = await prisma.teacher.findFirst({ where: { schoolId } });
               lesson = await prisma.lesson.create({
                 data: {
                   name: lessonName,
                   day: targetSlot.day,
                   startTime: dayStart,
                   endTime: dayStart,
                   subjectId: targetSlot.subjectId,
                   classId: targetSlot.classId,
                   teacherId: targetSlot.teacherId || anyTeacher!.id,
                   schoolId: targetSlot.schoolId,
                 },
               });
            }
          }
          targetLessonId = lesson.id;
        }
      } else {
        targetLessonId = Number(lessonId);
        if (!Number.isSafeInteger(targetLessonId) || targetLessonId <= 0) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
        const lesson = await prisma.lesson.findFirst({ where: { id: targetLessonId, schoolId, day: calendarDay.day }, select: { classId: true } });
        if (!lesson || allowedStudents.some(student => student.classId !== lesson.classId)) return NextResponse.json({ error: "Invalid session" }, { status: 400 });
      }
    }

    // Optimize DB writes: single findMany + bulk update & createMany

    const existingRecords = await prisma.attendance.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        date: dayStart,
        lessonId: targetLessonId,
      },
      select: { id: true, studentId: true, status: true },
    });

    const existingMap = new Map(existingRecords.map((e) => [e.studentId, e]));

    const updates: any[] = [];
    const creates: any[] = [];

    for (const r of records) {
      const existing = existingMap.get(r.studentId);
      if (existing) {
        updates.push(
          prisma.attendance.update({
            where: { id: existing.id },
            data: { status: r.status as AttendanceStatus, note: r.note ?? null },
          })
        );
      } else {
        creates.push({
          studentId: r.studentId,
          date: dayStart,
          status: r.status as AttendanceStatus,
          note: r.note ?? null,
          lessonId: targetLessonId,
          schoolId,
        });
      }
    }

    await Promise.all([
      ...updates,
      creates.length > 0 ? prisma.attendance.createMany({ data: creates }) : Promise.resolve(),
    ]);

    // Alert only when a student enters or changes a non-present state.
    // Re-saving the same register must not notify a parent twice.
    const changedNonPresent = selectChangedNonPresent(records, existingMap);
    const notificationSummary = changedNonPresent.length > 0
      ? await createAttendanceNotificationsBatch(changedNonPresent, dayStart, targetLessonId, {
          schoolId,
          subjectName: sessionSubject,
          startTime: sessionStartTime,
        })
      : { notificationsCreated: 0, pushTokensCount: 0, pushSentCount: 0 };

    return NextResponse.json({ success: true, notificationSummary });
  } catch (error: any) {
    console.error("[Attendance POST]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
