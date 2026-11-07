import prisma from "./prisma";
import type { Prisma } from "@prisma/client";
import { parseMonthYear } from "./dateUtils";
import { studentTuitionForMonth } from "./tuitionPolicy";
import { schoolDate, roundMoney } from "./agent/dataAccuracy";
import { actionReviewFingerprint } from "./agent/actionReview";
import { invalidateTenantTags } from "./cache";
import { revalidatePath } from "next/cache";
import {
  chargeCalendar,
  discountedServiceAmount,
  serviceFrequency,
} from "./studentCharges";
const money = (value: unknown) =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value > 0 &&
  value <= 1_000_000 &&
  Math.abs(value * 1000 - Math.round(value * 1000)) < 0.00001;
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => a.localeCompare(b)),
        )
      : item,
  );

export function studentBillingVersion(value: unknown) {
  return actionReviewFingerprint("billing", "student", value);
}

export async function getStudentBilling(
  schoolId: string,
  studentId: string,
  db: Prisma.TransactionClient = prisma,
) {
  const student = await db.student.findFirst({
    where: { id: studentId, schoolId },
    select: {
      id: true,
      name: true,
      surname: true,
      customTuition: true,
      tuitionOverrides: true,
      level: { select: { tuitionFee: true } },
    },
  });
  if (!student) throw new Error("Student not found");
  const [institution, payments, charges, categories, busAssignment] =
    await Promise.all([
      db.institution.findUniqueOrThrow({
        where: { schoolId },
        select: {
          halfBoundaryMonths: true,
          academicYear: true,
          transportFrequency: true,
          gardeFrequency: true,
          transportNextFrequency: true,
          gardeNextFrequency: true,
          transportFrequencyYear: true,
          gardeFrequencyYear: true,
          yearStart: true,
        },
      }),
      db.payment.findMany({
        where: { schoolId, studentId, userType: "STUDENT" },
        orderBy: [{ year: "asc" }, { month: "asc" }],
        select: { month: true, year: true, amount: true, status: true },
      }),
      db.studentCharge.findMany({
        where: { schoolId, studentId, voidedAt: null },
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        select: {
          id: true,
          kind: true,
          period: true,
          academicYear: true,
          amount: true,
          paidAmount: true,
          dueDate: true,
        },
      }),
      db.studentChargeCategory.findMany({
        where: { schoolId },
        select: { kind: true, name: true },
      }),
      db.studentServiceAssignment.findUnique({
        where: {
          schoolId_studentId_kind: { schoolId, studentId, kind: "TRANSPORT" },
        },
        select: {
          active: true,
          startPeriod: true,
          monthlyFee: true,
          discountType: true,
          discountValue: true,
        },
      }),
    ]);
  const categoryNames = new Map(
    categories.map((category) => [category.kind, category.name]),
  );
  return {
    success: true,
    student,
    tuitionFee: student.customTuition ?? student.level?.tuitionFee ?? 450,
    halfBoundaryMonths: institution.halfBoundaryMonths,
    academicYear: institution.academicYear,
    bus:
      busAssignment?.active &&
      serviceFrequency(
        institution,
        "TRANSPORT",
        chargeCalendar(institution).academicYear,
      ) === "MONTHLY"
        ? {
            startPeriod: busAssignment.startPeriod,
            academicYear: chargeCalendar(institution).academicYear,
            monthlyAmount: discountedServiceAmount(
              busAssignment.monthlyFee,
              busAssignment.discountType,
              busAssignment.discountValue,
            ),
          }
        : null,
    payments,
    charges: charges.map((charge) => ({
      ...charge,
      categoryName: categoryNames.get(charge.kind) || null,
    })),
  };
}

export async function collectStudentBilling(
  body: any,
  actor: { schoolId: string; adminId: string },
) {
  const { schoolId, adminId } = actor;
  if (!["Espèces", "Chèque", "Virement", "Carte"].includes(body.paymentMethod))
    throw new Error("Invalid payment method");
  if (
    typeof body.studentId !== "string" ||
    typeof body.idempotencyKey !== "string" ||
    !/^[\w-]{16,128}$/.test(body.idempotencyKey)
  )
    throw new Error("Invalid student or receipt key");
  if (
    typeof body.paidOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(body.paidOn) ||
    body.paidOn > schoolDate(new Date())
  )
    throw new Error("Invalid payment date");
  const paidAt = new Date(`${body.paidOn}T12:00:00+01:00`);
  if (Number.isNaN(paidAt.getTime()) || schoolDate(paidAt) !== body.paidOn)
    throw new Error("Invalid payment date");
  const tuitionItems =
    body.tuition == null
      ? []
      : Array.isArray(body.tuition)
        ? body.tuition
        : [body.tuition];
  if (
    tuitionItems.length > 12 ||
    tuitionItems.some(
      (item: any) =>
        !item || !money(item.amount) || typeof item.monthYear !== "string",
    )
  )
    throw new Error("Invalid tuition amount");
  const items = body.charges;
  const advanceBus = body.advanceBus == null ? [] : body.advanceBus;
  if (
    !Array.isArray(advanceBus) ||
    advanceBus.length > 10 ||
    advanceBus.some(
      (item: any) =>
        !item || typeof item.period !== "string" || !money(item.amount),
    )
  )
    throw new Error("Invalid bus month or amount");
  if (
    new Set(advanceBus.map((item: any) => item.period)).size !==
    advanceBus.length
  )
    throw new Error("Duplicate bus month");
  if (
    !Array.isArray(items) ||
    items.length > 50 ||
    items.some(
      (item: unknown) =>
        !item ||
        typeof item !== "object" ||
        typeof (item as any).id !== "string" ||
        !money((item as any).amount),
    )
  )
    throw new Error("Invalid charge selection");
  if (new Set(items.map((item: any) => item.id)).size !== items.length)
    throw new Error("Duplicate charge");
  if (
    tuitionItems.length === 0 &&
    items.length === 0 &&
    advanceBus.length === 0
  )
    throw new Error("Select at least one payment");
  const normalized = {
    tuition: tuitionItems
      .map((item: any) => ({
        monthYear: parseMonthYear(item.monthYear).monthKey,
        amount: roundMoney(item.amount),
      }))
      .sort((a: any, b: any) => a.monthYear.localeCompare(b.monthYear)),
    charges: items
      .map((item: any) => ({ id: item.id, amount: roundMoney(item.amount) }))
      .sort((a: any, b: any) => a.id.localeCompare(b.id)),
    advanceBus: advanceBus
      .map((item: any) => ({
        period: item.period,
        amount: roundMoney(item.amount),
      }))
      .sort((a: any, b: any) => a.period.localeCompare(b.period)),
  };
  if (
    new Set(normalized.tuition.map((item: any) => item.monthYear)).size !==
    normalized.tuition.length
  )
    throw new Error("Duplicate tuition month");
  const total = roundMoney(
    normalized.tuition.reduce(
      (sum: number, item: any) => sum + item.amount,
      0,
    ) +
      normalized.charges.reduce(
        (sum: number, item: any) => sum + item.amount,
        0,
      ) +
      normalized.advanceBus.reduce(
        (sum: number, item: any) => sum + item.amount,
        0,
      ),
  );
  const result = await prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Student" WHERE id=${body.studentId} AND "schoolId"=${schoolId} FOR UPDATE`;
      const student = await tx.student.findFirst({
        where: { id: body.studentId, schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          customTuition: true,
          tuitionOverrides: true,
          level: { select: { tuitionFee: true } },
        },
      });
      if (!student) throw new Error("Student not found in this school");
      const previous = await tx.studentBillingReceipt.findUnique({
        where: {
          schoolId_idempotencyKey: {
            schoolId,
            idempotencyKey: body.idempotencyKey,
          },
        },
      });
      if (previous) {
        if (
          previous.studentId !== body.studentId ||
          previous.amount !== total ||
          previous.paymentMethod !== body.paymentMethod ||
          stableJson({
            ...(previous.allocations as Record<string, unknown>),
            advanceBus:
              (previous.allocations as { advanceBus?: unknown }).advanceBus ??
              [],
          }) !== stableJson(normalized) ||
          schoolDate(previous.paidAt) !== body.paidOn
        )
          throw new Error("Receipt key used with different details");
        return {
          receiptId: previous.id,
          total: previous.amount,
          duplicate: true,
        };
      }
      if (
        body.expectedVersion &&
        body.expectedVersion !==
          studentBillingVersion(
            await getStudentBilling(schoolId, body.studentId, tx),
          )
      )
        throw new Error(
          "Les soldes ont changé. Vérifiez la nouvelle proposition avant de confirmer.",
        );
      const institution = await tx.institution.findUniqueOrThrow({
        where: { schoolId },
        select: {
          halfBoundaryMonths: true,
          academicYear: true,
          yearStart: true,
          transportFrequency: true,
          gardeFrequency: true,
          transportNextFrequency: true,
          gardeNextFrequency: true,
          transportFrequencyYear: true,
          gardeFrequencyYear: true,
        },
      });
      const busPaymentIds: { id: string; amount: number }[] = [];
      const incomeLines: {
        title: string;
        amount: number;
        category: string;
      }[] = [];
      for (const tuitionLine of normalized.tuition) {
        const parsed = parseMonthYear(tuitionLine.monthYear);
        const expected = studentTuitionForMonth(
          student,
          parsed.month,
          parsed.year,
          institution.halfBoundaryMonths,
        );
        const existing = await tx.payment.findUnique({
          where: {
            studentId_month_year: {
              studentId: body.studentId,
              month: parsed.month,
              year: parsed.year,
            },
          },
        });
        if (existing && existing.schoolId !== schoolId)
          throw new Error("Payment belongs to another school");
        const already =
          existing && ["PAID", "PARTIAL"].includes(existing.status)
            ? existing.amount
            : 0;
        if (tuitionLine.amount > roundMoney(expected - already))
          throw new Error("Tuition balance changed; refresh before collecting");
        const newPaid = roundMoney(already + tuitionLine.amount);
        const gap = roundMoney(expected - newPaid);
        await tx.payment.upsert({
          where: {
            studentId_month_year: {
              studentId: body.studentId,
              month: parsed.month,
              year: parsed.year,
            },
          },
          update: {
            amount: newPaid,
            status: gap <= 0 ? "PAID" : "PARTIAL",
            deferredAmount: gap,
            paidAt,
          },
          create: {
            studentId: body.studentId,
            schoolId,
            userType: "STUDENT",
            month: parsed.month,
            year: parsed.year,
            amount: newPaid,
            status: gap <= 0 ? "PAID" : "PARTIAL",
            deferredAmount: gap,
            paidAt,
          },
        });
        incomeLines.push({
          title: `Tuition: ${student.name} ${student.surname} (${parsed.monthKey})`,
          amount: tuitionLine.amount,
          category: "Tuition",
        });
      }
      for (const item of normalized.charges) {
        await tx.$queryRaw`SELECT id FROM "StudentCharge" WHERE id=${item.id} AND "schoolId"=${schoolId} FOR UPDATE`;
        const charge = await tx.studentCharge.findFirst({
          where: {
            id: item.id,
            schoolId,
            studentId: body.studentId,
            voidedAt: null,
          },
        });
        if (!charge) throw new Error("Charge not found in this school");
        if (item.amount > roundMoney(charge.amount - charge.paidAmount))
          throw new Error("Charge balance changed; refresh before collecting");
        await tx.studentCharge.update({
          where: { id: item.id },
          data: { paidAmount: { increment: item.amount } },
        });
        const customCategory = charge.kind.startsWith("CUSTOM_")
          ? await tx.studentChargeCategory.findUnique({
              where: { schoolId_kind: { schoolId, kind: charge.kind } },
              select: { name: true },
            })
          : null;
        incomeLines.push({
          title: `${charge.kind}: ${student.name} ${student.surname} (${charge.period})`,
          amount: item.amount,
          category:
            charge.kind === "REGISTRATION"
              ? "Registration"
              : charge.kind === "TRANSPORT"
                ? "Transport"
                : charge.kind === "GARDE"
                  ? "Garde"
                  : customCategory?.name || "Service",
        });
      }
      if (normalized.advanceBus.length) {
        const calendar = chargeCalendar(institution);
        const assignment = await tx.studentServiceAssignment.findUnique({
          where: {
            schoolId_studentId_kind: {
              schoolId,
              studentId: body.studentId,
              kind: "TRANSPORT",
            },
          },
        });
        if (
          !assignment?.active ||
          serviceFrequency(institution, "TRANSPORT", calendar.academicYear) !==
            "MONTHLY"
        )
          throw new Error(
            "Monthly bus subscription is no longer active; refresh before collecting",
          );
        const [firstYear] = calendar.academicYear.split("-").map(Number);
        const validPeriods = new Set(
          [9, 10, 11, 12, 1, 2, 3, 4, 5, 6].map(
            (month) =>
              `${month >= 9 ? firstYear : firstYear + 1}-${String(month).padStart(2, "0")}`,
          ),
        );
        const currentPrice = discountedServiceAmount(
          assignment.monthlyFee,
          assignment.discountType,
          assignment.discountValue,
        );
        for (const item of normalized.advanceBus) {
          if (
            !validPeriods.has(item.period) ||
            item.period < assignment.startPeriod
          )
            throw new Error("Bus month is outside this student's subscription");
          const dueDate = item.period.endsWith("-09")
            ? calendar.start
            : new Date(`${item.period}-01T00:00:00+01:00`);
          await tx.studentCharge.createMany({
            data: [
              {
                schoolId,
                studentId: body.studentId,
                kind: "TRANSPORT",
                academicYear: calendar.academicYear,
                period: item.period,
                amount: currentPrice,
                dueDate,
              },
            ],
            skipDuplicates: true,
          });
          const charge = await tx.studentCharge.findUniqueOrThrow({
            where: {
              schoolId_studentId_kind_period: {
                schoolId,
                studentId: body.studentId,
                kind: "TRANSPORT",
                period: item.period,
              },
            },
          });
          if (
            charge.voidedAt ||
            item.amount > roundMoney(charge.amount - charge.paidAmount) ||
            normalized.charges.some(
              (selected: { id: string }) => selected.id === charge.id,
            )
          )
            throw new Error("Bus balance changed; refresh before collecting");
          await tx.studentCharge.update({
            where: { id: charge.id },
            data: { paidAmount: { increment: item.amount } },
          });
          busPaymentIds.push({ id: charge.id, amount: item.amount });
          incomeLines.push({
            title: `TRANSPORT: ${student.name} ${student.surname} (${item.period})`,
            amount: item.amount,
            category: "Transport",
          });
        }
      }
      if (
        roundMoney(incomeLines.reduce((sum, line) => sum + line.amount, 0)) !==
        total
      )
        throw new Error("Income lines do not match the payment total");
      const receipt = await tx.studentBillingReceipt.create({
        data: {
          schoolId,
          studentId: body.studentId,
          idempotencyKey: body.idempotencyKey,
          amount: total,
          paymentMethod: body.paymentMethod,
          paidAt,
          allocations: normalized,
        },
      });
      for (const item of [...normalized.charges, ...busPaymentIds])
        await tx.studentChargePayment.create({
          data: {
            schoolId,
            chargeId: item.id,
            amount: item.amount,
            paymentMethod: body.paymentMethod || "Espèces",
            idempotencyKey: `${receipt.id}-${item.id}`,
            paidAt,
          },
        });
      for (const line of incomeLines)
        await tx.income.create({
          data: {
            schoolId,
            title: line.title,
            amount: line.amount,
            date: paidAt,
            category: line.category,
            referenceType: "StudentBillingReceipt",
            referenceId: receipt.id,
          },
        });
      await tx.auditLog.create({
        data: {
          schoolId,
          action: "CREATE",
          performedBy: adminId,
          entityType: "StudentBillingReceipt",
          entityId: receipt.id,
          description: `Collected ${total} TND for ${student.name} ${student.surname} across ${incomeLines.length} item(s).`,
          amount: total,
          effectiveDate: paidAt,
          newValues: normalized,
        },
      });
      return { receiptId: receipt.id, total, duplicate: false };
    },
    { timeout: 30000 },
  );
  invalidateTenantTags(schoolId, "students", "finance", "dashboard", "incomes");
  try {
    revalidatePath("/list/students");
    revalidatePath("/list/incomes");
    revalidatePath("/admin/finance");
  } catch (error) {
    console.warn("[StudentBilling] Cache revalidation skipped:", error);
  }
  return { success: true as const, ...result };
}
