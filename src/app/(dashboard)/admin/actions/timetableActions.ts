"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";

export type TimetableSlotUpdate = {
  id: number;
  subjectId?: number | null;
  teacherId?: string | null;
  startTime?: string;
  endTime?: string;
  roomId?: number | null;
};

export async function getTimetableByClass(classId: number, isDraft: boolean = false) {
  try {
    const slots = await prisma.timetableSlot.findMany({
      where: { classId, isDraft },
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

export async function updateTimetableSlot(data: TimetableSlotUpdate & { classId?: number, day?: Day, slotNumber?: number, isDraft?: boolean }) {
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
          isDraft: data.isDraft || false,
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
    const schoolId = await getSchoolId();
    const classes = await prisma.class.findMany({
      where: { schoolId },
      include: { level: true },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: classes };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllSubjectsAndTeachers() {
  try {
    const schoolId = await getSchoolId();
    const subjects = await prisma.subject.findMany({ where: { schoolId } });
    const teachers = await prisma.teacher.findMany({ where: { schoolId } });
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
        classId_day_slotNumber_isDraft: {
          classId: sourceSlot.classId,
          day: targetDay,
          slotNumber: targetSlotNumber,
          isDraft: sourceSlot.isDraft,
        },
      },
    });

    await prisma.$transaction(async (tx) => {
      if (targetOccupied) {
        // SWAP: Move target occupied slot to source position
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

export async function bulkUpdateTimetableSlots(classId: number, slots: any[], isDraft: boolean = false) {
  try {
    if (!classId) return { success: false, error: "Class ID is required" };
    if (!Array.isArray(slots) || slots.length === 0) {
      return { success: false, error: "No slots generated to save." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({
        where: { classId, isDraft }
      });

      const dataToCreate = slots
        .map(slot => {
          const subId = Number(slot.subjectId);
          if (!subId || isNaN(subId)) return null;
          return {
            day: String(slot.day || "MONDAY").toUpperCase() as Day,
            startTime: slot.startTime || "08:00 AM",
            endTime: slot.endTime || "09:00 AM",
            slotNumber: Number(slot.slotNumber) || 1,
            subjectId: subId,
            teacherId: slot.teacherId ? String(slot.teacherId) : null,
            classId: classId,
            isDraft: isDraft,
          };
        })
        .filter(Boolean) as any[];

      if (dataToCreate.length > 0) {
        await tx.timetableSlot.createMany({
          data: dataToCreate
        });
      }
    });

    revalidatePath(`/admin/timetable`);
    revalidatePath(`/list/exams`);
    return { success: true };
  } catch (error: any) {
    console.error("Bulk update error:", error);
    return { success: false, error: error.message || "Failed to save timetable slots." };
  }
}

export async function publishDraftTimetable(classId: number) {
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete currently published slots
      await tx.timetableSlot.deleteMany({
        where: { classId, isDraft: false }
      });

      // 2. Get drafts
      const drafts = await tx.timetableSlot.findMany({
        where: { classId, isDraft: true }
      });

      // 3. Clone draft to published
      if (drafts.length > 0) {
        const publishedData = drafts.map(slot => ({
          day: slot.day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          slotNumber: slot.slotNumber,
          subjectId: slot.subjectId,
          teacherId: slot.teacherId,
          roomId: slot.roomId,
          schoolId: slot.schoolId,
          classId: slot.classId,
          isDraft: false,
        }));

        await tx.timetableSlot.createMany({
          data: publishedData
        });
      }

      // 4. Delete drafts
      await tx.timetableSlot.deleteMany({
        where: { classId, isDraft: true }
      });
    });

    revalidatePath(`/admin/timetable`);
    return { success: true };
  } catch (error: any) {
    console.error("Publish draft error:", error);
    return { success: false, error: error.message };
  }
}

export async function discardDraftTimetable(classId: number) {
  try {
    await prisma.timetableSlot.deleteMany({
      where: { classId, isDraft: true }
    });

    revalidatePath(`/admin/timetable`);
    return { success: true };
  } catch (error: any) {
    console.error("Discard draft error:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllRooms() {
  try {
    const schoolId = await getSchoolId();
    const rooms = await prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: 'asc' }
    });
    return { success: true, data: rooms };
  } catch (error: any) {
    console.error("Error fetching all rooms:", error);
    return { success: false, error: error.message };
  }
}
