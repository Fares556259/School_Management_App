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
  roomId?: number | null;
};

export async function getTimetableByClass(classId: number) {
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: { classId },
      include: {
        subject: true,
        teacher: true,
        room: true,
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
          roomId: data.roomId,
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
        roomId: data.roomId,
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

export async function moveTimetableSlot(slotId: number, targetDay: Day, targetSlotNumber: number) {
  try {
    const sourceSlot = await prisma.timetableSlot.findUnique({
      where: { id: slotId },
    });

    if (!sourceSlot) return { success: false, error: "Source slot not found" };

    // Check if target slot is occupied
    const targetOccupied = await prisma.timetableSlot.findUnique({
      where: {
        classId_day_slotNumber: {
          classId: sourceSlot.classId,
          day: targetDay,
          slotNumber: targetSlotNumber,
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      if (targetOccupied) {
        // SWAP: Move target occupied slot to source position
        // Temporary set to negative ID or use update to avoid unique constraint mismatch mid-transaction
        // Actually, we can just delete and recreate or update Source first with target data
        
        // 1. Clear target location temporarily (we have sourceSlot data in memory)
        // No need, we can just update them in two steps if we handle the unique constraint carefully
        // But Prisma handles transactions well.
        
        await tx.timetableSlot.update({
          where: { id: targetOccupied.id },
          data: { slotNumber: -1 }, // Move to limbo
        });

        await tx.timetableSlot.update({
          where: { id: sourceSlot.id },
          data: {
            day: targetDay,
            slotNumber: targetSlotNumber,
          },
        });

        await tx.timetableSlot.update({
          where: { id: targetOccupied.id },
          data: {
            day: sourceSlot.day,
            slotNumber: sourceSlot.slotNumber,
          },
        });
      } else {
        // SIMPLE MOVE
        await tx.timetableSlot.update({
          where: { id: sourceSlot.id },
          data: {
            day: targetDay,
            slotNumber: targetSlotNumber,
          },
        });
      }
    });

    revalidatePath(`/admin/timetable`);
    return { success: true };
  } catch (error: any) {
    console.error("Error moving timetable slot:", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTimetableSlot(id: number) {
  try {
    const slot = await prisma.timetableSlot.findUnique({
      where: { id },
      select: { classId: true }
    });
    
    await prisma.timetableSlot.delete({
      where: { id }
    });
    
    if (slot) {
      revalidatePath(`/admin/timetable`);
    }
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting timetable slot:", error);
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateTimetableSlots(classId: number, slots: any[]) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete all existing slots for this class
      await tx.timetableSlot.deleteMany({
        where: { classId }
      });

      // 2. Create new slots
      const dataToCreate = slots.map(slot => ({
        day: slot.day,
        startTime: slot.startTime,
        endTime: slot.endTime,
        slotNumber: slot.slotNumber,
        subjectId: slot.subjectId,
        teacherId: slot.teacherId,
        classId: classId,
      }));

      await tx.timetableSlot.createMany({
        data: dataToCreate
      });
    });

    revalidatePath(`/admin/timetable`);
    return { success: true };
  } catch (error: any) {
    console.error("Bulk update error:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllRooms() {
  try {
    const rooms = await prisma.room.findMany({
      where: { schoolId: "default_school" },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: rooms };
  } catch (error: any) {
    console.error("Error fetching all rooms:", error);
    return { success: false, error: error.message };
  }
}
