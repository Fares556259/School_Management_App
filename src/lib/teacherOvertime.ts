import prisma from "./prisma";
import { schoolMonth, roundMoney } from "./agent/dataAccuracy";
import { computeTeacherPaymentStatus } from "./payrollUtils";
import { overtimeValues } from "./overtimeAmount";

export async function saveTeacherOvertime(params: {
  schoolId: string;
  adminId: string;
  teacherId: string;
  month: number;
  year: number;
  hours: number;
  expectedRate?: number;
  amount?: number;
  expectedOvertime?: { hours: number; rate: number | null };
  expectedSalary?: { baseSalary: number; deduction: number };
}) {
  const { month, year } = schoolMonth(params.month, params.year);
  if (
    !Number.isFinite(params.hours) ||
    params.hours < 0 ||
    params.hours > 744 ||
    Math.abs(params.hours * 100 - Math.round(params.hours * 100)) > 0.00001
  )
    throw new Error(
      "Heures supplémentaires invalides (0 à 744, maximum 2 décimales).",
    );
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Teacher" WHERE id=${params.teacherId} AND "schoolId"=${params.schoolId} FOR UPDATE`;
      const teacher = await tx.teacher.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId },
      });
      if (!teacher) throw new Error("Enseignant introuvable dans cette école.");
      const existing = await tx.payment.findUnique({
        where: { teacherId_month_year: { teacherId: teacher.id, month, year } },
      });
      if (existing && existing.schoolId !== params.schoolId)
        throw new Error("Paiement introuvable dans cette école.");
      if (existing?.status === "PAID")
        throw new Error(
          "Ce mois est clôturé. Les heures supplémentaires doivent être enregistrées avant le règlement.",
        );
      if (
        params.expectedOvertime &&
        (params.expectedOvertime.hours !== (existing?.overtimeHours || 0) ||
          params.expectedOvertime.rate !== (existing?.overtimeRate ?? null))
      )
        throw new Error(
          "Les heures supplémentaires ont changé. Actualisez avant de confirmer.",
        );
      const defaultRate =
        teacher.hourlyRate && teacher.hourlyRate > 0
          ? teacher.hourlyRate
          : teacher.hoursPerMonth && teacher.hoursPerMonth > 0
            ? roundMoney(teacher.salary / teacher.hoursPerMonth)
            : 0;
      const { rate } = overtimeValues(params.hours, defaultRate, params.amount);
      if (
        params.amount === undefined &&
        params.expectedRate !== undefined &&
        (!Number.isFinite(params.expectedRate) ||
          Math.abs(defaultRate - params.expectedRate) > 0.000001)
      )
        throw new Error(
          "Le taux horaire a changé. Actualisez et vérifiez le nouveau montant avant de confirmer.",
        );
      const calc = computeTeacherPaymentStatus(
        {
          ...teacher,
          payments: [
            {
              ...existing,
              month,
              year,
              overtimeHours: params.hours,
              overtimeRate: rate,
            },
          ],
        },
        month,
        year,
      );
      if (
        params.expectedSalary &&
        (!Number.isFinite(params.expectedSalary.baseSalary) ||
          !Number.isFinite(params.expectedSalary.deduction) ||
          Math.abs(params.expectedSalary.baseSalary - calc.baseSalary) >
            0.00001 ||
          Math.abs(params.expectedSalary.deduction - calc.deduction) > 0.00001)
      )
        throw new Error(
          "Le salaire ou la retenue a changé. Actualisez avant de confirmer.",
        );
      if (calc.netDue < calc.amountPaid)
        throw new Error(
          "Cet ajustement ferait passer le salaire net sous le montant déjà versé. Vérifiez les règlements avant de modifier les heures.",
        );
      const payment = await tx.payment.upsert({
        where: { teacherId_month_year: { teacherId: teacher.id, month, year } },
        update: {
          overtimeHours: params.hours,
          overtimeRate: rate,
          status: calc.isPaid
            ? "PAID"
            : calc.amountPaid > 0
              ? "PARTIAL"
              : "PENDING",
          deferredAmount: calc.remaining,
        },
        create: {
          schoolId: params.schoolId,
          teacherId: teacher.id,
          userType: "TEACHER",
          month,
          year,
          amount: 0,
          overtimeHours: params.hours,
          overtimeRate: rate,
          status: "PENDING",
          deferredAmount: calc.netDue,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: params.schoolId,
          action: "UPDATE",
          performedBy: params.adminId,
          entityType: "TeacherOvertime",
          entityId: payment.id.toString(),
          description: `${month}/${year}: ${params.hours}h × ${rate} TND/h. No salary payment recorded.`,
          oldValues: {
            hours: existing?.overtimeHours || 0,
            rate: existing?.overtimeRate ?? null,
          },
          newValues: {
            hours: params.hours,
            rate,
            overtimeAmount: calc.overtimeAmount,
            netDue: calc.netDue,
          },
        },
      });
      return {
        payment,
        overtimeAmount: calc.overtimeAmount,
        netDue: calc.netDue,
        remaining: calc.remaining,
        rate,
      };
    },
    { timeout: 15000 },
  );
}
