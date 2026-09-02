"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { invalidateTenantTags } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";

export type TimetableSlotUpdate = {
  id: number;
  subjectId?: number | null;
  teacherId?: string | null;
  startTime?: string;
  endTime?: string;
  roomId?: number | null;
  duration?: number; // minutes: 60, 90, or 120
  groupId?: number;
};

// Adds minutes to a "HH:MM" string, returns "HH:MM"
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

// Recalculates startTime/endTime for all slots in a class+day based on their
// slotNumber order and each slot's duration, starting from the school dayStartTime.
export async function recalculateSlotTimes(classId: number, day: Day, isDraft: boolean = false) {
  const schoolId = await getSchoolId();
  const institution = await prisma.institution.findFirst({
    where: { schoolId },
    select: { dayStartTime: true }
  });
  const dayStart = (institution as any)?.dayStartTime || "08:00";

  const slots = await prisma.timetableSlot.findMany({
    where: { classId, day, isDraft },
    orderBy: { slotNumber: "asc" }
  });

  let cursor = dayStart;
  for (const slot of slots) {
    const dur = slot.duration || 120;
    const newStart = cursor;
    const newEnd = addMinutes(cursor, dur);
    await prisma.timetableSlot.update({
      where: { id: slot.id },
      data: { startTime: newStart, endTime: newEnd }
    });
    cursor = newEnd;
  }
}

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
    const schoolId = await getSchoolId();
    const isDraft = data.isDraft || false;

    if (data.id === -1) {
      // CREATE NEW SLOT
      const existingSlots = await prisma.timetableSlot.findMany({
        where: { classId: data.classId!, day: data.day!, isDraft },
        orderBy: { slotNumber: "asc" }
      });
      const nextSlotNumber = data.slotNumber !== undefined ? Number(data.slotNumber) : (existingSlots.length + 1);
      
      // Calculate next groupId to prevent constraint violations when adding to an existing slot block
      const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
      const nextGroupId = data.groupId !== undefined ? data.groupId : (existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1);
      const duration = data.duration || 120;

      // Calculate start/end from previous slot's endTime or school dayStartTime
      const institution = await prisma.institution.findFirst({
        where: { schoolId },
        select: { dayStartTime: true, dayEndTime: true }
      });
      const dayStart = (institution as any)?.dayStartTime || "08:00";
      const dayEnd = (institution as any)?.dayEndTime || "14:00";

      // Find the last slot in this day to cascade from
      const prevSlot = existingSlots[existingSlots.length - 1];
      const slotStart = prevSlot ? prevSlot.endTime : dayStart;
      const slotEnd = addMinutes(slotStart, duration);

      // Block if slot would exceed school day end
      const [eH, eM] = dayEnd.split(":").map(Number);
      const actualSlotEnd = data.endTime || slotEnd;
      const [sH, sM] = actualSlotEnd.split(":").map(Number);
      if (sH * 60 + sM > eH * 60 + eM) {
        return { success: false, error: `Dépasse la fin de journée (${dayEnd}). Réduisez la durée ou supprimez d'autres créneaux.` };
      }

      const created = await prisma.timetableSlot.create({
        data: {
          day: data.day!,
          slotNumber: nextSlotNumber,
          startTime: data.startTime || slotStart,
          endTime: data.endTime || slotEnd,
          duration,
          classId: data.classId!,
          schoolId,
          subjectId: data.subjectId,
          teacherId: data.teacherId,
          roomId: data.roomId,
          isDraft,
        }
      });
      revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
      return { success: true, data: created };
    }

    // UPDATE existing slot
    const updatePayload: any = {
      subjectId: data.subjectId,
      teacherId: data.teacherId,
      roomId: data.roomId,
    };
    if (data.duration !== undefined) {
      updatePayload.duration = data.duration;
      // Recalculate end time based on new duration
      const existing = await prisma.timetableSlot.findUnique({ where: { id: data.id } });
      if (existing) {
        updatePayload.endTime = addMinutes(existing.startTime, data.duration);
        // Also cascade to subsequent slots on the same day
        await prisma.timetableSlot.update({ where: { id: data.id }, data: updatePayload });
        await recalculateSlotTimes(existing.classId, existing.day, existing.isDraft);
        revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
        return { success: true };
      }
    }
    if (data.startTime) updatePayload.startTime = data.startTime;
    if (data.endTime) updatePayload.endTime = data.endTime;

    const updated = await prisma.timetableSlot.update({
      where: { id: data.id },
      data: updatePayload,
    });
    revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating timetable slot:", error);
    return { success: false, error: error.message + ` | classId=${data.classId}, day=${data.day}` };
  }
}

export async function getAllClasses(tenantId?: string) {

  try {
    const schoolId = tenantId || await getSchoolId();
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

export async function getAllSubjectsAndTeachers(tenantId?: string) {
  try {
    const schoolId = tenantId || await getSchoolId();
    const subjects = await prisma.subject.findMany({ where: { schoolId, parentId: null } });
    const teachers = await prisma.teacher.findMany({ 
      where: { schoolId },
      include: {
        classes: { select: { id: true } },
        subjects: { select: { id: true } }
      }
    });
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

    // Find all slots in the source group
    const sourceSlots = await prisma.timetableSlot.findMany({
      where: {
        classId: sourceSlot.classId,
        day: sourceSlot.day,
        slotNumber: sourceSlot.slotNumber,
        isDraft: sourceSlot.isDraft,
      },
    });

    // Check if target slot is occupied by any group
    const targetOccupied = await prisma.timetableSlot.findMany({
      where: {
        classId: sourceSlot.classId,
        day: targetDay,
        slotNumber: targetSlotNumber,
        isDraft: sourceSlot.isDraft,
      },
    });

    await prisma.$transaction(async (tx) => {
      if (targetOccupied.length > 0) {
        // SWAP: Move target occupied slots to limbo first
        await tx.timetableSlot.updateMany({
          where: { id: { in: targetOccupied.map(t => t.id) } },
          data: { slotNumber: -1 }, // Move to limbo
        });

        // Move source slots to target
        await tx.timetableSlot.updateMany({
          where: { id: { in: sourceSlots.map(s => s.id) } },
          data: {
            day: targetDay,
            slotNumber: targetSlotNumber,
          },
        });

        // Move target slots to source
        await tx.timetableSlot.updateMany({
          where: { id: { in: targetOccupied.map(t => t.id) } },
          data: {
            day: sourceSlot.day,
            slotNumber: sourceSlot.slotNumber,
          },
        });
      } else {
        // SIMPLE MOVE
        await tx.timetableSlot.updateMany({
          where: { id: { in: sourceSlots.map(s => s.id) } },
          data: {
            day: targetDay,
            slotNumber: targetSlotNumber,
          },
        });
      }
    });

    await recalculateSlotTimes(sourceSlot.classId, sourceSlot.day, sourceSlot.isDraft);
    if (sourceSlot.day !== targetDay) {
      await recalculateSlotTimes(sourceSlot.classId, targetDay, sourceSlot.isDraft);
    }
    
    revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
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
      select: { classId: true, day: true, isDraft: true }
    });
    
    await prisma.timetableSlot.delete({
      where: { id }
    });
    
    if (slot) {
      await recalculateSlotTimes(slot.classId, slot.day, slot.isDraft);
      revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
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

    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true }
    });
    if (!classInfo) return { success: false, error: "Class not found" };
    
    const schoolId = classInfo.schoolId;
    const daysToRecalc = new Set<Day>();

    await prisma.$transaction(async (tx) => {
      await tx.timetableSlot.deleteMany({
        where: { classId, isDraft }
      });

      const dataToCreate = slots
        .map(slot => {
          const subId = Number(slot.subjectId);
          if (!subId || isNaN(subId)) return null;
          const d = String(slot.day || "MONDAY").toUpperCase() as Day;
          daysToRecalc.add(d);
          return {
            day: d,
            startTime: "08:00", // Will be recalculated
            endTime: "10:00",
            duration: Number(slot.duration) || 120,
            slotNumber: Number(slot.slotNumber) || 1,
            subjectId: subId,
            teacherId: slot.teacherId ? String(slot.teacherId) : null,
            classId: classId,
            schoolId: schoolId,
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

    for (const d of Array.from(daysToRecalc)) {
      await recalculateSlotTimes(classId, d, isDraft);
    }

    revalidatePath(`/admin/timetable`);
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
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
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
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
      try { const sId = await getSchoolId(); invalidateTenantTags(sId, "classes"); } catch(e) {}
    return { success: true };
  } catch (error: any) {
    console.error("Discard draft error:", error);
    return { success: false, error: error.message };
  }
}

export async function getAllRooms(tenantId?: string) {
  try {
    const schoolId = tenantId || await getSchoolId();
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

export async function getAllActiveTimetableSlots(tenantId?: string) {
  try {
    const schoolId = tenantId || await getSchoolId();
    // Fetch all class IDs for this school first
    const classes = await prisma.class.findMany({
      where: { schoolId },
      select: { id: true }
    });
    const classIds = classes.map(c => c.id);

    const slots = await prisma.timetableSlot.findMany({
      where: { 
        classId: { in: classIds },
        isDraft: false 
      },
      include: {
        subject: true,
        teacher: true,
        room: true,
      },
    });
    return { success: true, data: slots };
  } catch (error: any) {
    console.error("Error fetching all active slots:", error);
    return { success: false, error: error.message };
  }
}
