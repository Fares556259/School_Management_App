"use server";

import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { invalidateTenantTags } from "@/lib/cache";
import { getSchoolId } from "@/lib/school";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { saveTimetableBlock, removeTimetableBlock, relocateTimetableBlock, TimetableEditError, TimetableBlockInput, publishTimetableDraft, replaceTimetableWeek } from "@/lib/timetableEditor";

async function getEditorSchoolId() {
  const schoolId = await getSchoolId();
  const user = await getAuthenticatedUser();
  const admin = user && await prisma.admin.findFirst({ where: { id: user.id, schoolId, status: "active" }, select: { id: true } });
  if (!admin) throw new TimetableEditError("notAuthorized");
  return schoolId;
}

function editFailure(error: unknown) {
  if (error instanceof TimetableEditError) return { success: false as const, error: error.code, code: error.code, conflicts: error.conflicts };
  console.error("Timetable edit failed:", error);
  return { success: false as const, error: "saveFailed", code: "saveFailed", conflicts: [] };
}

function refreshTimetable(schoolId: string) {
  revalidatePath("/admin/timetable");
  invalidateTenantTags(schoolId, "classes");
}

export async function saveTimetableSession(data: TimetableBlockInput) {
  try {
    const schoolId = await getEditorSchoolId();
    const slots = await saveTimetableBlock(prisma, schoolId, data);
    refreshTimetable(schoolId);
    return { success: true as const, slots };
  } catch (error) { return editFailure(error); }
}

export async function deleteTimetableSession(id: number) {
  try {
    const schoolId = await getEditorSchoolId();
    await removeTimetableBlock(prisma, schoolId, id);
    refreshTimetable(schoolId);
    return { success: true as const };
  } catch (error) { return editFailure(error); }
}

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

export async function getTimetableByClass(classId: number, isDraft: boolean = false) {
  try {
    const schoolId = await getSchoolId();
    const slots = await prisma.timetableSlot.findMany({
      where: { schoolId, classId, isDraft },
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
    const schoolId = await getEditorSchoolId();
    const existing = data.id > 0 ? await prisma.timetableSlot.findFirst({ where: { id: data.id, schoolId } }) : null;
    if (data.id > 0 && !existing) throw new TimetableEditError("sessionNotFound");
    const slots = await saveTimetableBlock(prisma, schoolId, {
      id: existing?.id, classId: existing?.classId || data.classId!, day: existing?.day || data.day!,
      isDraft: existing?.isDraft || data.isDraft || false,
      startTime: data.startTime || existing?.startTime || "08:00",
      duration: data.duration || existing?.duration || 120,
      sessions: [{ id: existing?.id, subjectId: data.subjectId === undefined ? existing?.subjectId ?? null : data.subjectId,
        teacherId: data.teacherId === undefined ? existing?.teacherId : data.teacherId,
        roomId: data.roomId === undefined ? existing?.roomId : data.roomId }],
    }, false);
    refreshTimetable(schoolId);
    return { success: true, data: slots.find(s => s.id === existing?.id) || slots[0] };
  } catch (error) { return editFailure(error); }
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

export async function moveTimetableSlot(slotId: number, targetDay: Day, targetSlotNumber: number, startTime?: string) {
  try {
    const schoolId = await getEditorSchoolId();
    await relocateTimetableBlock(prisma, schoolId, slotId, targetDay, targetSlotNumber, startTime);
    refreshTimetable(schoolId);
    return { success: true as const };
  } catch (error) { return editFailure(error); }
}

export async function deleteTimetableSlot(id: number) {
  try {
    const schoolId = await getEditorSchoolId();
    await removeTimetableBlock(prisma, schoolId, id, false);
    refreshTimetable(schoolId);
    return { success: true as const };
  } catch (error) { return editFailure(error); }
}

export async function bulkUpdateTimetableSlots(classId: number, slots: any[], isDraft: boolean = false) {
  try {
    const schoolId = await getEditorSchoolId();
    await replaceTimetableWeek(prisma, schoolId, classId, slots, isDraft);
    refreshTimetable(schoolId);
    revalidatePath("/list/exams");
    return { success: true as const };
  } catch (error) { return editFailure(error); }
}

export async function publishDraftTimetable(classId: number) {
  try {
    const schoolId = await getEditorSchoolId();
    await publishTimetableDraft(prisma, schoolId, classId);
    refreshTimetable(schoolId);
    return { success: true as const };
  } catch (error) { return editFailure(error); }
}

export async function discardDraftTimetable(classId: number) {
  try {
    const schoolId = await getEditorSchoolId();
    await prisma.timetableSlot.deleteMany({
      where: { schoolId, classId, isDraft: true }
    });

    refreshTimetable(schoolId);
    return { success: true as const };
  } catch (error) { return editFailure(error); }
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
