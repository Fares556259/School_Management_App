import prisma from "./prisma";
import { attachOvertimeLines } from "./teacherOvertimeBreakdown";
import { appendOvertimeLine } from "./overtimeBreakdown";
import { schoolMonth, roundMoney } from "./agent/dataAccuracy";
import { computeTeacherPaymentStatus } from "./payrollUtils";
import {
  overtimeValues,
  appendOvertime,
  type OvertimeEntry,
} from "./overtimeAmount";

export async function saveTeacherOvertime(params: {
  schoolId: string;
  adminId: string;
  teacherId: string;
  month: number;
  year: number;
  hours: number;
  expectedRate?: number;
  amount?: number;
  entry?: OvertimeEntry;
  expectedOvertime?: {
    hours: number;
    rate: number | null;
    fixedAmount?: number;
  };
  expectedSalary?: {
    baseSalary: number;
    deduction: number;
    amountPaid?: number;
  };
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
          params.expectedOvertime.rate !== (existing?.overtimeRate ?? null) ||
          (params.expectedOvertime.fixedAmount ?? 0) !==
            (existing?.overtimeFixedAmount || 0))
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
      if (params.entry && (!params.expectedOvertime || !params.expectedSalary))
        throw new Error(
          "Actualisez la paie avant de confirmer cet ajustement.",
        );
      const next = params.entry
        ? appendOvertime(existing, params.entry, defaultRate)
        : {
            hours: params.hours,
            rate: overtimeValues(params.hours, defaultRate, params.amount).rate,
            fixedAmount: existing?.overtimeFixedAmount || 0,
          };
      const { hours, rate, fixedAmount } = next;
      const [previous] = await attachOvertimeLines(params.schoolId, existing ? [existing] : [], tx, defaultRate);
      const previousLines = previous?.overtimeLines || [];
      const hourlyLines = params.entry?.mode === "reset" ? [] : params.entry?.mode === "hourly"
        ? appendOvertimeLine(previousLines, params.entry.hours, params.entry.rate, roundMoney(hours * rate - (existing?.overtimeHours || 0) * (existing?.overtimeRate ?? defaultRate)))
        : params.entry?.mode === "fixed" ? previousLines
        : hours > 0 ? [{ hours, rate: null, amount: roundMoney(hours * rate), legacy: true }] : [];
      if (
        !params.entry &&
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
              overtimeHours: hours,
              overtimeFixedAmount: fixedAmount,
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
          (params.expectedSalary.amountPaid !== undefined &&
            (!Number.isFinite(params.expectedSalary.amountPaid) ||
              params.expectedSalary.amountPaid !== calc.amountPaid)) ||
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
          overtimeHours: hours,
          overtimeFixedAmount: fixedAmount,
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
          overtimeHours: hours,
          overtimeFixedAmount: fixedAmount,
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
          description: `${month}/${year}: ${hours}h × ${rate} TND/h + ${fixedAmount} TND fixed. No salary payment recorded.`,
          oldValues: {
            hours: existing?.overtimeHours || 0,
            rate: existing?.overtimeRate ?? null,
            fixedAmount: existing?.overtimeFixedAmount || 0,
          },
          newValues: {
            hours,
            rate,
            fixedAmount,
            entry: params.entry ?? null,
            hourlyLines: JSON.parse(JSON.stringify(hourlyLines)),
            overtimeAmount: calc.overtimeAmount,
            netDue: calc.netDue,
          },
        },
      });
      return {
        payment: { ...payment, overtimeLines: hourlyLines },
        overtimeAmount: calc.overtimeAmount,
        netDue: calc.netDue,
        remaining: calc.remaining,
        rate,
      };
    },
    { timeout: 15000 },
  );
}
