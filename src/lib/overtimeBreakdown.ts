/** Hourly additions retain their original rates; a legacy aggregate never invents rate detail. */
export interface OvertimeLine {
  hours: number;
  rate: number | null;
  amount: number;
  legacy?: boolean;
}
type Snapshot = { overtimeHours?: number | null; overtimeRate?: number | null };
export interface OvertimeAudit { oldValues?: unknown; newValues?: unknown }
const round = (n: number) => Math.round(n * 1000) / 1000;
const snapshot = (p: Snapshot, fallback = 0) => ({ hours: p.overtimeHours || 0, amount: round((p.overtimeHours || 0) * (p.overtimeRate ?? fallback)) });
const fromAudit = (v: any): Snapshot => ({ overtimeHours: v?.hours, overtimeRate: v?.rate });
const matches = (lines: OvertimeLine[], p: Snapshot, fallback = 0) => {
  const total = snapshot(p, fallback);
  return Math.abs(lines.reduce((s, l) => s + l.hours, 0) - total.hours) < 0.00001 && Math.abs(round(lines.reduce((s, l) => s + l.amount, 0)) - total.amount) < 0.00001;
};
const legacy = (p: Snapshot, fallback = 0): OvertimeLine[] => {
  const total = snapshot(p, fallback);
  return total.hours > 0 ? [{ ...total, rate: null, legacy: true }] : [];
};
function validLines(value: unknown): value is OvertimeLine[] {
  return Array.isArray(value) && value.every(l => l && Number.isFinite(l.hours) && l.hours > 0 && Number.isFinite(l.amount) && l.amount >= 0 && (l.rate === null ? l.legacy === true : Number.isFinite(l.rate) && l.rate > 0));
}
export function appendOvertimeLine(lines: OvertimeLine[], hours: number, rate: number, amount = round(hours * rate)): OvertimeLine[] {
  const next = lines.map(l => ({ ...l }));
  const existing = next.find(l => !l.legacy && l.rate === rate);
  if (existing) { existing.hours = Math.round((existing.hours + hours) * 100) / 100; existing.amount = round(existing.amount + amount); }
  else next.push({ hours, rate, amount });
  return next;
}
/** Audit events must be chronological. Validate snapshots to avoid displaying stale or incomplete history as exact. */
export function overtimeLinesFromHistory(current: Snapshot, audits: OvertimeAudit[], fallback = 0): OvertimeLine[] {
  let lines: OvertimeLine[] = [];
  for (const audit of audits) {
    const before: any = audit.oldValues, after: any = audit.newValues;
    if (!after || typeof after !== 'object') continue;
    const target = fromAudit(after);
    if (validLines(after.hourlyLines) && matches(after.hourlyLines, target)) { lines = after.hourlyLines.map((l: OvertimeLine) => ({ ...l })); continue; }
    const entry = after.entry;
    if (!entry) { lines = legacy(target); continue; }
    if (!matches(lines, fromAudit(before))) lines = legacy(fromAudit(before));
    if (entry.mode === 'reset') lines = [];
    else if (entry.mode === 'hourly' && Number.isFinite(entry.hours) && entry.hours > 0 && Number.isFinite(entry.rate) && entry.rate > 0) {
      const delta = round(snapshot(target).amount - snapshot(fromAudit(before)).amount);
      lines = appendOvertimeLine(lines, entry.hours, entry.rate, delta);
    } else if (entry.mode !== 'fixed') lines = legacy(target);
    if (!matches(lines, target)) lines = legacy(target);
  }
  return matches(lines, current, fallback) ? lines : legacy(current, fallback);
}
