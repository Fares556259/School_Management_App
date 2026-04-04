"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";

export type TimetableSlotUpdate = {
  id: number;
  subjectId?: number | null;
  teacherId?: string | null;
  startTime?: string;
  endTime?: string;
};

export async function getTimetableByClass(classId: number) {
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: { classId },
      include: {
        subject: true,
        teacher: true,
      },
      orderBy: [
        { day: 'asc' },
        { slotNumber: 'asc' }
      ]
    });
    return { success: true, data: slots };
  } catch (error: any) {
    console.error("Error fetching timetable:", error);
    return { success: false, error: error.message };
  }
}

export async function updateTimetableSlot(data: TimetableSlotUpdate & { classId?: number, day?: Day, slotNumber?: number }) {
  try {
    if (data.id === -1) {
      // CREATE NEW SLOT
      const created = await prisma.timetableSlot.create({
        data: {
          day: data.day!,
          slotNumber: data.slotNumber!,
          startTime: data.startTime || "08:00 AM",
          endTime: data.endTime || "09:00 AM",
          classId: data.classId!,
          subjectId: data.subjectId,
          teacherId: data.teacherId,
        }
      });
      revalidatePath(`/admin/timetable`);
      return { success: true, data: created };
    }

    const updated = await prisma.timetableSlot.update({
      where: { id: data.id },
      data: {
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });
    
    // Get classId for revalidation
    const slot = await prisma.timetableSlot.findUnique({
      where: { id: data.id },
      select: { classId: true }
    });

    if (slot) {
      revalidatePath(`/admin/timetable`);
    }

    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating timetable slot:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllClasses() {
  try {
    const classes = await prisma.class.findMany({
      include: {
        level: true
      },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: classes };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllSubjectsAndTeachers() {
  try {
    const subjects = await prisma.subject.findMany();
    const teachers = await prisma.teacher.findMany();
    return { success: true, subjects, teachers };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
