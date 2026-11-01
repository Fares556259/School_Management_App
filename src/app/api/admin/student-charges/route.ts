import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getStudentAdminSchool } from "@/lib/studentProfile";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import {
  chargeCalendar,
  collectStudentCharge,
  syncStudentCharges,
  validateMoney,
  CHARGE_KINDS,
} from "@/lib/studentCharges";
import { invalidateTenantTags } from "@/lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function actor(request: NextRequest) {
  if (request.headers.has("Authorization")) {
    const auth = await authenticateMobileRequest(request);
    if (auth.error || auth.payload.userType !== "admin")
      throw new Error("Unauthorized");
    return { schoolId: auth.payload.schoolId, adminId: auth.payload.userId };
  }
  const schoolId = await getStudentAdminSchool();
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");
  return { schoolId, adminId: user.id };
}
function errorResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "Impossible d’enregistrer cette opération.";
  if (/Unauthorized|not authorized|authenticated|Denied/i.test(message))
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 403 },
    );
  if ((error as any)?.code?.startsWith("P")) {
    console.error("[StudentCharges]", error);
    return NextResponse.json(
      {
        success: false,
        error:
          "Impossible d’enregistrer cette opération. Actualisez avant de réessayer.",
      },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: false, error: message }, { status: 400 });
}

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await actor(request);
    const params = request.nextUrl.searchParams;
    const config = await prisma.institution.findUnique({
      where: { schoolId },
      select: {
        registrationFeeEnabled: true,
        registrationFee: true,
        registrationReconciliationYear: true,
        transportMonthlyFee: true,
        gardeMonthlyFee: true,
        academicYear: true,
        halfBoundaryMonths: true,
        yearStart: true,
      },
    });
    if (!config) throw new Error("Configurez d’abord votre école.");
    const calendar = chargeCalendar(config);
    const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
    const kind = params.get("kind");
    const status = params.get("status");
    const search = (params.get("search") || "").trim().slice(0, 100);
    const period = params.get("period");
    const base: Prisma.StudentChargeWhereInput = {
      schoolId,
      academicYear: calendar.academicYear,
    };
    const where: Prisma.StudentChargeWhereInput = {
      ...base,
      ...(kind && CHARGE_KINDS.includes(kind as any) ? { kind } : {}),
      ...(period && /^\d{4}-\d{2}$/.test(period) ? { period } : {}),
      ...(search
        ? {
            student: {
              schoolId,
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { surname: { contains: search, mode: "insensitive" } },
                { class: { name: { contains: search, mode: "insensitive" } } },
              ],
            },
          }
        : {}),
      ...(status === "VOIDED"
        ? { voidedAt: { not: null } }
        : { voidedAt: null }),
      ...(status === "PAID"
        ? { paidAmount: { gte: prisma.studentCharge.fields.amount } }
        : status === "DUE"
          ? { paidAmount: { lt: prisma.studentCharge.fields.amount } }
          : {}),
    };
    const [charges, total, summary, students, services] = await Promise.all([
      prisma.studentCharge.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
        skip: (page - 1) * 25,
        take: 25,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              surname: true,
              class: { select: { name: true } },
            },
          },
          payments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              amount: true,
              paymentMethod: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.studentCharge.count({ where }),
      prisma.studentCharge.aggregate({
        where: { ...base, voidedAt: null },
        _sum: { amount: true, paidAmount: true },
        _count: { id: true },
      }),
      prisma.student.findMany({
        where: { schoolId },
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
        },
        orderBy: [{ name: "asc" }, { surname: "asc" }],
      }),
      prisma.studentServiceAssignment.findMany({
        where: { schoolId },
        include: {
          student: {
            select: {
              name: true,
              surname: true,
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    return NextResponse.json(
      {
        success: true,
        config,
        academicYear: calendar.academicYear,
        charges,
        total,
        page,
        students,
        services,
        summary: {
          billed: summary._sum.amount || 0,
          paid: summary._sum.paidAmount || 0,
          count: summary._count.id,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
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
    if (body.action === "sync")
      return NextResponse.json({
        success: true,
        ...(await syncStudentCharges(schoolId)),
      });
    if (body.action === "collect") {
      if (
        typeof body.chargeId !== "string" ||
        typeof body.idempotencyKey !== "string"
      )
        throw new Error("Échéance et confirmation requises.");
      const result = await collectStudentCharge({
        schoolId,
        adminId,
        chargeId: body.chargeId,
        amount: body.amount,
        idempotencyKey: body.idempotencyKey,
        paymentMethod: body.paymentMethod,
        paidOn: body.paidOn,
      });
      invalidateTenantTags(schoolId, "finance", "dashboard", "incomes");
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "settings") {
      if (typeof body.registrationFeeEnabled !== "boolean")
        throw new Error("Option d’inscription invalide.");
      const registrationFee = validateMoney(body.registrationFee, true);
      if (typeof body.hideCurrentRegistrationFromParents !== "boolean")
        throw new Error("Option de rapprochement invalide.");
      const school = await prisma.institution.findUniqueOrThrow({
        where: { schoolId },
        select: {
          academicYear: true,
          halfBoundaryMonths: true,
          yearStart: true,
        },
      });
      const currentAcademicYear = chargeCalendar(school).academicYear;
      const nullableFee = (value: unknown) =>
        value === null ? null : validateMoney(value, true);
      const config = {
        registrationFeeEnabled: body.registrationFeeEnabled,
        registrationFee,
        registrationReconciliationYear: body.hideCurrentRegistrationFromParents
          ? currentAcademicYear
          : null,
        transportMonthlyFee: nullableFee(body.transportMonthlyFee),
        gardeMonthlyFee: nullableFee(body.gardeMonthlyFee),
      };
      await prisma.$transaction(async (tx) => {
        await tx.institution.update({ where: { schoolId }, data: config });
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "UPDATE",
            performedBy: adminId,
            entityType: "StudentBillingSettings",
            description:
              "Updated registration and optional service rates. Existing charges unchanged.",
            newValues: config,
          },
        });
      });
      const sync = await syncStudentCharges(schoolId);
      invalidateTenantTags(schoolId, "institution", "finance");
      return NextResponse.json({ success: true, ...sync });
    }
    if (body.action === "assign") {
      if (
        !["TRANSPORT", "GARDE"].includes(body.kind) ||
        typeof body.studentId !== "string" ||
        typeof body.active !== "boolean"
      )
        throw new Error("Élève et service requis.");
      const student = await prisma.student.findFirst({
        where: { id: body.studentId, schoolId },
        select: { id: true },
      });
      if (!student) throw new Error("Élève introuvable dans cette école.");
      await syncStudentCharges(schoolId);
      if (!body.active) {
        await prisma.studentServiceAssignment.updateMany({
          where: { studentId: body.studentId, schoolId, kind: body.kind },
          data: { active: false },
        });
      } else {
        const monthlyFee = validateMoney(body.monthlyFee, true);
        const config = await prisma.institution.findUniqueOrThrow({
          where: { schoolId },
        });
        const calendar = chargeCalendar(config);
        if (
          typeof body.startPeriod !== "string" ||
          !/^\d{4}-(0[1-6]|09|1[0-2])$/.test(body.startPeriod) ||
          body.startPeriod < calendar.academicYear.slice(0, 4) + "-09" ||
          body.startPeriod > calendar.academicYear.slice(5) + "-06"
        )
          throw new Error("Choisissez un mois de cette année scolaire.");
        await prisma.studentServiceAssignment.upsert({
          where: {
            schoolId_studentId_kind: {
              schoolId,
              studentId: body.studentId,
              kind: body.kind,
            },
          },
          update: { monthlyFee, startPeriod: body.startPeriod, active: true },
          create: {
            schoolId,
            studentId: body.studentId,
            kind: body.kind,
            monthlyFee,
            startPeriod: body.startPeriod,
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          schoolId,
          action: "UPDATE",
          performedBy: adminId,
          entityType: "StudentServiceAssignment",
          entityId: body.studentId,
          description: `${body.kind}: ${body.active ? "assigned" : "stopped"}. Existing charges retained.`,
        },
      });
      return NextResponse.json({
        success: true,
        ...(await syncStudentCharges(schoolId)),
      });
    }
    if (body.action === "void") {
      if (
        typeof body.chargeId !== "string" ||
        typeof body.reason !== "string" ||
        body.reason.trim().length < 3 ||
        body.reason.length > 500
      )
        throw new Error("Un motif d’annulation est requis.");
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "StudentCharge" WHERE id=${body.chargeId} AND "schoolId"=${schoolId} FOR UPDATE`;
        const updated = await tx.studentCharge.updateMany({
          where: { id: body.chargeId, schoolId, paidAmount: 0, voidedAt: null },
          data: { voidedAt: new Date(), voidReason: body.reason.trim() },
        });
        if (updated.count !== 1)
          throw new Error(
            "Une échéance encaissée ne peut pas être annulée ici. Vérifiez son historique.",
          );
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "VOID",
            performedBy: adminId,
            entityType: "StudentCharge",
            entityId: body.chargeId,
            description: body.reason.trim(),
          },
        });
      });
      return NextResponse.json({ success: true });
    }
    throw new Error("Opération inconnue.");
  } catch (error) {
    return errorResponse(error);
  }
}
