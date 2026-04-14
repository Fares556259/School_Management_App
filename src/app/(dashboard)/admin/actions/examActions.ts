"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function getExamsByClass(classId: number) {
  try {
    const exams = await prisma.exam.findMany({
      where: {
        lesson: { classId }
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
}) {
  try {
    // For exams, we need to map day/slot to a specific DateTime. 
    // Usually, we'd pick the "current" week or a target week.
    // For simplicity, let's assume we are editing the current week.
    const today = new Date();
    const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    monday.setHours(0, 0, 0, 0);

    const examDate = getDateForDay(data.day, monday);
    const session = sessionTimes[data.slotNumber - 1];

    const startTime = new Date(examDate);
    const [hStart, mStart] = session.start.split(":").map(Number);
    startTime.setHours(hStart, mStart, 0, 0);

    const endTime = new Date(examDate);
    const [hEnd, mEnd] = session.end.split(":").map(Number);
    endTime.setHours(hEnd, mEnd, 0, 0);

    // If ID is -1, create a new Exam. 
    // Exams need a lesson. We'll find or create a placeholder lesson for that subject/class/teacher if needed,
    // or just pick the first existing lesson that matches.
    if (data.id === -1) {
       let lesson = await prisma.lesson.findFirst({
         where: {
            classId: data.classId,
            subjectId: data.subjectId!,
            teacherId: data.teacherId!
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
        const today = new Date();
        const monday = new Date(today.setDate(today.getDate() - today.getDay() + 1));
        monday.setHours(0, 0, 0, 0);
    
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
