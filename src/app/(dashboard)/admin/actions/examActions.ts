"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getExamPeriodConfigs(classId?: number) {
  try {
    const configs = await prisma.examPeriodConfig.findMany({
      where: classId ? { classId } : {}
    });
    return { success: true, data: configs };
  } catch (error: any) {
    console.error("Error fetching period configs:", error);
    return { success: false, error: error.message };
  }
}

export async function upsertExamPeriodConfig(period: number, startDate: Date, endDate?: Date, classId?: number) {
  try {
    if (!classId) return { success: false, error: "Class ID is required" };

    const config = await prisma.examPeriodConfig.upsert({
      where: { period_classId: { period, classId } },
      update: { 
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      },
      create: { 
        period, 
        classId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      }
    });
    revalidatePath("/list/exams");
    return { success: true, data: config };
  } catch (error: any) {
    console.error("Error upserting period config:", error);
    return { success: false, error: error.message };
  }
}

async function getPeriodRange(period: number, classId?: number) {
  // If classId is provided, fetch specifically for it, otherwise global fallback
  const config = await prisma.examPeriodConfig.findFirst({
    where: classId ? { period, classId } : { period }
  });
  if (config) {
    return {
      startDate: new Date(config.startDate),
      endDate: config.endDate ? new Date(config.endDate) : undefined
    };
  }

  // Fallback to current week's Monday-Saturday
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1);
  const startDate = new Date(today.setDate(diff));
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 5);
  endDate.setHours(23, 59, 59, 999);

  return { startDate, endDate };
}

export async function getExamsByClass(classId: number, examPeriod: number = 1, isDraft: boolean = false) {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        lesson: { classId },
        examPeriod,
        isDraft
      },
      include: {
        lesson: {
          include: {
            subject: true,
            class: true,
            teacher: true,
          }
        }
      },
      orderBy: { startTime: 'asc' }
    });
    return { success: true, data: exams };
  } catch (error: any) {
    console.error("Error fetching exams:", error);
    return { success: false, error: error.message };
  }
}

// Internal helper to get Date for a Day of the current week
function getDateForDay(targetDay: Day, currentWeekStart: Date) {
  const daysMap: Record<Day, number> = {
    MONDAY: 0,
    TUESDAY: 1,
    WEDNESDAY: 2,
    THURSDAY: 3,
    FRIDAY: 4,
    SATURDAY: 5
  };
  const date = new Date(currentWeekStart);
  date.setDate(date.getDate() + daysMap[targetDay]);
  return date;
}

// Internal helper for session times mapping
const sessionTimes = [
  { start: "08:00", end: "10:00" },
  { start: "10:00", end: "12:00" },
  { start: "12:00", end: "14:00" },
];

export async function updateExamSlot(data: {
  id: number;
  subjectId?: number | null;
  teacherId?: string | null;
  classId: number;
  day: Day;
  slotNumber: number;
  room?: string | null;
  examPeriod: number;
  targetDate?: string; // Add ISO string for target date
  isDraft?: boolean;
}) {
  try {
    const { startDate } = await getPeriodRange(data.examPeriod, data.classId);
    
    // Use targetDate if provided (most precise)
    const examDate = data.targetDate ? new Date(data.targetDate) : getDateForDay(data.day, startDate);
    const session = sessionTimes[data.slotNumber - 1] || sessionTimes[0];

    const startTime = new Date(examDate);
    const [hStart, mStart] = session.start.split(":").map(Number);
    startTime.setHours(hStart, mStart, 0, 0);

    const endTime = new Date(examDate);
    const [hEnd, mEnd] = session.end.split(":").map(Number);
    endTime.setHours(hEnd, mEnd, 0, 0);

    // If ID is -1, create a new Exam. 
    if (data.id === -1) {
       if (!data.subjectId || !data.teacherId) {
         return { success: false, error: "Subject and Teacher are required." };
       }

       let lesson = await prisma.lesson.findFirst({
         where: {
            classId: data.classId,
            subjectId: data.subjectId,
            teacherId: data.teacherId
         }
       });

       if (!lesson) {
          // Create dummy lesson for the exam if none exists
          lesson = await prisma.lesson.create({
            data: {
                name: "Exam Lesson",
                day: data.day,
                startTime: startTime,
                endTime: endTime,
                classId: data.classId,
                subjectId: data.subjectId!,
                teacherId: data.teacherId!
            }
          });
       }

       const created = await prisma.exam.create({
         data: {
            title: "Examination",
            startTime,
            endTime,
            examPeriod: data.examPeriod,
            lessonId: lesson.id,
            isDraft: data.isDraft ?? false,
         }
       });
       revalidatePath("/list/exams");
       return { success: true, data: created };
    }

    const updated = await prisma.exam.update({
      where: { id: data.id },
      data: {
        startTime,
        endTime,
        // Optional: title: data.title
      }
    });

    revalidatePath("/list/exams");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating exam:", error);
    return { success: false, error: error.message };
  }
}

export async function moveExam(examId: number, targetDay: Day, targetSlotNumber: number) {
    try {
    // We need the examPeriod to find the correct Monday. 
    // Let's fetch the exam first.
    const exam = await prisma.exam.findUnique({ 
      where: { id: examId },
      include: { lesson: true }
    });
    if (!exam) return { success: false, error: "Exam not found" };

    const { startDate } = await getPeriodRange(exam.examPeriod, exam.lesson.classId);
    const monday = startDate;
    
        const examDate = getDateForDay(targetDay, monday);
        const session = sessionTimes[targetSlotNumber - 1];
    
        const startTime = new Date(examDate);
        const [hStart, mStart] = session.start.split(":").map(Number);
        startTime.setHours(hStart, mStart, 0, 0);
    
        const endTime = new Date(examDate);
        const [hEnd, mEnd] = session.end.split(":").map(Number);
        endTime.setHours(hEnd, mEnd, 0, 0);



        await prisma.exam.update({
            where: { id: examId },
            data: { startTime, endTime }
        });

        return { success: true };
    } catch (error: any) {
        console.error("Error moving exam:", error);
        return { success: false, error: error.message };
    }
}

export async function deleteExam(id: number) {
  try {
    await prisma.exam.delete({
      where: { id }
    });
    revalidatePath("/list/exams");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting exam:", error);
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateExams(classId: number, period: number, slots: any[], isDraft: boolean = false) {
    try {
        if (!classId) return { success: false, error: "Class ID is required" };
        if (!Array.isArray(slots) || slots.length === 0) {
            return { success: false, error: "No slots generated to save." };
        }

        const { startDate } = await getPeriodRange(period, classId);
        const monday = startDate;

        const targetClass = await prisma.class.findUnique({
            where: { id: classId },
            select: { schoolId: true }
        });
        const schoolId = targetClass?.schoolId || "default_school";

        await prisma.$transaction(async (tx) => {
            // Ensure at least one valid teacher exists in the database
            let fallbackTeacher = await tx.teacher.findFirst({
                where: { schoolId }
            }) || await tx.teacher.findFirst();

            if (!fallbackTeacher) {
                fallbackTeacher = await tx.teacher.upsert({
                    where: { id: "default_teacher" },
                    update: {},
                    create: {
                        id: "default_teacher",
                        username: "default_teacher",
                        name: "Enseignant",
                        surname: "Général",
                        phone: "+21600000000",
                        address: "SnapSchool",
                        bloodType: "A+",
                        sex: "MALE",
                        birthday: new Date("1990-01-01"),
                        schoolId
                    }
                });
            }

            // 1. Delete existing exams for this class and period
            await tx.exam.deleteMany({
                where: {
                    lesson: { classId },
                    examPeriod: period,
                    isDraft
                }
            });

            // 2. Create new exams
            for (const slot of slots) {
                const dayStr = String(slot.day || "MONDAY").toUpperCase() as Day;
                const daysMap: Record<Day, number> = {
                    MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5
                };
                const dayOffset = daysMap[dayStr] ?? 0;
                const examDate = new Date(monday);
                examDate.setDate(examDate.getDate() + dayOffset);

                const slotNum = Number(slot.slotNumber) || 1;
                const session = sessionTimes[slotNum - 1] || sessionTimes[0];

                const startTime = new Date(examDate);
                const [hStart, mStart] = session.start.split(":").map(Number);
                startTime.setHours(hStart, mStart, 0, 0);

                const endTime = new Date(examDate);
                const [hEnd, mEnd] = session.end.split(":").map(Number);
                endTime.setHours(hEnd, mEnd, 0, 0);

                const subId = Number(slot.subjectId);
                if (!subId || isNaN(subId)) continue;

                // Validate teacher ID against DB to prevent foreign key violation
                let teacherIdToUse = fallbackTeacher.id;
                if (slot.teacherId) {
                    const foundTeacher = await tx.teacher.findUnique({
                        where: { id: String(slot.teacherId) }
                    });
                    if (foundTeacher) {
                        teacherIdToUse = foundTeacher.id;
                    }
                }

                // Find or create lesson
                let lessonValue = await tx.lesson.findFirst({
                    where: {
                        classId,
                        subjectId: subId,
                        teacherId: teacherIdToUse
                    }
                });

                if (!lessonValue) {
                    lessonValue = await tx.lesson.create({
                        data: {
                            name: "Exam Lesson",
                            day: dayStr,
                            startTime,
                            endTime,
                            classId,
                            subjectId: subId,
                            teacherId: teacherIdToUse,
                            schoolId
                        }
                    });
                }

                await tx.exam.create({
                    data: {
                        title: "Examination",
                        startTime,
                        endTime,
                        examPeriod: period,
                        lessonId: lessonValue.id,
                        isDraft
                    }
                });
            }
        });

        revalidatePath("/list/exams");
        revalidatePath("/admin/timetable");
        return { success: true };
    } catch (error: any) {
        console.error("bulkUpdateExams error:", error);
        return { success: false, error: error.message || "Failed to save exam schedule." };
    }
}

export async function publishDraftExams(classId: number, period: number) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing published exams for this class and period
      await tx.exam.deleteMany({
        where: {
          lesson: { classId },
          examPeriod: period,
          isDraft: false
        }
      });

      // 2. Get drafts
      const drafts = await tx.exam.findMany({
        where: {
          lesson: { classId },
          examPeriod: period,
          isDraft: true
        }
      });

      // 3. Clone draft to published
      for (const draft of drafts) {
        await tx.exam.create({
          data: {
            title: draft.title,
            startTime: draft.startTime,
            endTime: draft.endTime,
            examPeriod: draft.examPeriod,
            lessonId: draft.lessonId,
            schoolId: draft.schoolId,
            isDraft: false
          }
        });
      }

      // 4. Delete drafts
      await tx.exam.deleteMany({
        where: {
          lesson: { classId },
          examPeriod: period,
          isDraft: true
        }
      });
    });

    revalidatePath("/list/exams");
    return { success: true };
  } catch (error: any) {
    console.error("Publish draft exams error:", error);
    return { success: false, error: error.message };
  }
}

export async function discardDraftExams(classId: number, period: number) {
  try {
    await prisma.exam.deleteMany({
      where: {
        lesson: { classId },
        examPeriod: period,
        isDraft: true
      }
    });

    revalidatePath("/list/exams");
    return { success: true };
  } catch (error: any) {
    console.error("Discard draft exams error:", error);
    return { success: false, error: error.message };
  }
}

import { createExamScheduleNotification } from "@/lib/notifications";

export async function publishExamScheduleToStudents(classId: number, period: number, pdfUrl: string) {
  try {
    // 1. Get the current config or create a dummy start date if it doesn't exist
    const existing = await prisma.examPeriodConfig.findUnique({
      where: { period_classId: { period, classId } }
    });

    // 2. Upsert the exam config with the PDF URL
    const config = await prisma.examPeriodConfig.upsert({
      where: { period_classId: { period, classId } },
      update: { 
        pdfUrl
      },
      create: { 
        period, 
        classId,
        startDate: existing?.startDate || new Date(),
        pdfUrl
      }
    });

    // 3. Send notifications to students' parents
    await createExamScheduleNotification(classId, period);

    revalidatePath("/list/exams");
    return { success: true, data: config };
  } catch (error: any) {
    console.error("Error publishing exam schedule to students:", error);
    return { success: false, error: error.message };
  }
}

