import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { parseMonthYear } from "@/lib/dateUtils";
import { tuitionForMonth } from "@/lib/tuitionPolicy";
import { schoolDate, roundMoney } from "@/lib/agent/dataAccuracy";
import { invalidateTenantTags } from "@/lib/cache";
import { revalidatePath } from "next/cache";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
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
async function actor(request: NextRequest) {
  if (request.headers.has("Authorization")) {
    const auth = await authenticateMobileRequest(request);
    if (auth.error || auth.payload.userType !== "admin")
      throw new Error("Unauthorized");
    return { schoolId: auth.payload.schoolId, adminId: auth.payload.userId };
  }
  const [schoolId, user] = await Promise.all([
    getStudentAdminSchool(),
    getAuthenticatedUser(),
  ]);
  if (!user) throw new Error("Unauthorized");
  return { schoolId, adminId: user.id };
}
const fail = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Payment failed";
  return NextResponse.json(
    { success: false, error: message },
    { status: message === "Unauthorized" ? 403 : 400 },
  );
};
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await actor(request);
    const studentId = request.nextUrl.searchParams.get("studentId");
    if (!studentId)
      return NextResponse.json(
        { success: false, error: "Student required" },
        { status: 400 },
      );
    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: {
        id: true,
        name: true,
        surname: true,
        customTuition: true,
        level: { select: { tuitionFee: true } },
      },
    });
    if (!student)
      return NextResponse.json(
        { success: false, error: "Student not found" },
        { status: 404 },
      );
    const [institution, payments, charges] = await Promise.all([
      prisma.institution.findUniqueOrThrow({
        where: { schoolId },
        select: { halfBoundaryMonths: true, academicYear: true },
      }),
      prisma.payment.findMany({
        where: { schoolId, studentId, userType: "STUDENT" },
        select: { month: true, year: true, amount: true, status: true },
      }),
      prisma.studentCharge.findMany({
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
    ]);
    return NextResponse.json(
      {
        success: true,
        student,
        tuitionFee: student.customTuition ?? student.level?.tuitionFee ?? 450,
        halfBoundaryMonths: institution.halfBoundaryMonths,
        academicYear: institution.academicYear,
        payments,
        charges,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return fail(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (
      !request.headers.has("Authorization") &&
      origin &&
      origin !== request.nextUrl.origin
    )
      throw new Error("Unauthorized");
    const { schoolId, adminId } = await actor(request);
    const body = await request.json();
    if (
      !["Espèces", "Chèque", "Virement", "Carte"].includes(body.paymentMethod)
    )
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
    if (tuitionItems.length === 0 && items.length === 0)
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
            stableJson(previous.allocations) !== stableJson(normalized) ||
            schoolDate(previous.paidAt) !== body.paidOn
          )
            throw new Error("Receipt key used with different details");
          return {
            receiptId: previous.id,
            total: previous.amount,
            duplicate: true,
          };
        }
        const institution = await tx.institution.findUniqueOrThrow({
          where: { schoolId },
          select: { halfBoundaryMonths: true },
        });
        const incomeLines: {
          title: string;
          amount: number;
          category: string;
        }[] = [];
        for (const tuitionLine of normalized.tuition) {
          const parsed = parseMonthYear(tuitionLine.monthYear);
          const expected = tuitionForMonth(
            student.customTuition ?? student.level?.tuitionFee ?? 450,
            parsed.month,
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
          const already =
            existing && ["PAID", "PARTIAL"].includes(existing.status)
              ? existing.amount
              : 0;
          if (tuitionLine.amount > roundMoney(expected - already))
            throw new Error(
              "Tuition balance changed; refresh before collecting",
            );
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
            throw new Error(
              "Charge balance changed; refresh before collecting",
            );
          await tx.studentCharge.update({
            where: { id: item.id },
            data: { paidAmount: { increment: item.amount } },
          });
          incomeLines.push({
            title: `${charge.kind}: ${student.name} ${student.surname} (${charge.period})`,
            amount: item.amount,
            category:
              charge.kind === "REGISTRATION"
                ? "Registration"
                : charge.kind === "TRANSPORT"
                  ? "Transport"
                  : "Garde",
          });
        }
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
        for (const item of normalized.charges)
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
    invalidateTenantTags(
      schoolId,
      "students",
      "finance",
      "dashboard",
      "incomes",
    );
    try {
      revalidatePath("/list/students");
    } catch (error) {
      console.warn("[StudentBilling] Cache revalidation skipped:", error);
    }
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return fail(error);
  }
}
