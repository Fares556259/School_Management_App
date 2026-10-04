import type { Day } from '@prisma/client';

const days: Array<Day | null> = [null, 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** Mobile calendars send YYYY-MM-DD. Reject impossible dates before a database query. */
export function parseSchoolDay(value?: unknown, now = new Date()) {
  if (value != null && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) return null;
  const [year, month, day] = typeof value === 'string'
    ? value.split('-').map(Number)
    : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {
    date,
    day: days[date.getUTCDay()],
    start: new Date(year, month - 1, day),
    end: new Date(year, month - 1, day + 1),
  };
}
