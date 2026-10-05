import { Day, Prisma, PrismaClient } from "@prisma/client";
import { findTimetableConflicts, minutesToTime, timeToMinutes, validateTimetableTime, TimetableConflict } from "./timetableConflicts";

export type TimetableBlockInput = {
  id?: number;
  classId: number;
  day: Day;
  slotNumber?: number;
  isDraft?: boolean;
  startTime: string;
  duration: number;
  sessions: { id?: number; subjectId: number | null; teacherId?: string | null; roomId?: number | null }[];
};

export class TimetableEditError extends Error {
  constructor(public code: string, public conflicts: TimetableConflict[] = []) {
    super(code);
  }
}

const relations = { class: { select: { name: true } }, teacher: { select: { name: true, surname: true } }, room: { select: { name: true } }, subject: true } as const;

async function lockSchool(tx: Prisma.TransactionClient, schoolId: string) {
  // Concurrent editors use one transaction-scoped lock before checking availability.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`timetable:${schoolId}`}))`;
}

async function schoolHours(tx: Prisma.TransactionClient, schoolId: string) {
  const institution = await tx.institution.findFirst({ where: { schoolId }, select: { dayStartTime: true, dayEndTime: true } });
  return { start: institution?.dayStartTime || "08:00", end: institution?.dayEndTime || "14:00" };
}

async function availability(tx: Prisma.TransactionClient, schoolId: string, classId: number, isDraft: boolean) {
  // A draft replaces its own class's published week, while other classes stay live.
  return tx.timetableSlot.findMany({
    where: isDraft ? { schoolId, OR: [{ classId, isDraft: true }, { classId: { not: classId }, isDraft: false }] } : { schoolId, isDraft: false },
    include: relations,
  });
}

export async function saveTimetableBlock(db: PrismaClient, schoolId: string, input: TimetableBlockInput, replaceGroups = true) {
  return db.$transaction(async tx => {
    await lockSchool(tx, schoolId);
    if (!Object.values(Day).includes(input.day) || !Number.isInteger(input.classId) || !input.sessions.length || input.sessions.length > 12) throw new TimetableEditError("invalidSession");
    const classInfo = await tx.class.findFirst({ where: { id: input.classId, schoolId }, select: { id: true, name: true } });
    if (!classInfo) throw new TimetableEditError("sessionNotFound");
    const hours = await schoolHours(tx, schoolId);
    const timeError = validateTimetableTime(input.startTime, input.duration, hours.start, hours.end);
    if (timeError) throw new TimetableEditError(timeError);
    const isDraft = input.isDraft || false;
    const anchor = input.id ? await tx.timetableSlot.findFirst({ where: { id: input.id, schoolId, classId: input.classId, isDraft } }) : null;
    if (input.id && !anchor) throw new TimetableEditError("sessionNotFound");
    const original = anchor ? await tx.timetableSlot.findMany({ where: { schoolId, classId: anchor.classId, day: anchor.day, slotNumber: anchor.slotNumber, isDraft } }) : [];
    const existingIds = new Set(original.map(s => s.id));
    const submittedIds = input.sessions.filter(s => s.id && s.id > 0).map(s => s.id!);
    if (submittedIds.some(id => !existingIds.has(id)) || new Set(submittedIds).size !== submittedIds.length) throw new TimetableEditError("sessionNotFound");
    const subjectIds = Array.from(new Set(input.sessions.map(s => s.subjectId).filter((id): id is number => id !== null)));
    const teacherIds = Array.from(new Set(input.sessions.flatMap(s => s.teacherId ? [s.teacherId] : [])));
    const roomIds = Array.from(new Set(input.sessions.flatMap(s => s.roomId ? [s.roomId] : [])));
    const [subjects, teachers, rooms, world] = await Promise.all([
      tx.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
      tx.teacher.findMany({ where: { schoolId, id: { in: teacherIds } }, select: { id: true, name: true, surname: true } }),
      tx.room.findMany({ where: { schoolId, id: { in: roomIds } }, select: { id: true, name: true } }),
      availability(tx, schoolId, input.classId, isDraft),
    ]);
    if (subjects.length !== subjectIds.length || teachers.length !== teacherIds.length || rooms.length !== roomIds.length) throw new TimetableEditError("invalidSession");
    const classDaySlots = world.filter(s => s.classId === input.classId && s.day === input.day && s.isDraft === isDraft);
    const slotNumber = anchor?.slotNumber ?? Math.max(0, ...classDaySlots.map(s => s.slotNumber)) + 1;
    const endTime = minutesToTime(timeToMinutes(input.startTime) + input.duration);
    const sessions = replaceGroups ? input.sessions : [...original.filter(s => !submittedIds.includes(s.id)), ...input.sessions];
    const proposed = sessions.map(s => ({ ...s, teacherId: s.subjectId === null ? null : s.teacherId, roomId: s.subjectId === null ? null : s.roomId, classId: input.classId, day: input.day, slotNumber, startTime: input.startTime, endTime, class: classInfo, teacher: teachers.find(t => t.id === s.teacherId), room: rooms.find(r => r.id === s.roomId) }));
    const conflicts = findTimetableConflicts(proposed, world, original.map(s => s.id));
    if (conflicts.length) throw new TimetableEditError("scheduleConflict", conflicts);
    // Validate the entire block before making any changes; failures roll back all groups.
    if (replaceGroups) await tx.timetableSlot.deleteMany({ where: { schoolId, id: { in: original.filter(s => !submittedIds.includes(s.id)).map(s => s.id) } } });
    let nextGroupId = Math.max(0, ...original.map(s => s.groupId));
    const saved = [];
    for (const session of sessions) {
      const free = session.subjectId === null;
      const data = { schoolId, classId: input.classId, day: input.day, slotNumber, startTime: input.startTime, endTime, duration: input.duration, isDraft, subjectId: session.subjectId, teacherId: free ? null : session.teacherId || null, roomId: free ? null : session.roomId || null };
      saved.push(session.id && session.id > 0
        ? await tx.timetableSlot.update({ where: { id: session.id }, data, include: relations })
        : await tx.timetableSlot.create({ data: { ...data, groupId: ++nextGroupId }, include: relations }));
    }
    return saved;
  }, { timeout: 15000, maxWait: 10000 });
}

export async function removeTimetableBlock(db: PrismaClient, schoolId: string, id: number, wholeBlock = true) {
  await db.$transaction(async tx => {
    await lockSchool(tx, schoolId);
    const slot = await tx.timetableSlot.findFirst({ where: { id, schoolId } });
    if (!slot) throw new TimetableEditError("sessionNotFound");
    await tx.timetableSlot.deleteMany({ where: wholeBlock
      ? { schoolId, classId: slot.classId, day: slot.day, slotNumber: slot.slotNumber, isDraft: slot.isDraft }
      : { id, schoolId } });
    // Leave other sessions at their chosen times; deleting opens a gap.
  }, { timeout: 15000, maxWait: 10000 });
}

export async function relocateTimetableBlock(db: PrismaClient, schoolId: string, id: number, day: Day, targetSlotNumber: number, startTime?: string) {
  await db.$transaction(async tx => {
    await lockSchool(tx, schoolId);
    if (!Object.values(Day).includes(day)) throw new TimetableEditError("invalidSession");
    const source = await tx.timetableSlot.findFirst({ where: { id, schoolId } });
    if (!source) throw new TimetableEditError("sessionNotFound");
    if (source.day === day && source.slotNumber === targetSlotNumber && (!startTime || source.startTime === startTime)) return;
    const world = await availability(tx, schoolId, source.classId, source.isDraft);
    const block = world.filter(s => s.classId === source.classId && s.day === source.day && s.slotNumber === source.slotNumber);
    const target = world.filter(s => s.classId === source.classId && s.day === day && s.slotNumber === targetSlotNumber);
    const targetStart = target[0]?.startTime || startTime;
    if (!targetStart) throw new TimetableEditError("invalidTime");
    const hours = await schoolHours(tx, schoolId);
    const changes = [
      ...block.map(s => ({ ...s, day, slotNumber: targetSlotNumber, startTime: targetStart, endTime: minutesToTime(timeToMinutes(targetStart) + s.duration) })),
      ...target.map(s => ({ ...s, day: source.day, slotNumber: source.slotNumber, startTime: source.startTime, endTime: minutesToTime(timeToMinutes(source.startTime) + s.duration) })),
    ];
    for (const change of changes) {
      const timeError = validateTimetableTime(change.startTime, change.duration, hours.start, hours.end);
      if (timeError) throw new TimetableEditError(timeError);
    }
    const conflicts = findTimetableConflicts(changes, world, changes.map(s => s.id));
    if (conflicts.length) throw new TimetableEditError("scheduleConflict", conflicts);
    if (target.length) await tx.timetableSlot.updateMany({ where: { schoolId, id: { in: target.map(s => s.id) } }, data: { slotNumber: -1 } });
    for (const change of changes) await tx.timetableSlot.update({ where: { id: change.id }, data: { day: change.day, slotNumber: change.slotNumber, startTime: change.startTime, endTime: change.endTime } });
  }, { timeout: 15000, maxWait: 10000 });
}

export async function publishTimetableDraft(db: PrismaClient, schoolId: string, classId: number) {
  await db.$transaction(async tx => {
    await lockSchool(tx, schoolId);
    const drafts = await tx.timetableSlot.findMany({ where: { schoolId, classId, isDraft: true }, include: relations });
    if (!drafts.length) throw new TimetableEditError("sessionNotFound");
    const hours = await schoolHours(tx, schoolId);
    for (const slot of drafts) {
      const error = validateTimetableTime(slot.startTime, slot.duration, hours.start, hours.end);
      if (error) throw new TimetableEditError(error);
    }
    const world = await availability(tx, schoolId, classId, false);
    const conflicts = findTimetableConflicts(drafts, world.filter(s => s.classId !== classId));
    if (conflicts.length) throw new TimetableEditError("scheduleConflict", conflicts);
    await tx.timetableSlot.deleteMany({ where: { schoolId, classId, isDraft: false } });
    await tx.timetableSlot.createMany({ data: drafts.map(s => ({ schoolId, classId, day: s.day, slotNumber: s.slotNumber, groupId: s.groupId, duration: s.duration, startTime: s.startTime, endTime: s.endTime, subjectId: s.subjectId, teacherId: s.teacherId, roomId: s.roomId, isDraft: false })) });
    await tx.timetableSlot.deleteMany({ where: { schoolId, classId, isDraft: true } });
  }, { timeout: 15000, maxWait: 10000 });
}

// Generated weeks receive the same conflict and tenant checks as manual edits.
export async function replaceTimetableWeek(db: PrismaClient, schoolId: string, classId: number, slots: any[], isDraft = false) {
  await db.$transaction(async tx => {
    await lockSchool(tx, schoolId);
    const classInfo = await tx.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
    if (!classInfo || !Array.isArray(slots) || !slots.length || slots.length > 200) throw new TimetableEditError("invalidSession");
    const hours = await schoolHours(tx, schoolId);
    const cursor = new Map<Day, string>();
    const times = new Map<string, { start: string; duration: number }>();
    const proposed = [...slots].sort((a, b) => Number(a.slotNumber) - Number(b.slotNumber)).map(slot => {
      const day = String(slot.day).toUpperCase() as Day;
      const slotNumber = Number(slot.slotNumber);
      const duration = Number(slot.duration) || 120;
      if (!Object.values(Day).includes(day) || !Number.isInteger(slotNumber) || slotNumber < 1) throw new TimetableEditError("invalidSession");
      const key = `${day}:${slotNumber}`;
      const previous = times.get(key);
      const startTime = previous?.start || slot.startTime || cursor.get(day) || hours.start;
      if (previous && (previous.duration !== duration || (slot.startTime && slot.startTime !== previous.start))) throw new TimetableEditError("invalidSession");
      const error = validateTimetableTime(startTime, duration, hours.start, hours.end);
      if (error) throw new TimetableEditError(error);
      const endTime = minutesToTime(timeToMinutes(startTime) + duration);
      times.set(key, { start: startTime, duration }); cursor.set(day, endTime);
      return { schoolId, classId, day, slotNumber, groupId: slots.filter(s => String(s.day).toUpperCase() === day && Number(s.slotNumber) === slotNumber).indexOf(slot) + 1, isDraft, startTime, endTime, duration, subjectId: Number(slot.subjectId), teacherId: slot.teacherId ? String(slot.teacherId) : null, roomId: slot.roomId ? Number(slot.roomId) : null, class: classInfo };
    });
    const subjectIds = Array.from(new Set(proposed.map(s => s.subjectId)));
    const teacherIds = Array.from(new Set(proposed.flatMap(s => s.teacherId ? [s.teacherId] : [])));
    const roomIds = Array.from(new Set(proposed.flatMap(s => s.roomId ? [s.roomId] : [])));
    const [subjects, teachers, rooms, world] = await Promise.all([
      tx.subject.findMany({ where: { schoolId, id: { in: subjectIds } }, select: { id: true } }),
      tx.teacher.findMany({ where: { schoolId, id: { in: teacherIds } }, select: { id: true, name: true, surname: true } }),
      tx.room.findMany({ where: { schoolId, id: { in: roomIds } }, select: { id: true, name: true } }),
      availability(tx, schoolId, classId, isDraft),
    ]);
    if (subjects.length !== subjectIds.length || teachers.length !== teacherIds.length || rooms.length !== roomIds.length) throw new TimetableEditError("invalidSession");
    const conflicts = findTimetableConflicts(proposed.map(s => ({ ...s, teacher: teachers.find(t => t.id === s.teacherId), room: rooms.find(r => r.id === s.roomId) })), world.filter(s => s.classId !== classId));
    if (conflicts.length) throw new TimetableEditError("scheduleConflict", conflicts);
    await tx.timetableSlot.deleteMany({ where: { schoolId, classId, isDraft } });
    await tx.timetableSlot.createMany({ data: proposed.map(({ class: classInfo, ...data }) => data) });
  }, { timeout: 15000, maxWait: 10000 });
}
