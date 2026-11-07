import prisma from './prisma';
import type { Prisma } from '@prisma/client';
import { overtimeLinesFromHistory, type OvertimeLine } from './overtimeBreakdown';
type Payment = { id?: number; schoolId?: string; overtimeHours?: number | null; overtimeRate?: number | null; overtimeDefaultRate?: number };
/** One school-scoped read for all requested payments; payroll figures remain authoritative. */
export async function attachOvertimeLines<T extends Payment>(schoolId: string, payments: T[], db: Prisma.TransactionClient = prisma, defaultRate = 0): Promise<Array<T & { overtimeLines: OvertimeLine[] }>> {
  const ids = payments.filter(p => p.id && (!p.schoolId || p.schoolId === schoolId) && (p.overtimeHours || 0) > 0).map(p => String(p.id));
  const audits = ids.length ? await db.auditLog.findMany({ where: { schoolId, entityType: 'TeacherOvertime', entityId: { in: ids } }, orderBy: { id: 'asc' }, select: { entityId: true, oldValues: true, newValues: true } }) : [];
  const grouped = new Map<string, typeof audits>();
  for (const audit of audits) { const key = audit.entityId!; const group = grouped.get(key) || []; group.push(audit); grouped.set(key, group); }
  return payments.map(p => ({ ...p, overtimeLines: p.schoolId && p.schoolId !== schoolId ? [] : overtimeLinesFromHistory(p, grouped.get(String(p.id)) || [], p.overtimeDefaultRate ?? defaultRate) }));
}

export async function attachTeacherOvertimeLines<T extends { payments: Payment[]; salary?: number | null; hourlyRate?: number | null; hoursPerMonth?: number | null }>(schoolId: string, teachers: T[]) {
  const payments = await attachOvertimeLines(schoolId, teachers.flatMap(teacher => teacher.payments.map(p => ({ ...p, overtimeDefaultRate: teacher.hourlyRate && teacher.hourlyRate > 0 ? teacher.hourlyRate : teacher.hoursPerMonth && teacher.hoursPerMonth > 0 ? (teacher.salary || 0) / teacher.hoursPerMonth : 0 }))));
  const lines = new Map(payments.map(p => [p.id, p.overtimeLines]));
  return teachers.map(teacher => ({ ...teacher, payments: teacher.payments.map(p => ({ ...p, overtimeLines: lines.get(p.id) || [] })) }));
}
