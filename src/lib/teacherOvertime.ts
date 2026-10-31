import prisma from "./prisma";
import { schoolMonth, roundMoney } from "./agent/dataAccuracy";
import { computeTeacherPaymentStatus } from "./payrollUtils";

export async function saveTeacherOvertime(params: {
  schoolId: string;
  adminId: string;
  teacherId: string;
  month: number;
  year: number;
  hours: number;
  expectedRate?: number;
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
      if (existing?.status === "PAID")
        throw new Error(
          "Ce mois est clôturé. Les heures supplémentaires doivent être enregistrées avant le règlement.",
        );
      const rate =
        teacher.hourlyRate && teacher.hourlyRate > 0
          ? teacher.hourlyRate
          : teacher.hoursPerMonth && teacher.hoursPerMonth > 0
            ? roundMoney(teacher.salary / teacher.hoursPerMonth)
            : 0;
      if (params.hours > 0 && rate <= 0)
        throw new Error(
          "Renseignez le taux horaire de l’enseignant avant d’ajouter des heures supplémentaires.",
        );
      if (
        params.expectedRate !== undefined &&
        Math.abs(rate - params.expectedRate) > 0.000001
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
          oldValues: { hours: existing?.overtimeHours || 0 },
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
