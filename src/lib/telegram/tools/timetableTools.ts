import prisma from "@/lib/prisma";
import { Day } from "@prisma/client";
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

export const DAY_LABELS: Record<Day, string> = {
  MONDAY: "Lundi",
  TUESDAY: "Mardi",
  WEDNESDAY: "Mercredi",
  THURSDAY: "Jeudi",
  FRIDAY: "Vendredi",
  SATURDAY: "Samedi",
};

export const ALL_DAYS: Day[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
];

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + minutes;
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function slotsOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return timeToMinutes(start1) < timeToMinutes(end2) && timeToMinutes(end1) > timeToMinutes(start2);
}

/**
 * Parses natural language scheduling constraints.
 * Supports French, Arabic, Derja, and English keywords.
 */
export function parseSchedulingConstraints(constraintsText?: string, preferredDay?: string) {
  const clean = (constraintsText || "").toLowerCase().trim();
  const forbiddenDays = new Set<Day>();
  const preferredDays = new Set<Day>();
  let timeWindow: "any" | "morning" | "afternoon" = "any";

  if (preferredDay) {
    const { dayEnum } = resolveDayOfWeek(preferredDay);
    if (dayEnum) preferredDays.add(dayEnum);
  }

  // Day exclusions
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(lundi|monday|tnin)/i.test(clean)) {
    forbiddenDays.add("MONDAY");
  }
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(mardi|tuesday|tlat)/i.test(clean)) {
    forbiddenDays.add("TUESDAY");
  }
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(mercredi|wednesday|erbaa|arbaa)/i.test(clean)) {
    forbiddenDays.add("WEDNESDAY");
  }
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(jeudi|thursday|khmis)/i.test(clean)) {
    forbiddenDays.add("THURSDAY");
  }
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(vendredi|friday|jom3a|jomaa)/i.test(clean)) {
    forbiddenDays.add("FRIDAY");
  }
  if (/(\bpas\b|\bsauf\b|\bsans\b|\bexclu\b|\bnon\b|\bno\b|\bmouch\b|\bla\b).*?(samedi|saturday|sebt)/i.test(clean)) {
    forbiddenDays.add("SATURDAY");
  }

  // Preferences
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(lundi|monday)/i.test(clean)) preferredDays.add("MONDAY");
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(mardi|tuesday)/i.test(clean)) preferredDays.add("TUESDAY");
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(mercredi|wednesday)/i.test(clean)) preferredDays.add("WEDNESDAY");
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(jeudi|thursday)/i.test(clean)) preferredDays.add("THURSDAY");
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(vendredi|friday)/i.test(clean)) preferredDays.add("FRIDAY");
  if (/(de préférence|plutôt|prefere|prefer|idealement|nhar).*?(samedi|saturday)/i.test(clean)) preferredDays.add("SATURDAY");

  // Time window constraints
  if (/(\bmatin\b|\bmorning\b|\bsbah\b|\bavant\s+12\b|\bavant\s+midi\b)/i.test(clean) && !/pas\s+(le\s+)?matin/i.test(clean)) {
    timeWindow = "morning";
  } else if (/(\baprès[- ]midi\b|\bapres[- ]midi\b|\bafternoon\b|\baprès\s+12\b|\baprès\s+midi\b|\bbaad\b)/i.test(clean) && !/pas\s+(l[' ])?après[- ]midi/i.test(clean)) {
    timeWindow = "afternoon";
  }

  if (/pas\s+(le\s+)?matin/i.test(clean)) timeWindow = "afternoon";
  if (/pas\s+(l[' ])?après[- ]midi/i.test(clean)) timeWindow = "morning";

  return { forbiddenDays, preferredDays, timeWindow };
}

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
  // Parse the time range: supports both "10:00" and "10:00 - 12:00" formats
  const parts = args.timeSlot.split("-").map((s) => s.trim());
  const searchStart = parts[0].slice(0, 5); // "10:00"
  const searchEnd = parts.length > 1 ? parts[1].slice(0, 5) : null; // "12:00" if provided

  // 1. Get all slots on this day that OVERLAP with the requested time range.
  // Overlap condition: slot.startTime < requestedEnd AND slot.endTime > requestedStart
  const busySlots = await prisma.timetableSlot.findMany({
    where: {
      isDraft: false,
      day: dayEnum,
      // A slot overlaps if it starts before the end of our window AND ends after the start
      startTime: searchEnd ? { lt: searchEnd } : { lte: searchStart },
      endTime: { gt: searchStart },
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
    time: searchEnd ? `${searchStart} - ${searchEnd}` : searchStart,
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

  // Check for teacher scheduling conflict on this day/time
  const teacherConflict = await prisma.timetableSlot.findFirst({
    where: {
      isDraft: false,
      teacherId: teacher.id,
      day: dayEnum,
      startTime: { lt: args.endTime },
      endTime: { gt: args.startTime },
    },
    include: { class: { select: { name: true } }, subject: { select: { name: true } } },
  });

  if (teacherConflict) {
    return {
      success: false,
      message: `⚠️ Conflit d'emploi du temps : <b>${teacher.name} ${teacher.surname}</b> a déjà cours de <code>${teacherConflict.startTime}</code> à <code>${teacherConflict.endTime}</code> en <b>${(teacherConflict as any).class?.name || "une autre classe"}</b> le <b>${displayDay}</b>. Veuillez choisir un autre créneau ou un autre enseignant.`,
      summary: `Conflit horaire enseignant`,
    };
  }

  // Check for class scheduling conflict on this day/time
  const classConflict = await prisma.timetableSlot.findFirst({
    where: {
      isDraft: false,
      classId: targetClass.id,
      day: dayEnum,
      startTime: { lt: args.endTime },
      endTime: { gt: args.startTime },
    },
    include: { subject: { select: { name: true } }, teacher: { select: { name: true, surname: true } } },
  });

  if (classConflict) {
    return {
      success: false,
      message: `⚠️ Conflit d'emploi du temps : la classe <b>${targetClass.name}</b> a déjà <b>${(classConflict as any).subject?.name || "un cours"}</b> de <code>${classConflict.startTime}</code> à <code>${classConflict.endTime}</code> le <b>${displayDay}</b>. Veuillez choisir un autre créneau.`,
      summary: `Conflit horaire classe`,
    };
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

/**
 * Tool: get_teacher_timetable
 * Returns a teacher's schedule across all their classes for a day or whole week.
 */
export async function getTeacherTimetableTool(
  args: {
    teacherName: string;
    day?: string;
  },
  context: ToolContext
) {
  const teacher = await resolveTeacherByName(context.schoolId, args.teacherName);
  if (!teacher) {
    return { found: false, message: `Enseignant "${args.teacherName}" introuvable.` };
  }

  const where: any = {
    teacherId: teacher.id,
    schoolId: context.schoolId,
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
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      room: { select: { name: true } },
    },
  });

  const totalDurationMinutes = slots.reduce((acc, s) => acc + (s.duration || 120), 0);
  const totalHours = Math.round((totalDurationMinutes / 60) * 10) / 10;

  return {
    found: true,
    teacher: `${teacher.name} ${teacher.surname}`,
    phone: teacher.phone || "Non renseigné",
    filterDay: args.day || "Toute la semaine",
    totalSessions: slots.length,
    totalWeeklyHours: totalHours,
    schedule: slots.map((s) => ({
      slotId: s.id,
      day: DAY_LABELS[s.day] || s.day,
      time: `${s.startTime} - ${s.endTime}`,
      duration: `${s.duration || 120} min`,
      className: s.class?.name || "Non assigné",
      subject: s.subject?.name || "Non assigné",
      room: s.room?.name || null,
    })),
  };
}

/**
 * Tool: get_timetable_conflicts
 * Scans the school's published schedule for any teacher, room, or class double-bookings.
 */
export async function getTimetableConflictsTool(
  args: {
    className?: string;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
    isDraft: false,
  };

  if (args.className) {
    const targetClass = await resolveClassByName(context.schoolId, args.className);
    if (targetClass) where.classId = targetClass.id;
  }

  const allSlots = await prisma.timetableSlot.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      teacher: { select: { id: true, name: true, surname: true } },
      room: { select: { id: true, name: true } },
      subject: { select: { name: true } },
    },
    orderBy: [{ day: "asc" }, { startTime: "asc" }],
  });

  const conflicts: Array<{
    type: "TEACHER_CONFLICT" | "ROOM_CONFLICT" | "CLASS_CONFLICT";
    day: string;
    time: string;
    description: string;
    slot1: any;
    slot2: any;
  }> = [];

  for (let i = 0; i < allSlots.length; i++) {
    for (let j = i + 1; j < allSlots.length; j++) {
      const s1 = allSlots[i];
      const s2 = allSlots[j];

      if (s1.day !== s2.day) continue;
      if (!slotsOverlap(s1.startTime, s1.endTime, s2.startTime, s2.endTime)) continue;

      // 1. Teacher double-booking
      if (s1.teacherId && s2.teacherId && s1.teacherId === s2.teacherId) {
        conflicts.push({
          type: "TEACHER_CONFLICT",
          day: DAY_LABELS[s1.day] || s1.day,
          time: `${s1.startTime} - ${s1.endTime} / ${s2.startTime} - ${s2.endTime}`,
          description: `L'enseignant(e) ${s1.teacher?.name} ${s1.teacher?.surname} est programmé(e) en même temps en ${s1.class?.name} (${s1.subject?.name}) et en ${s2.class?.name} (${s2.subject?.name}).`,
          slot1: { id: s1.id, class: s1.class?.name, subject: s1.subject?.name },
          slot2: { id: s2.id, class: s2.class?.name, subject: s2.subject?.name },
        });
      }

      // 2. Room double-booking
      if (s1.roomId && s2.roomId && s1.roomId === s2.roomId) {
        conflicts.push({
          type: "ROOM_CONFLICT",
          day: DAY_LABELS[s1.day] || s1.day,
          time: `${s1.startTime} - ${s1.endTime}`,
          description: `La salle ${s1.room?.name} est réservée en même temps pour ${s1.class?.name} et ${s2.class?.name}.`,
          slot1: { id: s1.id, class: s1.class?.name, subject: s1.subject?.name },
          slot2: { id: s2.id, class: s2.class?.name, subject: s2.subject?.name },
        });
      }

      // 3. Class double-booking
      if (s1.classId === s2.classId && s1.groupId === s2.groupId) {
        conflicts.push({
          type: "CLASS_CONFLICT",
          day: DAY_LABELS[s1.day] || s1.day,
          time: `${s1.startTime} - ${s1.endTime}`,
          description: `La classe ${s1.class?.name} a deux cours superposés : ${s1.subject?.name} et ${s2.subject?.name}.`,
          slot1: { id: s1.id, subject: s1.subject?.name },
          slot2: { id: s2.id, subject: s2.subject?.name },
        });
      }
    }
  }

  return {
    clean: conflicts.length === 0,
    totalConflicts: conflicts.length,
    message:
      conflicts.length === 0
        ? "✅ Aucun conflit détecté dans l'emploi du temps."
        : `⚠️ ${conflicts.length} conflit(s) détecté(s) dans l'emploi du temps.`,
    conflicts,
  };
}

/**
 * Tool: reschedule_timetable_slot
 * Moves a scheduled class session to a new day and/or time window with full conflict checks.
 */
export async function rescheduleTimetableSlotTool(
  args: {
    className: string;
    subjectName: string;
    currentDay: string;
    targetDay: string;
    newStartTime: string;
    newEndTime?: string;
    newRoom?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: "Classe introuvable" };
  }

  const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
  if (!subject) {
    return { success: false, message: `Matière "${args.subjectName}" introuvable.`, summary: "Matière introuvable" };
  }

  const { dayEnum: currentDayEnum, displayDay: currentDisplayDay } = resolveDayOfWeek(args.currentDay);
  const { dayEnum: targetDayEnum, displayDay: targetDisplayDay } = resolveDayOfWeek(args.targetDay);

  // Find the slot
  const slot = await prisma.timetableSlot.findFirst({
    where: {
      classId: targetClass.id,
      subjectId: subject.id,
      day: currentDayEnum,
      isDraft: false,
    },
    include: { teacher: true, room: true },
  });

  if (!slot) {
    return {
      success: false,
      message: `Aucun cours de **${subject.name}** trouvé pour la classe **${targetClass.name}** le **${currentDisplayDay}**.`,
      summary: "Séance introuvable",
    };
  }

  const duration = slot.duration || 120;
  const calculatedEndTime = args.newEndTime || addMinutes(args.newStartTime, duration);

  let newRoomId = slot.roomId;
  if (args.newRoom) {
    const r = await resolveRoomByName(context.schoolId, args.newRoom);
    if (r) newRoomId = r.id;
  }

  // Teacher conflict check
  if (slot.teacherId) {
    const teacherConflict = await prisma.timetableSlot.findFirst({
      where: {
        id: { not: slot.id },
        teacherId: slot.teacherId,
        day: targetDayEnum,
        isDraft: false,
        startTime: { lt: calculatedEndTime },
        endTime: { gt: args.newStartTime },
      },
      include: { class: { select: { name: true } } },
    });

    if (teacherConflict) {
      return {
        success: false,
        message: `⚠️ Conflit enseignant : **${slot.teacher?.name} ${slot.teacher?.surname}** a déjà cours le **${targetDisplayDay}** de <code>${teacherConflict.startTime}</code> à <code>${teacherConflict.endTime}</code> avec la classe <b>${teacherConflict.class?.name}</b>.`,
        summary: "Conflit enseignant",
      };
    }
  }

  // Class conflict check
  const classConflict = await prisma.timetableSlot.findFirst({
    where: {
      id: { not: slot.id },
      classId: targetClass.id,
      day: targetDayEnum,
      isDraft: false,
      startTime: { lt: calculatedEndTime },
      endTime: { gt: args.newStartTime },
    },
    include: { subject: { select: { name: true } } },
  });

  if (classConflict) {
    return {
      success: false,
      message: `⚠️ Conflit classe : La classe **${targetClass.name}** a déjà **${classConflict.subject?.name}** le **${targetDisplayDay}** de <code>${classConflict.startTime}</code> à <code>${classConflict.endTime}</code>.`,
      summary: "Conflit classe",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.update({
      where: { id: slot.id },
      data: {
        day: targetDayEnum,
        startTime: args.newStartTime,
        endTime: calculatedEndTime,
        roomId: newRoomId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "TimetableSlot",
        entityId: slot.id.toString(),
        description: `[Hnia AI Telegram] Déplacement séance : ${targetClass.name} - ${subject.name} de ${currentDisplayDay} (${slot.startTime}) vers ${targetDisplayDay} (${args.newStartTime} - ${calculatedEndTime})`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  return {
    success: true,
    message: `✅ Séance déplacée avec succès !\n• Classe : **${targetClass.name}**\n• Matière : **${subject.name}**\n• Nouvel horaire : **${targetDisplayDay}** de <code>${args.newStartTime}</code> à <code>${calculatedEndTime}</code>.`,
    summary: `Déplacement ${subject.name} (${targetClass.name}) vers ${targetDisplayDay}`,
  };
}

/**
 * Tool: swap_timetable_slots
 * Swaps two sessions in a class schedule atomically.
 */
export async function swapTimetableSlotsTool(
  args: {
    className: string;
    day1: string;
    time1: string;
    day2: string;
    time2: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: "Classe introuvable" };
  }

  const { dayEnum: day1Enum, displayDay: displayDay1 } = resolveDayOfWeek(args.day1);
  const { dayEnum: day2Enum, displayDay: displayDay2 } = resolveDayOfWeek(args.day2);

  const start1 = args.time1.split("-")[0].trim().slice(0, 5);
  const start2 = args.time2.split("-")[0].trim().slice(0, 5);

  const slot1 = await prisma.timetableSlot.findFirst({
    where: { classId: targetClass.id, day: day1Enum, startTime: start1, isDraft: false },
    include: { subject: true, teacher: true },
  });

  const slot2 = await prisma.timetableSlot.findFirst({
    where: { classId: targetClass.id, day: day2Enum, startTime: start2, isDraft: false },
    include: { subject: true, teacher: true },
  });

  if (!slot1 || !slot2) {
    return {
      success: false,
      message: `Impossible de trouver les deux séances à échanger (${displayDay1} à ${start1} vs ${displayDay2} à ${start2}).`,
      summary: "Séances introuvables",
    };
  }

  // Check teacher 1 conflict in slot 2 window
  if (slot1.teacherId) {
    const t1Conflict = await prisma.timetableSlot.findFirst({
      where: {
        id: { notIn: [slot1.id, slot2.id] },
        teacherId: slot1.teacherId,
        day: day2Enum,
        isDraft: false,
        startTime: { lt: slot2.endTime },
        endTime: { gt: slot2.startTime },
      },
      include: { class: true },
    });
    if (t1Conflict) {
      return {
        success: false,
        message: `⚠️ Conflit pour ${slot1.teacher?.name} ${slot1.teacher?.surname} le ${displayDay2} en ${t1Conflict.class?.name}.`,
        summary: "Conflit enseignant",
      };
    }
  }

  // Check teacher 2 conflict in slot 1 window
  if (slot2.teacherId) {
    const t2Conflict = await prisma.timetableSlot.findFirst({
      where: {
        id: { notIn: [slot1.id, slot2.id] },
        teacherId: slot2.teacherId,
        day: day1Enum,
        isDraft: false,
        startTime: { lt: slot1.endTime },
        endTime: { gt: slot1.startTime },
      },
      include: { class: true },
    });
    if (t2Conflict) {
      return {
        success: false,
        message: `⚠️ Conflit pour ${slot2.teacher?.name} ${slot2.teacher?.surname} le ${displayDay1} en ${t2Conflict.class?.name}.`,
        summary: "Conflit enseignant",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    // Temporary swap to limbo
    await tx.timetableSlot.update({
      where: { id: slot1.id },
      data: { slotNumber: -99 },
    });

    await tx.timetableSlot.update({
      where: { id: slot2.id },
      data: {
        day: day1Enum,
        startTime: slot1.startTime,
        endTime: slot1.endTime,
        slotNumber: slot1.slotNumber,
      },
    });

    await tx.timetableSlot.update({
      where: { id: slot1.id },
      data: {
        day: day2Enum,
        startTime: slot2.startTime,
        endTime: slot2.endTime,
        slotNumber: slot2.slotNumber,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "TimetableSlot",
        entityId: `${slot1.id}-${slot2.id}`,
        description: `[Hnia AI Telegram] Échange de séances pour ${targetClass.name} : ${slot1.subject?.name} (${displayDay1} ${slot1.startTime}) <-> ${slot2.subject?.name} (${displayDay2} ${slot2.startTime})`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  return {
    success: true,
    message: `🔄 **Séances échangées avec succès pour ${targetClass.name} :**\n• <b>${slot1.subject?.name}</b> est maintenant le <b>${displayDay2}</b> de <code>${slot2.startTime}</code> à <code>${slot2.endTime}</code>.\n• <b>${slot2.subject?.name}</b> est maintenant le <b>${displayDay1}</b> de <code>${slot1.startTime}</code> à <code>${slot1.endTime}</code>.`,
    summary: `Échange ${slot1.subject?.name} <-> ${slot2.subject?.name}`,
  };
}

/**
 * Tool: update_timetable_slot
 * Changes teacher, room, or subject for an existing slot.
 */
export async function updateTimetableSlotTool(
  args: {
    className: string;
    day: string;
    time: string;
    newTeacherName?: string;
    newSubjectName?: string;
    newRoom?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: "Classe introuvable" };
  }

  const { dayEnum, displayDay } = resolveDayOfWeek(args.day);
  const start = args.time.split("-")[0].trim().slice(0, 5);

  const slot = await prisma.timetableSlot.findFirst({
    where: { classId: targetClass.id, day: dayEnum, startTime: start, isDraft: false },
    include: { subject: true, teacher: true, room: true },
  });

  if (!slot) {
    return {
      success: false,
      message: `Aucune séance trouvée pour ${targetClass.name} le ${displayDay} à ${start}.`,
      summary: "Séance introuvable",
    };
  }

  const updateData: any = {};
  const changesSummary: string[] = [];

  if (args.newTeacherName) {
    const newTeacher = await resolveTeacherByName(context.schoolId, args.newTeacherName);
    if (!newTeacher) {
      return { success: false, message: `Enseignant "${args.newTeacherName}" introuvable.`, summary: "Enseignant introuvable" };
    }

    const conflict = await prisma.timetableSlot.findFirst({
      where: {
        id: { not: slot.id },
        teacherId: newTeacher.id,
        day: dayEnum,
        isDraft: false,
        startTime: { lt: slot.endTime },
        endTime: { gt: slot.startTime },
      },
      include: { class: true },
    });

    if (conflict) {
      return {
        success: false,
        message: `⚠️ Conflit : ${newTeacher.name} ${newTeacher.surname} a déjà cours le ${displayDay} à ces heures en ${conflict.class?.name}.`,
        summary: "Conflit enseignant",
      };
    }

    updateData.teacherId = newTeacher.id;
    changesSummary.push(`Enseignant: ${newTeacher.name} ${newTeacher.surname}`);
  }

  if (args.newSubjectName) {
    const newSubject = await resolveSubjectByName(context.schoolId, args.newSubjectName);
    if (!newSubject) {
      return { success: false, message: `Matière "${args.newSubjectName}" introuvable.`, summary: "Matière introuvable" };
    }
    updateData.subjectId = newSubject.id;
    changesSummary.push(`Matière: ${newSubject.name}`);
  }

  if (args.newRoom) {
    const newRoom = await resolveRoomByName(context.schoolId, args.newRoom);
    if (newRoom) {
      updateData.roomId = newRoom.id;
      changesSummary.push(`Salle: ${newRoom.name}`);
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { success: false, message: "Aucune modification spécifiée.", summary: "Aucune modification" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.update({
      where: { id: slot.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "TimetableSlot",
        entityId: slot.id.toString(),
        description: `[Hnia AI Telegram] Mise à jour séance ${targetClass.name} (${displayDay} ${start}) : ${changesSummary.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  return {
    success: true,
    message: `✅ Séance mise à jour avec succès pour **${targetClass.name}** (${displayDay} à ${start}) :\n• ${changesSummary.join("\n• ")}`,
    summary: `Mise à jour séance ${targetClass.name}`,
  };
}

/**
 * Tool: delete_timetable_slot
 * Cancels or removes a scheduled session.
 */
export async function deleteTimetableSlotTool(
  args: {
    className: string;
    day: string;
    timeOrSubject: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: "Classe introuvable" };
  }

  const { dayEnum, displayDay } = resolveDayOfWeek(args.day);
  const timeQuery = args.timeOrSubject.split("-")[0].trim().slice(0, 5);

  let slot = await prisma.timetableSlot.findFirst({
    where: { classId: targetClass.id, day: dayEnum, startTime: timeQuery, isDraft: false },
    include: { subject: true, teacher: true },
  });

  if (!slot) {
    const subject = await resolveSubjectByName(context.schoolId, args.timeOrSubject);
    if (subject) {
      slot = await prisma.timetableSlot.findFirst({
        where: { classId: targetClass.id, day: dayEnum, subjectId: subject.id, isDraft: false },
        include: { subject: true, teacher: true },
      });
    }
  }

  if (!slot) {
    return {
      success: false,
      message: `Aucune séance trouvée pour ${targetClass.name} le ${displayDay} correspondant à "${args.timeOrSubject}".`,
      summary: "Séance introuvable",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.timetableSlot.delete({
      where: { id: slot.id },
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "TimetableSlot",
        entityId: slot.id.toString(),
        description: `[Hnia AI Telegram] Suppression séance : ${targetClass.name} - ${slot.subject?.name} (${slot.teacher?.name} ${slot.teacher?.surname}) le ${displayDay} à ${slot.startTime}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  return {
    success: true,
    message: `🗑️ **Séance supprimée avec succès :**\n• Classe : **${targetClass.name}**\n• Matière : **${slot.subject?.name || "Cours"}**\n• Horaires : **${displayDay}** de <code>${slot.startTime}</code> à <code>${slot.endTime}</code>.`,
    summary: `Suppression séance ${slot.subject?.name} (${targetClass.name})`,
  };
}

/**
 * Tool: suggest_best_timetable_slot
 * The AI timetable engine: analyzes class schedule, teacher commitments across the school,
 * operating hours, and admin constraints to recommend the best conflict-free slots.
 */
export async function suggestBestTimetableSlotTool(
  args: {
    className: string;
    subjectName: string;
    teacherName?: string;
    durationMinutes?: number;
    constraints?: string;
    preferredDay?: string;
  },
  context: ToolContext
) {
  const targetClass = await resolveClassByName(context.schoolId, args.className);
  if (!targetClass) {
    return { found: false, message: `Classe "${args.className}" introuvable.` };
  }

  const subject = await resolveSubjectByName(context.schoolId, args.subjectName);
  if (!subject) {
    return { found: false, message: `Matière "${args.subjectName}" introuvable.` };
  }

  let teacher = args.teacherName ? await resolveTeacherByName(context.schoolId, args.teacherName) : null;

  // Auto-detect teacher if not provided
  if (!teacher) {
    const existingSlot = await prisma.timetableSlot.findFirst({
      where: { classId: targetClass.id, subjectId: subject.id, isDraft: false, teacherId: { not: null } },
      include: { teacher: true },
    });
    if (existingSlot?.teacher) {
      teacher = existingSlot.teacher;
    } else {
      const qualified = await prisma.teacher.findFirst({
        where: { schoolId: context.schoolId, subjects: { some: { id: subject.id } } },
      });
      if (qualified) teacher = qualified;
    }
  }

  const duration = args.durationMinutes || 120;
  const { forbiddenDays, preferredDays, timeWindow } = parseSchedulingConstraints(args.constraints, args.preferredDay);

  // Institution hours
  const institution = await prisma.institution.findFirst({
    where: { schoolId: context.schoolId },
    select: { dayStartTime: true, dayEndTime: true },
  });
  const dayStart = (institution as any)?.dayStartTime || "08:00";
  const dayEnd = (institution as any)?.dayEndTime || "14:00";

  // Existing slots for this class
  const classSlots = await prisma.timetableSlot.findMany({
    where: { classId: targetClass.id, isDraft: false },
    include: { subject: { select: { id: true, name: true } } },
  });

  // Existing slots for this teacher (school-wide)
  const teacherSlots = teacher
    ? await prisma.timetableSlot.findMany({
        where: { teacherId: teacher.id, schoolId: context.schoolId, isDraft: false },
        include: { class: { select: { name: true } } },
      })
    : [];

  // Candidate windows (standard school periods)
  const standardPeriods: Array<{ start: string; end: string }> = [];
  let cursor = dayStart;
  const dayEndMin = timeToMinutes(dayEnd);
  while (timeToMinutes(cursor) + duration <= dayEndMin) {
    const end = addMinutes(cursor, duration);
    standardPeriods.push({ start: cursor, end });
    cursor = end;
  }
  if (standardPeriods.length === 0) {
    standardPeriods.push(
      { start: "08:00", end: addMinutes("08:00", duration) },
      { start: "10:00", end: addMinutes("10:00", duration) },
      { start: "12:00", end: addMinutes("12:00", duration) }
    );
  }

  // Generate and score all possible (day, period) candidates
  const scoredCandidates: Array<{
    day: Day;
    startTime: string;
    endTime: string;
    score: number;
    reasons: string[];
  }> = [];

  for (const day of ALL_DAYS) {
    // 1. Hard constraint: forbidden days
    if (forbiddenDays.has(day)) continue;

    for (const period of standardPeriods) {
      // 2. Hard constraint: time window (morning vs afternoon)
      const startMin = timeToMinutes(period.start);
      if (timeWindow === "morning" && startMin >= 12 * 60) continue;
      if (timeWindow === "afternoon" && startMin < 12 * 60) continue;

      // 3. Hard conflict: class is busy
      const hasClassConflict = classSlots.some(
        (s) => s.day === day && slotsOverlap(s.startTime, s.endTime, period.start, period.end)
      );
      if (hasClassConflict) continue;

      // 4. Hard conflict: teacher is busy anywhere in the school
      const hasTeacherConflict = teacherSlots.some((s) =>
        s.day === day && slotsOverlap(s.startTime, s.endTime, period.start, period.end)
      );
      if (hasTeacherConflict) continue;

      // 5. Pedagogical Scoring
      let score = 100;
      const reasons: string[] = ["Classe et enseignant 100% disponibles (aucun conflit)"];

      // Preferred day bonus
      if (preferredDays.has(day)) {
        score += 50;
        reasons.push(`Correspond au jour souhaité (${DAY_LABELS[day]})`);
      }

      // Subject distribution: avoid heavy repetition on the same day
      const subjectHoursOnDay = classSlots
        .filter((s) => s.day === day && s.subjectId === subject.id)
        .reduce((acc, s) => acc + (s.duration || 120), 0);

      if (subjectHoursOnDay === 0) {
        score += 30;
        reasons.push(`Répartition optimale : premier cours de ${subject.name} ce jour-là`);
      } else {
        score -= 40;
        reasons.push(`Attention : la classe a déjà ${subjectHoursOnDay} min de ${subject.name} ce jour-là`);
      }

      // Student daily fatigue balance
      const totalClassHoursOnDay = classSlots
        .filter((s) => s.day === day)
        .reduce((acc, s) => acc + (s.duration || 120), 0);

      if (totalClassHoursOnDay <= 120) {
        score += 25;
        reasons.push(`Allège la semaine (journée légère pour les élèves)`);
      } else if (totalClassHoursOnDay >= 360) {
        score -= 30;
        reasons.push(`Journée déjà dense pour la classe`);
      }

      // Morning preference for core subjects (Math, Science, Languages)
      const isCoreSubject = ["math", "physique", "science", "arabe", "francais", "anglais"].some((k) =>
        subject.name.toLowerCase().includes(k)
      );
      if (isCoreSubject && startMin < 11 * 60) {
        score += 20;
        reasons.push(`Créneau matinal recommandé pour l'assimilation cognitive`);
      }

      scoredCandidates.push({
        day,
        startTime: period.start,
        endTime: period.end,
        score,
        reasons,
      });
    }
  }

  // Sort candidates by score descending
  scoredCandidates.sort((a, b) => b.score - a.score);

  if (scoredCandidates.length === 0) {
    return {
      found: false,
      message: `Aucun créneau libre trouvé avec les contraintes actuelles. Essayez de relâcher les filtres de jours ou d'horaires.`,
      constraintsApplied: {
        forbiddenDays: Array.from(forbiddenDays).map((d) => DAY_LABELS[d]),
        timeWindow,
      },
    };
  }

  const topSuggestions = scoredCandidates.slice(0, 3).map((c, idx) => ({
    rank: idx + 1,
    day: DAY_LABELS[c.day],
    dayEnum: c.day,
    time: `${c.startTime} - ${c.endTime}`,
    startTime: c.startTime,
    endTime: c.endTime,
    score: c.score,
    reasons: c.reasons,
  }));

  const best = topSuggestions[0];

  return {
    found: true,
    className: targetClass.name,
    subjectName: subject.name,
    teacherName: teacher ? `${teacher.name} ${teacher.surname}` : "À désigner",
    durationMinutes: duration,
    bestOption: {
      day: best.day,
      time: best.time,
      reasons: best.reasons,
    },
    topSuggestions,
    constraintsRespected: {
      forbiddenDays: Array.from(forbiddenDays).map((d) => DAY_LABELS[d]),
      preferredDays: Array.from(preferredDays).map((d) => DAY_LABELS[d]),
      timeWindow: timeWindow === "any" ? "Indifférent" : timeWindow === "morning" ? "Matin" : "Après-midi",
    },
    readyToApplyAction: {
      tool: "add_timetable_slot",
      arguments: {
        className: targetClass.name,
        subjectName: subject.name,
        teacherName: teacher ? `${teacher.name} ${teacher.surname}` : "",
        day: best.day.toLowerCase(),
        startTime: best.startTime,
        endTime: best.endTime,
      },
    },
  };
}

