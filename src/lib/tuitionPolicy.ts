/** School tuition amounts use Tunisian dinars, rounded to the millime. */
export function tuitionForMonth(baseFee: number, month: number, halfBoundaryMonths = false): number {
  if (!Number.isFinite(baseFee) || baseFee < 0 || !Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid tuition amount or month');
  return Math.round((baseFee * (halfBoundaryMonths && (month === 9 || month === 6) ? 0.5 : 1) + Number.EPSILON) * 1000) / 1000;
}

/** An explicit student amount applies only to its calendar month and school year. */
export function studentTuitionForMonth(student: { customTuition?: number | null; level?: { tuitionFee?: number | null } | null; tuitionOverrides?: unknown }, month: number, year: number, halfBoundaryMonths = false): number {
  const standard = tuitionForMonth(student.customTuition ?? student.level?.tuitionFee ?? 450, month, halfBoundaryMonths);
  const overrides = student.tuitionOverrides;
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return standard;
  const value = (overrides as Record<string, unknown>)[`${year}-${String(month).padStart(2, '0')}`];
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : standard;
}

export function tuitionMonthlyBalance(baseFee: number, month: number, halfBoundaryMonths: boolean, payment?: { status?: string; amount?: number | null; deferredAmount?: number | null }) {
  const fee = tuitionForMonth(baseFee, month, halfBoundaryMonths);
  const received = payment && ['PAID', 'PARTIAL'].includes(payment.status || '') ? Number(payment.amount || 0) : 0;
  // Pending payment amounts represent an expectation, never money received.
  // Recalculate from the effective fee; old deferred amounts may use the full tariff.
  const due = Math.round((Math.max(0, fee - received) + Number.EPSILON) * 1000) / 1000;
  return { fee, received, due, status: due === 0 ? 'PAID' : received > 0 ? 'PARTIAL' : 'UNPAID' };
}
