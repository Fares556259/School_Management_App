import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { createAttendanceNotification, createAssignmentNotification, createResourceNotification, createRemarkNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, records, date, lessonId, task, resource, subjectId } = body;

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
    
    let attendanceDate = new Date();
    if (date) {
      const parts = date.split('-');
      if (parts.length === 3) {
        attendanceDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
      } else {
        attendanceDate = new Date(date);
        attendanceDate.setUTCHours(0, 0, 0, 0);
      }
    } else {
      attendanceDate = new Date(Date.UTC(attendanceDate.getFullYear(), attendanceDate.getMonth(), attendanceDate.getDate()));
    }

    let effectiveLessonId = lessonId ? parseInt(lessonId) : null;

    // 1. Ensure lesson exists (First pass, outside main transaction for speed)
    if (!effectiveLessonId && classId) {
      const moment = (await import('moment')).default;
      const dayName = moment(attendanceDate).format('dddd').toUpperCase();
      
      const parsedSubjectId = subjectId ? parseInt(subjectId) : undefined;

      const slot = await prisma.timetableSlot.findFirst({
        where: {
          schoolId,
          classId: parseInt(classId),
          teacherId,
          day: dayName as any,
          isDraft: false,
          ...(parsedSubjectId ? { subjectId: parsedSubjectId } : {})
        },
        orderBy: { slotNumber: "asc" },
        include: { subject: true }
      });

      const lesson = await prisma.lesson.findFirst({
        where: {
          schoolId,
          classId: parseInt(classId),
          teacherId,
          day: dayName as any,
          ...(slot ? { subjectId: slot.subjectId } : {})
        }
      });

      if (lesson) {
        effectiveLessonId = lesson.id;
      } else {
        if (slot && slot.subjectId) {
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

    // 3. Fire notifications for attendance status and remarks (non-blocking)
    for (const record of records) {
      // Notify parent if student is absent or late
      if (record.status === 'ABSENT' || record.status === 'LATE') {
        createAttendanceNotification(record.studentId, record.status, attendanceDate, effectiveLessonId).catch(console.error);
      }

      // Notify parent if a remark note was left for this student
      if (record.note && record.note.trim()) {
        // Resolve the subject name from the lesson for a richer notification
        const lessonSubject = effectiveLessonId
          ? await prisma.lesson.findUnique({ where: { id: effectiveLessonId }, include: { subject: true } })
          : null;
        const subjectName = lessonSubject?.subject?.name || 'Class';
        createRemarkNotification(record.studentId, subjectName, record.note).catch(console.error);
      }
    }

    // 4. Handle Task/Assignment Creation
    if (task && task.title && effectiveLessonId) {
      const newAssignment = await prisma.assignment.create({
        data: {
          title: task.title,
          description: task.description || "",
          img: task.attachments && task.attachments.length > 0 ? task.attachments.map((a: any) => a.uri).join(',') : null,
          startDate: attendanceDate,
          dueDate: new Date(attendanceDate.getTime() + 7 * 24 * 60 * 60 * 1000),
          lessonId: effectiveLessonId,
          schoolId: schoolId
        }
      });
      // Notify parents about the new task
      createAssignmentNotification(newAssignment.id).catch(console.error);
    }

    // 5. Handle Resource Creation
    if (resource && resource.title && resource.url && effectiveLessonId) {
      const newResource = await prisma.resource.create({
        data: {
          title: resource.title,
          url: resource.url,
          lessonId: effectiveLessonId,
          schoolId: schoolId
        }
      });
      // Notify parents about the new resource
      createResourceNotification(newResource.id).catch(console.error);
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

