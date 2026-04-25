import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, records, date, lessonId } = body;

    if (!teacherId || !records || !Array.isArray(records)) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    const schoolId = teacher.schoolId;
    const attendanceDate = date ? new Date(date) : new Date();
    // Normalize date to YYYY-MM-DD
    attendanceDate.setHours(0, 0, 0, 0);

    let effectiveLessonId = lessonId ? parseInt(lessonId) : null;

    // 1. Ensure lesson exists (First pass, outside main transaction for speed)
    if (!effectiveLessonId && classId) {
      const moment = (await import('moment')).default;
      const dayName = moment(attendanceDate).format('dddd').toUpperCase();
      
      const lesson = await prisma.lesson.findFirst({
        where: {
          schoolId,
          classId: parseInt(classId),
          teacherId,
          day: dayName as any
        }
      });

      if (lesson) {
        effectiveLessonId = lesson.id;
      } else {
        const slot = await prisma.timetableSlot.findFirst({
          where: {
            schoolId,
            classId: parseInt(classId),
            teacherId,
            day: dayName as any
          },
          include: { subject: true }
        });

        if (slot) {
          const newLesson = await prisma.lesson.create({
            data: {
              name: slot.subject?.name || "Session",
              day: dayName as any,
              startTime: attendanceDate,
              endTime: attendanceDate,
              subjectId: slot.subjectId,
              classId: parseInt(classId),
              teacherId,
              schoolId
            }
          });
          effectiveLessonId = newLesson.id;
        }
      }
    }

    // 2. Bulk upsert records
    // We use native upsert for non-null lessonIds (fastest) 
    // and manual check for null lessonIds (necessary for Prisma unique constraints)
    const ops = records.map(async (record: any) => {
      if (effectiveLessonId) {
        return prisma.attendance.upsert({
          where: {
            studentId_date_lessonId: {
              studentId: record.studentId,
              date: attendanceDate,
              lessonId: effectiveLessonId
            }
          },
          update: { status: record.status },
          create: {
            studentId: record.studentId,
            date: attendanceDate,
            lessonId: effectiveLessonId,
            status: record.status,
            schoolId: schoolId
          }
        });
      } else {
        // Fallback for null lessonId (Manual/Orphan records)
        const existing = await prisma.attendance.findFirst({
          where: {
            studentId: record.studentId,
            date: attendanceDate,
            lessonId: null
          },
          select: { id: true }
        });

        if (existing) {
          return prisma.attendance.update({
            where: { id: existing.id },
            data: { status: record.status }
          });
        } else {
          return prisma.attendance.create({
            data: {
              studentId: record.studentId,
              date: attendanceDate,
              lessonId: null,
              status: record.status,
              schoolId: schoolId
            }
          });
        }
      }
    });

    const results = await Promise.all(ops);

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error("[Teacher Attendance POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
