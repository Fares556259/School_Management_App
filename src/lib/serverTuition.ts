import prisma from './prisma';
import { Prisma } from '@prisma/client';

export async function getHalfBoundaryMonths(schoolId: string): Promise<boolean> {
  const institution = await prisma.institution.findUnique({ where: { schoolId }, select: { halfBoundaryMonths: true } });
  return institution?.halfBoundaryMonths === true;
}

/** Constant, tenant-scoped factor for existing aggregate queries. */
export function tuitionFactorSql(schoolId: string, month: number) {
  return Prisma.sql`(CASE WHEN ${month} IN (6, 9) AND COALESCE((SELECT i."halfBoundaryMonths" FROM "Institution" i WHERE i."schoolId" = ${schoolId}), false) THEN 0.5 ELSE 1 END)`;
}

/** School-scoped expected amount, including a student's explicit calendar-month rate. */
export function studentTuitionSql(schoolId: string, month: number, year: number) {
  const period = `${year}-${String(month).padStart(2, '0')}`;
  return Prisma.sql`COALESCE((s."tuitionOverrides" ->> ${period})::numeric, ROUND((COALESCE(s."customTuition", l."tuitionFee", 450) * ${tuitionFactorSql(schoolId, month)})::numeric, 3))`;
}

/** Reprice only expectations/statuses in the selected academic year, never receipts or collected money. */
export async function reconcileTuitionPolicy(tx: Prisma.TransactionClient, schoolId: string, enabled: boolean, academicYear: string) {
  const match = academicYear.match(/^(\d{4})\D+(\d{4})$/);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) throw new Error('A valid academic year is required to change tuition policy.');
  const affected = await tx.$executeRaw`
    WITH repriced AS (
      SELECT p.id, p.status AS old_status, p.amount,
        COALESCE((s."tuitionOverrides" ->> (p.year::text || '-' || LPAD(p.month::text, 2, '0')))::numeric,
          ROUND((COALESCE(s."customTuition", l."tuitionFee", 450) * ${enabled ? 0.5 : 1})::numeric, 3))::float AS fee
      FROM "Payment" p JOIN "Student" s ON s.id = p."studentId" AND s."schoolId" = p."schoolId"
      LEFT JOIN "Level" l ON l.id = s."levelId" AND l."schoolId" = s."schoolId"
      WHERE p."schoolId" = ${schoolId} AND LOWER(p."userType") = 'student'
        AND ((p.month = 9 AND p.year = ${Number(match[1])}) OR (p.month = 6 AND p.year = ${Number(match[2])}))
        AND p.status IN ('PAID', 'PARTIAL', 'PENDING', 'OVERDUE')
    ) UPDATE "Payment" p SET
      "deferredAmount" = GREATEST(0, r.fee - CASE WHEN r.old_status IN ('PAID', 'PARTIAL') THEN r.amount ELSE 0 END),
      status = (CASE WHEN r.fee <= CASE WHEN r.old_status IN ('PAID', 'PARTIAL') THEN r.amount ELSE 0 END THEN 'PAID' WHEN r.old_status IN ('PAID', 'PARTIAL') AND r.amount > 0 THEN 'PARTIAL' WHEN r.old_status = 'OVERDUE' THEN 'OVERDUE' ELSE 'PENDING' END)::"PaymentStatus",
      amount = CASE WHEN r.old_status IN ('PENDING', 'OVERDUE') THEN r.fee ELSE p.amount END
    FROM repriced r WHERE p.id = r.id AND p."schoolId" = ${schoolId}`;
  await tx.auditLog.create({ data: { schoolId, action: 'UPDATE', performedBy: 'School administrator', entityType: 'TuitionPolicy', description: `${enabled ? 'Enabled' : 'Disabled'} half September / June tuition for ${academicYear}. Repriced ${affected} payment expectations; collected money unchanged.`, newValues: { halfBoundaryMonths: enabled, academicYear, affectedPayments: affected } } });
  return affected;
}
