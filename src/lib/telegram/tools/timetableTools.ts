import prisma from "@/lib/prisma";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";

const DAYS_MAP: Record<string, "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY"> = {
  lundi: "MONDAY",
  mardi: "TUESDAY",
  mercredi: "WEDNESDAY",
  jeudi: "THURSDAY",
  vendredi: "FRIDAY",
  samedi: "SATURDAY",
  monday: "MONDAY",
  tuesday: "TUESDAY",
  wednesday: "WEDNESDAY",
  thursday: "THURSDAY",
  friday: "FRIDAY",
  saturday: "SATURDAY",
  "1": "MONDAY",
  "2": "TUESDAY",
  "3": "WEDNESDAY",
  "4": "THURSDAY",
  "5": "FRIDAY",
  "6": "SATURDAY",
};

/**
 * Tool: get_class_timetable
 * Returns class schedule for a specific day or whole week.
 */
export async function getClassTimetableTool(
  args: {
    className: string;
    day?: string; // "lundi", "mardi", "vendredi", etc.
  },
  context: ToolContext
) {
  const className = args.className.trim();

  const targetClass = await prisma.class.findFirst({
    where: { schoolId: context.schoolId, name: { contains: className, mode: "insensitive" } },
  });

  if (!targetClass) {
    return { found: false, message: `Classe "${className}" introuvable.` };
  }

  const where: any = {
    classId: targetClass.id,
    isDraft: false,
  };

  if (args.day) {
    const cleanDay = args.day.toLowerCase().trim();
    const dayEnum = DAYS_MAP[cleanDay];
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
    day: string; // e.g. "mardi"
    timeSlot: string; // e.g. "10:00" or "10:00 - 12:00"
    subjectName?: string;
  },
  context: ToolContext
) {
  const cleanDay = args.day.toLowerCase().trim();
  const dayEnum = DAYS_MAP[cleanDay] || "MONDAY";
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
    whereTeacher.subjects = {
      some: { name: { contains: args.subjectName.trim(), mode: "insensitive" } },
    };
  }

  const availableTeachers = await prisma.teacher.findMany({
    where: whereTeacher,
    take: 10,
    include: {
      subjects: { select: { name: true } },
    },
  });

  return {
    day: cleanDay,
    time: searchTime,
    subjectFilter: args.subjectName || "Toutes matières",
    availableCount: availableTeachers.length,
    availableTeachers: availableTeachers.map((t) => ({
      id: t.id,
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
  const cleanDay = args.day.toLowerCase().trim();
  const dayEnum = DAYS_MAP[cleanDay] || "MONDAY";

  const targetClass = await prisma.class.findFirst({
    where: { schoolId: context.schoolId, name: { contains: args.className.trim(), mode: "insensitive" } },
  });
  if (!targetClass) {
    return { success: false, message: `Classe "${args.className}" introuvable.`, summary: `Classe introuvable` };
  }

  const subject = await prisma.subject.findFirst({
    where: { schoolId: context.schoolId, name: { contains: args.subjectName.trim(), mode: "insensitive" } },
  });
  if (!subject) {
    return { success: false, message: `Matière "${args.subjectName}" introuvable.`, summary: `Matière introuvable` };
  }

  const teacher = await prisma.teacher.findFirst({
    where: {
      schoolId: context.schoolId,
      OR: [
        { name: { contains: args.teacherName.trim(), mode: "insensitive" } },
        { surname: { contains: args.teacherName.trim(), mode: "insensitive" } },
      ],
    },
  });
  if (!teacher) {
    return { success: false, message: `Enseignant "${args.teacherName}" introuvable.`, summary: `Enseignant introuvable` };
  }

  const duration = 120; // Default 2-hour block

  let roomId: number | undefined = undefined;
  if (args.room) {
    const r = await prisma.room.findFirst({
      where: { schoolId: context.schoolId, name: { contains: args.room, mode: "insensitive" } },
    });
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
        description: `[Hnia AI Telegram] Ajout séance : ${targetClass.name} - ${subject.name} (${teacher.name} ${teacher.surname}) le ${cleanDay} à ${args.startTime}`,
        schoolId: context.schoolId,
      },
    });

    return s;
  });

  invalidateTenantTags(context.schoolId, "classes", "teachers", "dashboard");

  return {
    success: true,
    message: `✅ Séance ajoutée avec succès : **${subject.name}** pour la classe **${targetClass.name}** avec **${teacher.name} ${teacher.surname}** le **${cleanDay}** de ${args.startTime} à ${args.endTime}.`,
    summary: `Ajout séance ${subject.name} (${targetClass.name})`,
    data: { slotId: slot.id },
  };
}
