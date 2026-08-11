import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { createAttendanceNotification, createAssignmentNotification, createResourceNotification, createRemarkNotification } from "@/lib/notifications";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const body = await request.json();
    const { teacherId, classId, records, date, lessonId, task, resource, subjectId } = body;

    if (!teacherId || !records || !Array.isArray(records)) {
      return new NextResponse("Missing required fields", { status: 400 });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
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

      let slot = null;
      const parsedSlotId = body.slotId ? parseInt(body.slotId) : undefined;
      
      if (parsedSlotId) {
        slot = await prisma.timetableSlot.findUnique({
          where: { id: parsedSlotId },
          include: { subject: true }
        });
      } else {
        slot = await prisma.timetableSlot.findFirst({
          where: {
            classId: parseInt(classId), teacherId, day: dayName as any, isDraft: false,
            ...(parsedSubjectId ? { subjectId: parsedSubjectId } : {})
          },
          orderBy: { slotNumber: "asc" },
          include: { subject: true }
        });
      }

      if (slot && slot.subjectId) {
        // Find all timetable slots for this subject
        const subjectSlots = await prisma.timetableSlot.findMany({
          where: {
            classId: parseInt(classId), day: dayName as any, isDraft: false, subjectId: slot.subjectId
          },
          include: { subject: true },
          orderBy: { slotNumber: "asc" }
        });
        
        const slotIndex = subjectSlots.findIndex(s => s.id === slot.id);
        
        // Find all existing lessons for this subject
        const subjectLessons = await prisma.lesson.findMany({
          where: {
            schoolId, classId: parseInt(classId), day: dayName as any, subjectId: slot.subjectId
          },
          orderBy: [
            { startTime: "asc" },
            { id: "asc" }
          ]
        });
        
        // Match exactly like Admin API to prevent mapping conflicts
        const expectedName = `${slot.subject?.name || "Session"} - ${slot.startTime}`;
        let matchedLesson = subjectLessons.find(l => l.name === expectedName) || null;
        
        if (!matchedLesson) {
          const usedLegacyLessonIds = new Set<number>();
          for (const s of subjectSlots) {
             const sExpectedName = `${s.subject?.name || "Session"} - ${s.startTime}`;
             let currentMatch = subjectLessons.find(l => l.name === sExpectedName);
             
             if (!currentMatch) {
               const legacyLesson = subjectLessons.find(l => l.name === (s.subject?.name || "Session") && !usedLegacyLessonIds.has(l.id));
               if (legacyLesson) {
                 currentMatch = legacyLesson;
                 usedLegacyLessonIds.add(legacyLesson.id);
               }
             }
             
             if (!currentMatch) {
               const anyLesson = subjectLessons.find(l => !usedLegacyLessonIds.has(l.id));
               if (anyLesson) {
                 currentMatch = anyLesson;
                 usedLegacyLessonIds.add(anyLesson.id);
               }
             }
             
             if (s.id === slot.id) {
               matchedLesson = currentMatch || null;
               break;
             }
          }
        }
        
        if (matchedLesson) {
          effectiveLessonId = matchedLesson.id;
        } else {
          // Create the lesson if it doesn't exist for this index
          const expectedName = `${slot.subject?.name || "Session"} - ${slot.startTime}`;
          
          // Try to set the real start time if possible
          let realStartTime = new Date(attendanceDate);
          try {
            if (slot.startTime) {
               const [hours, minutes] = slot.startTime.split(':').map(Number);
               realStartTime.setHours(hours, minutes, 0, 0);
            }
          } catch (e) {}

          const newLesson = await prisma.lesson.create({
            data: {
              name: expectedName,
              day: dayName as any,
              startTime: realStartTime,
              endTime: realStartTime,
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

    // 1.5 Fetch existing attendance records to detect changes
    const existingAttendances = await prisma.attendance.findMany({
      where: {
        studentId: { in: records.map((r: any) => r.studentId) },
        date: attendanceDate,
        lessonId: effectiveLessonId || null
      },
      select: { studentId: true, status: true, note: true }
    });

    const existingMap = new Map(existingAttendances.map(a => [a.studentId, a]));

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
      const oldRecord = existingMap.get(record.studentId);
      
      // Format note exactly as it will be saved to properly compare
      let formattedNote = record.note || null;
      if (formattedNote && !formattedNote.startsWith("[")) {
        formattedNote = JSON.stringify([{ author: "Teacher", text: formattedNote }]);
      }

      // Notify parent if student is absent or late, AND status actually changed
      if ((record.status === 'ABSENT' || record.status === 'LATE') && record.status !== oldRecord?.status) {
        createAttendanceNotification(record.studentId, record.status, attendanceDate, effectiveLessonId).catch(console.error);
      }

      // Notify parent if a remark note was left for this student, AND note actually changed
      if (formattedNote && formattedNote !== oldRecord?.note) {
        // Resolve the subject name from the lesson for a richer notification
        const lessonSubject = effectiveLessonId
          ? await prisma.lesson.findUnique({ where: { id: effectiveLessonId }, include: { subject: true } })
          : null;
        const subjectName = lessonSubject?.subject?.name || 'Class';
        // Use the raw text for the notification instead of the JSON array
        createRemarkNotification(record.studentId, subjectName, record.note).catch(console.error);
      }
    }

    // 4. Handle Task/Assignment Creation
    if (task && task.title) {
      // If no lesson was resolved, create a fallback lesson so the task is never silently dropped
      if (!effectiveLessonId && classId) {
        const fallbackSubject = subjectId 
          ? await prisma.subject.findUnique({ where: { id: parseInt(subjectId) } })
          : await prisma.subject.findFirst({ where: { schoolId } });
        
        const fallbackLesson = await prisma.lesson.create({
          data: {
            name: fallbackSubject?.name || "General Session",
            day: "MONDAY",
            startTime: attendanceDate,
            endTime: attendanceDate,
            subjectId: fallbackSubject?.id || 1,
            classId: parseInt(classId),
            teacherId,
            schoolId
          }
        });
        effectiveLessonId = fallbackLesson.id;
      }

      if (effectiveLessonId) {
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

