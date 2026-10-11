import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { parseTime } from "@/lib/timeUtils";

export class AssignmentLessonError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export type AssignmentAccess = { schoolId: string; teacherId?: string };

export async function getAssignmentAccess(): Promise<AssignmentAccess> {
  const schoolId = await getSchoolId();
  const role = await getRole();
  if (role === "admin") return { schoolId };
  if (role === "teacher") {
    const user = await getAuthenticatedUser();
    if (user) return { schoolId, teacherId: user.id };
  }
  throw new AssignmentLessonError("Not authorized to manage assignments", 403);
}

const selection = {
  id: true, name: true, classId: true, subjectId: true, teacherId: true,
  subject: { select: { name: true } },
  class: { select: { name: true } },
  teacher: { select: { name: true, surname: true } },
} as const;

/** Published timetable subjects are selectable even before a Lesson has been saved. No writes. */
export async function getAssignmentLessonOptions(access: AssignmentAccess, classId?: number) {
  const { schoolId, teacherId } = access;
  if (classId !== undefined) {
    if (!Number.isSafeInteger(classId) || classId <= 0) throw new AssignmentLessonError("Invalid class");
    const schoolClass = await prisma.class.findFirst({ where: { schoolId, id: classId }, select: { id: true } });
    if (!schoolClass) throw new AssignmentLessonError("Class not found", 404);
  }
  const scope = {
    schoolId, ...(classId !== undefined ? { classId } : {}), ...(teacherId ? { teacherId } : {}),
    class: { schoolId }, subject: { schoolId }, teacher: { schoolId },
  };
  const [lessons, slots] = await Promise.all([
    prisma.lesson.findMany({ where: scope, select: selection, orderBy: [{ name: "asc" }, { id: "asc" }] }),
    prisma.timetableSlot.findMany({
      where: { ...scope, isDraft: false, subjectId: { not: null }, teacherId: teacherId || { not: null } },
      select: { id: true, classId: true, subjectId: true, teacherId: true, subject: selection.subject, class: selection.class, teacher: selection.teacher },
      orderBy: [{ day: "asc" }, { slotNumber: "asc" }, { id: "asc" }],
    }),
  ]);
  const key = (item: { classId: number; subjectId: number | null; teacherId: string | null }) =>
    `${item.classId}:${item.subjectId}:${item.teacherId}`;
  const seen = new Set(lessons.map(key));
  const options: Array<{
    id: number | string; name: string; classId: number;
    subject: { name: string }; class: { name: string }; teacher: { name: string; surname: string };
  }> = [...lessons];
  for (const slot of slots) {
    if (!slot.subject || !slot.teacher || seen.has(key(slot))) continue;
    seen.add(key(slot));
    options.push({ ...slot, id: `slot-${slot.id}`, name: slot.subject.name, subject: slot.subject, teacher: slot.teacher });
  }
  return options;
}

/** Called only inside an explicitly submitted assignment transaction. */
export async function resolveAssignmentLesson(tx: Prisma.TransactionClient, access: AssignmentAccess, value: number | string) {
  const { schoolId, teacherId } = access;
  const scope = { schoolId, ...(teacherId ? { teacherId } : {}), class: { schoolId }, subject: { schoolId }, teacher: { schoolId } };
  const identifier = String(value);
  if (/^[1-9]\d*$/.test(identifier) && Number.isSafeInteger(Number(identifier))) {
    const lesson = await tx.lesson.findFirst({ where: { ...scope, id: Number(identifier) }, select: { id: true } });
    if (!lesson) throw new AssignmentLessonError("Lesson not found", 404);
    return lesson.id;
  }
  if (!/^slot-[1-9]\d*$/.test(identifier) || !Number.isSafeInteger(Number(identifier.slice(5)))) {
    throw new AssignmentLessonError("Invalid lesson");
  }
  const slot = await tx.timetableSlot.findFirst({
    where: { ...scope, id: Number(identifier.slice(5)), isDraft: false, subjectId: { not: null } },
    include: { subject: { select: { name: true } } },
  });
  if (!slot?.subjectId || !slot.teacherId || !slot.subject) throw new AssignmentLessonError("Scheduled lesson not found", 404);
  const existing = await tx.lesson.findFirst({
    where: { ...scope, classId: slot.classId, subjectId: slot.subjectId, teacherId: slot.teacherId },
    select: { id: true }, orderBy: { id: "asc" },
  });
  if (existing) return existing.id;
  const timeDate = (time: string) => {
    const { hours, minutes } = parseTime(time);
    return new Date(Date.UTC(2000, 0, 3, hours, minutes));
  };
  const lesson = await tx.lesson.create({
    data: {
      schoolId, classId: slot.classId, subjectId: slot.subjectId, teacherId: slot.teacherId,
      name: `${slot.subject.name} - ${slot.startTime}`, day: slot.day,
      startTime: timeDate(slot.startTime), endTime: timeDate(slot.endTime),
    }, select: { id: true },
  });
  return lesson.id;
}
