import prisma from "./prisma";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { schoolDate, roundMoney } from "./agent/dataAccuracy";

export const CHARGE_KINDS = ["REGISTRATION", "TRANSPORT", "GARDE"] as const;
export function validateMoney(value: unknown, allowZero = false): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < (allowZero ? 0 : 0.001) ||
    value > 1_000_000 ||
    Math.abs(value * 1000 - Math.round(value * 1000)) > 0.00001
  )
    throw new Error("Montant invalide (maximum 3 décimales).");
  return roundMoney(value);
}
export function chargeCalendar(
  config: {
    academicYear: string;
    halfBoundaryMonths?: boolean;
    yearStart?: Date;
  },
  now = new Date(),
) {
  const [year, month] = schoolDate(now).split("-").map(Number);
  const configured = Number(config.academicYear.match(/^(\d{4})/)?.[1] || 0);
  const startYear = Math.max(configured, month >= 9 ? year : year - 1);
  const academicYear = `${startYear}-${startYear + 1}`;
  const startDay = config.halfBoundaryMonths
    ? 15
    : Math.min(28, config.yearStart?.getUTCDate() || 1);
  const start = new Date(
    `${startYear}-09-${String(startDay).padStart(2, "0")}T00:00:00+01:00`,
  );
  const periods = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]
    .map((m) => ({ month: m, year: m >= 9 ? startYear : startYear + 1 }))
    .map(({ month, year }) => ({
      period: `${year}-${String(month).padStart(2, "0")}`,
      dueDate:
        month === 9
          ? start
          : new Date(
              `${year}-${String(month).padStart(2, "0")}-01T00:00:00+01:00`,
            ),
    }));
  return {
    academicYear,
    start,
    periods: periods.filter((p) => p.dueDate <= now),
  };
}

/** Idempotent, school-scoped billing. Existing charges and receipts are immutable here. */
export async function ensureAnnualRegistration(
  schoolId: string,
  studentId: string,
  now = new Date(),
) {
  const [config, student] = await Promise.all([
    prisma.institution.findUnique({ where: { schoolId } }),
    prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { id: true, createdAt: true },
    }),
  ]);
  if (!config?.registrationFeeEnabled || !student) return;
  const calendar = chargeCalendar(config, now);
  if (now < calendar.start) return;
  await prisma.studentCharge.createMany({
    data: [
      {
        schoolId,
        studentId,
        kind: "REGISTRATION",
        period: calendar.academicYear,
        academicYear: calendar.academicYear,
        amount: config.registrationFee,
        dueDate:
          student.createdAt > calendar.start
            ? student.createdAt
            : calendar.start,
      },
    ],
    skipDuplicates: true,
  });
}

export async function syncStudentCharges(schoolId: string, now = new Date()) {
  const config = await prisma.institution.findUnique({ where: { schoolId } });
  if (!config) return { created: 0 };
  const calendar = chargeCalendar(config, now);
  if (now < calendar.start)
    return { created: 0, academicYear: calendar.academicYear };
  const [students, services] = await Promise.all([
    config.registrationFeeEnabled
      ? prisma.student.findMany({
          where: { schoolId },
          select: { id: true, createdAt: true },
        })
      : Promise.resolve([]),
    prisma.studentServiceAssignment.findMany({
      where: { schoolId, active: true, student: { schoolId } },
    }),
  ]);
  const rows: Prisma.StudentChargeCreateManyInput[] = students.map(
    (student) => ({
      schoolId,
      studentId: student.id,
      kind: "REGISTRATION",
      academicYear: calendar.academicYear,
      period: calendar.academicYear,
      amount: config.registrationFee,
      dueDate:
        student.createdAt > calendar.start ? student.createdAt : calendar.start,
    }),
  );
  for (const service of services)
    for (const period of calendar.periods) {
      if (period.period >= service.startPeriod)
        rows.push({
          schoolId,
          studentId: service.studentId,
          kind: service.kind,
          academicYear: calendar.academicYear,
          period: period.period,
          amount: service.monthlyFee,
          dueDate: period.dueDate,
        });
    }
  if (!rows.length) return { created: 0, academicYear: calendar.academicYear };
  // Batches keep newly opened schools with thousands of students within DB parameter limits.
  let created = 0;
  for (let offset = 0; offset < rows.length; offset += 500)
    created += (
      await prisma.studentCharge.createMany({
        data: rows.slice(offset, offset + 500),
        skipDuplicates: true,
      })
    ).count;
  return { created, academicYear: calendar.academicYear };
}

export async function collectStudentCharge(input: {
  schoolId: string;
  adminId: string;
  chargeId: string;
  amount: number;
  idempotencyKey: string;
  paymentMethod?: string;
}) {
  const amount = validateMoney(input.amount);
  if (!/^[\w-]{16,128}$/.test(input.idempotencyKey))
    throw new Error("Identifiant de paiement invalide.");
  const paymentMethod = input.paymentMethod || "Espèces";
  if (!["Espèces", "Chèque", "Virement", "Carte"].includes(paymentMethod))
    throw new Error("Mode de règlement invalide.");
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "StudentCharge" WHERE id = ${input.chargeId} AND "schoolId" = ${input.schoolId} FOR UPDATE`;
      const previous = await tx.studentChargePayment.findUnique({
        where: {
          schoolId_idempotencyKey: {
            schoolId: input.schoolId,
            idempotencyKey: input.idempotencyKey,
          },
        },
      });
      if (previous) {
        if (
          previous.chargeId !== input.chargeId ||
          previous.amount !== amount ||
          previous.paymentMethod !== paymentMethod
        )
          throw new Error(
            "Ce paiement a déjà été utilisé avec des détails différents.",
          );
        return { payment: previous, duplicate: true };
      }
      const charge = await tx.studentCharge.findFirst({
        where: {
          id: input.chargeId,
          schoolId: input.schoolId,
          student: { schoolId: input.schoolId },
        },
        include: { student: { select: { name: true, surname: true } } },
      });
      if (!charge || charge.voidedAt)
        throw new Error("Échéance introuvable ou annulée dans cette école.");
      if (amount > roundMoney(charge.amount - charge.paidAmount))
        throw new Error(
          "Le montant dépasse le solde restant. Actualisez la liste.",
        );
      const payment = await tx.studentChargePayment.create({
        data: {
          id: randomUUID(),
          schoolId: input.schoolId,
          chargeId: charge.id,
          amount,
          paymentMethod,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.studentCharge.update({
        where: { id: charge.id },
        data: { paidAmount: roundMoney(charge.paidAmount + amount) },
      });
      await tx.income.create({
        data: {
          schoolId: input.schoolId,
          title: `${charge.kind}: ${charge.student.name} ${charge.student.surname} (${charge.period})`,
          category:
            charge.kind === "REGISTRATION"
              ? "Inscription"
              : charge.kind === "TRANSPORT"
                ? "Transport"
                : "Garde",
          amount,
          date: new Date(),
          referenceType: "StudentChargePayment",
          referenceId: payment.id,
        },
      });
      await tx.auditLog.create({
        data: {
          schoolId: input.schoolId,
          action: "CREATE",
          performedBy: input.adminId,
          entityType: "StudentChargePayment",
          entityId: payment.id,
          description: `${charge.kind} · ${charge.period} · ${paymentMethod}`,
          amount,
          type: "income",
        },
      });
      return { payment, duplicate: false };
    },
    { timeout: 15000 },
  );
}
