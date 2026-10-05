export type TimetableEntry = {
  id?: number;
  day: string;
  classId: number;
  slotNumber: number;
  startTime: string;
  endTime: string;
  teacherId?: string | null;
  roomId?: number | null;
  subjectId?: number | null;
  class?: { name: string };
  teacher?: { name: string; surname: string } | null;
  room?: { name: string } | null;
};

export type TimetableConflict = {
  kind: "class" | "teacher" | "room";
  resource: string;
  className: string;
  day: string;
  startTime: string;
  endTime: string;
};

export function describeTimetableConflict(conflict: TimetableConflict, labels: { classConflict: string; teacherConflict: string; roomConflict: string }): string {
  const template = labels[`${conflict.kind}Conflict`];
  return template.replace("{resource}", conflict.resource).replace("{class}", conflict.className)
    .replace("{start}", conflict.startTime).replace("{end}", conflict.endTime);
}

export function timeToMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return timeToMinutes(aStart) < timeToMinutes(bEnd) && timeToMinutes(bStart) < timeToMinutes(aEnd);
}

/** Check real intervals, including separate groups inside the proposed session. */
export function findTimetableConflicts(
  proposed: TimetableEntry[],
  existing: TimetableEntry[],
  excludedIds: number[] = [],
): TimetableConflict[] {
  const excluded = new Set(excludedIds);
  const conflicts: TimetableConflict[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < proposed.length; index++) {
    const candidate = proposed[index];
    const others = [...existing.filter(slot => !slot.id || !excluded.has(slot.id)), ...proposed.slice(0, index)];
    for (const other of others) {
      if (candidate.day !== other.day || !timesOverlap(candidate.startTime, candidate.endTime, other.startTime, other.endTime)) continue;
      const sameBlock = candidate.classId === other.classId && candidate.slotNumber === other.slotNumber &&
        candidate.startTime === other.startTime && candidate.endTime === other.endTime;
      const kinds: TimetableConflict["kind"][] = [];
      if (candidate.classId === other.classId && !sameBlock) kinds.push("class");
      if (candidate.teacherId && candidate.teacherId === other.teacherId) kinds.push("teacher");
      if (candidate.roomId && candidate.roomId === other.roomId) kinds.push("room");
      for (const kind of kinds) {
        const resource = kind === "teacher"
          ? (other.teacher ? `${other.teacher.name} ${other.teacher.surname}` : String(other.teacherId))
          : kind === "room" ? (other.room?.name || String(other.roomId)) : (other.class?.name || String(other.classId));
        const key = `${kind}:${resource}:${other.day}:${other.startTime}:${other.endTime}`;
        if (seen.has(key)) continue;
        seen.add(key);
        conflicts.push({ kind, resource, className: other.class?.name || String(other.classId), day: other.day, startTime: other.startTime, endTime: other.endTime });
      }
    }
  }
  return conflicts;
}

export function validateTimetableTime(startTime: string, duration: number, dayStart: string, dayEnd: string): string | null {
  const start = timeToMinutes(startTime);
  if (!Number.isFinite(start) || ![60, 90, 120].includes(duration)) return "invalidTime";
  if (start < timeToMinutes(dayStart) || start + duration > timeToMinutes(dayEnd)) return "outsideSchoolHours";
  return null;
}

/** Display date-based exam times in the shared grid without weakening timetable validation. */
export function displayScheduleTime(value: string | Date): string {
  if (typeof value === "string" && Number.isFinite(timeToMinutes(value))) return value;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
