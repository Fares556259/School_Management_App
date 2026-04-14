"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getExamPeriodConfigs() {
  try {
    const configs = await prisma.examPeriodConfig.findMany();
    return { success: true, data: configs };
  } catch (error: any) {
    console.error("Error fetching period configs:", error);
    return { success: false, error: error.message };
  }
}

export async function upsertExamPeriodConfig(period: number, startDate: Date, endDate?: Date) {
  try {
    const config = await prisma.examPeriodConfig.upsert({
      where: { period },
      update: { 
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null
      },
      create: { 
        period, 
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

async function getPeriodRange(period: number) {
  const config = await prisma.examPeriodConfig.findUnique({
    where: { period }
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

export async function getExamsByClass(classId: number, examPeriod: number = 1) {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        lesson: { classId },
        examPeriod
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
}) {
  try {
    const { startDate } = await getPeriodRange(data.examPeriod);
    
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
    const exam = await prisma.exam.findUnique({ where: { id: examId } });
    if (!exam) return { success: false, error: "Exam not found" };

    const { startDate } = await getPeriodRange(exam.examPeriod);
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

        revalidatePath("/list/exams");
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

export async function bulkUpdateExams(classId: number, period: number, slots: any[]) {
    try {
        await prisma.$transaction(async (tx) => {
            // 1. Delete existing exams for this class and period
            await tx.exam.deleteMany({
                where: {
                    lesson: { classId },
                    examPeriod: period
                }
            });

            // 2. Create new exams
            for (const slot of slots) {
                // Map session to physical times (simplified logic matching updateExamSlot)
                const { startDate } = await getPeriodRange(period);
                const monday = startDate;

                const daysMap: Record<Day, number> = {
                    MONDAY: 0, TUESDAY: 1, WEDNESDAY: 2, THURSDAY: 3, FRIDAY: 4, SATURDAY: 5
                };
                const examDate = new Date(monday);
                examDate.setDate(examDate.getDate() + daysMap[slot.day as Day]);

                const session = sessionTimes[slot.slotNumber - 1];
                const startTime = new Date(examDate);
                const [hStart, mStart] = session.start.split(":").map(Number);
                startTime.setHours(hStart, mStart, 0, 0);

                const endTime = new Date(examDate);
                const [hEnd, mEnd] = session.end.split(":").map(Number);
                endTime.setHours(hEnd, mEnd, 0, 0);

                // Find or create lesson
                let lessonValue = await tx.lesson.findFirst({
                    where: {
                        classId,
                        subjectId: slot.subjectId,
                        teacherId: slot.teacherId
                    }
                });

                if (!lessonValue) {
                    lessonValue = await tx.lesson.create({
                        data: {
                            name: "Exam Lesson",
                            day: slot.day,
                            startTime,
                            endTime,
                            classId,
                            subjectId: slot.subjectId,
                            teacherId: slot.teacherId
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
                    }
                });
            }
        });

        revalidatePath("/list/exams");
        return { success: true };
    } catch (error: any) {
        console.error("bulkUpdateExams error:", error);
        return { success: false, error: error.message };
    }
}
