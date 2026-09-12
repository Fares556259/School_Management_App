import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import {
  resolveClassByName,
  resolveSubjectByName,
  resolveTeacherByName,
  resolveRoomByName,
  resolveDayOfWeek,
} from "./entityResolvers";

/**
 * Tool: get_class_timetable
 * Returns class schedule for a specific day or whole week.
 */
export async function getClassTimetableTool(
  args: {
    className: string;
    day?: string; // "lundi", "mardi", "vendredi", "today", "اليوم", etc.
  },
  context: ToolContext
) {
  const targetClass = await resolveClassByName(context.schoolId, args.className);

  if (!targetClass) {
    return { found: false, message: `Classe "${args.className}" introuvable.` };
  }

  const where: any = {
    classId: targetClass.id,
    isDraft: false,
  };

  if (args.day) {
    const { dayEnum } = resolveDayOfWeek(args.day);
    if (dayEnum) {
      where.day = dayEnum;
    }
  }

  const slots = await prisma.timetableSlot.findMany({
    where,
    orderBy: [{ day: "asc" }, { slotNumber: "asc" }],
    include: {
      subject: { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
      room: { select: { name: true } },
    },
  });

  const dayLabels: Record<string, string> = {
    MONDAY: "Lundi",
    TUESDAY: "Mardi",
    WEDNESDAY: "Mercredi",
    THURSDAY: "Jeudi",
    FRIDAY: "Vendredi",
    SATURDAY: "Samedi",
  };

  return {
    found: true,
    class: targetClass.name,
    totalSessions: slots.length,
    schedule: slots.map((s) => ({
      day: dayLabels[s.day] || s.day,
      time: `${s.startTime} - ${s.endTime}`,
      subject: s.subject?.name || "Non assigné",
      teacher: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Non assigné",
      room: s.room?.name || null,
    })),
  };
}

/**
 * Tool: find_available_teachers
 * Emergency substitute finder! Finds teachers who are completely free
 * on a given day and time slot (optionally matching a specific subject).
 */
export async function findAvailableTeachersTool(
  args: {
    day: string; // e.g. "mardi", "today", "اليوم"
    timeSlot: string; // e.g. "10:00" or "10:00 - 12:00"
    subjectName?: string;
  },
  context: ToolContext
) {
  const { dayEnum, displayDay } = resolveDayOfWeek(args.day);
  const searchTime = args.timeSlot.trim().slice(0, 5); // "10:00"

  // 1. Get all slots on this day that overlap with searchTime
  const busySlots = await prisma.timetableSlot.findMany({
    where: {
      isDraft: false,
      day: dayEnum,
      startTime: { lte: searchTime },
      endTime: { gt: searchTime },
    },
    select: { teacherId: true },
  });

  const busyTeacherIds = new Set(busySlots.map((s) => s.teacherId).filter(Boolean));

  // 2. Query available teachers
  const whereTeacher: any = {
    schoolId: context.schoolId,
    id: { notIn: Array.from(busyTeacherIds) as string[] },
  };

  if (args.subjectName) {
    const resolvedSub = await resolveSubjectByName(context.schoolId, args.subjectName);
    if (resolvedSub) {
      whereTeacher.subjects = {
        some: { id: resolvedSub.id },
      };
    } else {
      whereTeacher.subjects = {
        some: { name: { contains: args.subjectName.trim(), mode: "insensitive" } },
      };
    }
  }

  const availableTeachers = await prisma.teacher.findMany({
    where: whereTeacher,
    take: 10,
    include: {
      subjects: { select: { name: true } },
    },
  });

  return {
    day: displayDay,
    time: searchTime,
    subjectFilter: args.subjectName || "Toutes matières",
    availableCount: availableTeachers.length,
    availableTeachers: availableTeachers.map((t) => ({
      name: `${t.name} ${t.surname}`,
      phone: t.phone || "Non renseigné",
      subjects: t.subjects.map((s) => s.name).join(", "),
    })),
  };
}

/**
 * Tool: add_timetable_slot
 * Adds a session slot for a class timetable.
 */
export async function addTimetableSlotTool(
  args: {
    className: string;
    subjectName: string;
    teacherName: string;
    day: string;
    startTime: string; // "08:00"
    endTime: string; // "10:00"
    room?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const { dayEnum, displayDay } = resolveDayOfWeek(args.day);

  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: `Classe introuvable` };
  }

  const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
  if (!subject) {
    return { success: false, message: `Matière "${args.subjectName}" introuvable.`, summary: `Matière introuvable` };
  }

  const teacher = await resolveTeacherByName(context.schoolId, args.teacherName);
  if (!teacher) {
    return { success: false, message: `Enseignant "${args.teacherName}" introuvable.`, summary: `Enseignant introuvable` };
  }

  // Calculate duration dynamically from startTime and endTime
  let duration = 120;
  if (args.startTime && args.endTime) {
    const [startH, startM] = args.startTime.split(":").map(Number);
    const [endH, endM] = args.endTime.split(":").map(Number);
    if (!isNaN(startH) && !isNaN(endH)) {
      const diff = endH * 60 + (endM || 0) - (startH * 60 + (startM || 0));
      if (diff > 0) duration = diff;
    }
  }

  let roomId: number | undefined = undefined;
  if (args.room) {
    const r = await resolveRoomByName(context.schoolId, args.room);
    if (r) roomId = r.id;
  }

  // Get next slot number
  const existingCount = await prisma.timetableSlot.count({
    where: { classId: targetClass.id, day: dayEnum, isDraft: false },
  });

  const slot = await prisma.$transaction(async (tx) => {
    const s = await tx.timetableSlot.create({
      data: {
        classId: targetClass.id,
        subjectId: subject.id,
        teacherId: teacher.id,
        day: dayEnum,
        startTime: args.startTime,
        endTime: args.endTime,
        duration,
        slotNumber: existingCount + 1,
        roomId,
        isDraft: false,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "TimetableSlot",
        entityId: s.id.toString(),
        description: `[Hnia AI Telegram] Ajout séance : ${targetClass.name} - ${subject.name} (${teacher.name} ${teacher.surname}) le ${displayDay} à ${args.startTime}`,
        schoolId: context.schoolId,
      },
    });

    return s;
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  const roomLabel = args.room ? ` en **${args.room}**` : "";
  return {
    success: true,
    message: `✅ Séance ajoutée avec succès : **${subject.name}** pour la classe **${targetClass.name}** avec **${teacher.name} ${teacher.surname}** le **${displayDay}** de ${args.startTime} à ${args.endTime}${roomLabel}.`,
    summary: `Ajout séance ${subject.name} (${targetClass.name})`,
    data: { slotId: slot.id },
  };
}
