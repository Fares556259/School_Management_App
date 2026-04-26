import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, records, date, lessonId, task, resource } = body;

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
    const ops = records.map(async (record: any) => {
      // Format note as a standard SnapSchool JSON string if provided
      let formattedNote = record.note || null;
      if (formattedNote && !formattedNote.startsWith("[")) {
        formattedNote = JSON.stringify([{ author: "Teacher", text: formattedNote }]);
      }

      // Robust score parsing
      const rawScore = record.score;
      const parsedScore = (rawScore !== undefined && rawScore !== null && rawScore !== "") ? parseInt(rawScore.toString()) : null;

      if (effectiveLessonId) {
        return prisma.attendance.upsert({
          where: {
            studentId_date_lessonId: {
              studentId: record.studentId,
              date: attendanceDate,
              lessonId: effectiveLessonId
            }
          },
          update: { 
            status: record.status,
            note: formattedNote,
            score: isNaN(parsedScore as any) ? undefined : parsedScore
          },
          create: {
            studentId: record.studentId,
            date: attendanceDate,
            lessonId: effectiveLessonId,
            status: record.status,
            note: formattedNote,
            score: isNaN(parsedScore as any) ? null : parsedScore,
            schoolId: schoolId
          }
        });
      } else {
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
            data: { 
              status: record.status,
              note: formattedNote,
              score: isNaN(parsedScore as any) ? undefined : parsedScore
            }
          });
        } else {
          return prisma.attendance.create({
            data: {
              studentId: record.studentId,
              date: attendanceDate,
              lessonId: null,
              status: record.status,
              note: formattedNote,
              score: isNaN(parsedScore as any) ? null : parsedScore,
              schoolId: schoolId
            }
          });
        }
      }
    });

    const results = await Promise.all(ops);

    // 3. Handle Task/Assignment Creation
    if (task && task.title && effectiveLessonId) {
      await prisma.assignment.create({
        data: {
          title: task.title,
          description: task.description || "",
          startDate: attendanceDate,
          dueDate: new Date(attendanceDate.getTime() + 7 * 24 * 60 * 60 * 1000), // Default 1 week
          lessonId: effectiveLessonId,
          schoolId: schoolId
        }
      });
    }

    // 4. Handle Resource Creation
    if (resource && resource.title && resource.url && effectiveLessonId) {
      await prisma.resource.create({
        data: {
          title: resource.title,
          url: resource.url,
          lessonId: effectiveLessonId,
          schoolId: schoolId
        }
      });
    }

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error("[Teacher Attendance POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

