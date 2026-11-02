import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
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
  serviceFrequency,
  isCustomChargeKind,
} from "@/lib/studentCharges";
import { invalidateTenantTags } from "@/lib/cache";
import { revalidatePath } from "next/cache";

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
        transportFrequency: true,
        gardeFrequency: true,
        transportNextFrequency: true,
        gardeNextFrequency: true,
        transportFrequencyYear: true,
        gardeFrequencyYear: true,
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
      ...(kind &&
      (CHARGE_KINDS.includes(kind as any) || isCustomChargeKind(kind))
        ? { kind }
        : {}),
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
    const [
      categories,
      charges,
      total,
      summary,
      students,
      services,
      serviceBalances,
    ] = await Promise.all([
      prisma.studentChargeCategory.findMany({
        where: { schoolId },
        orderBy: { createdAt: "asc" },
      }),
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
      prisma.studentCharge.groupBy({
        by: ["studentId", "kind"],
        where: {
          schoolId,
          academicYear: calendar.academicYear,
          kind: { not: "REGISTRATION" },
          voidedAt: null,
        },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);
    return NextResponse.json(
      {
        success: true,
        config,
        categories,
        academicYear: calendar.academicYear,
        charges,
        total,
        page,
        students,
        services,
        serviceBalances,
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
      try {
        revalidatePath("/list/incomes");
        revalidatePath("/admin/finance");
      } catch (error) {
        console.warn(
          "[StudentCharges] Income cache revalidation skipped:",
          error,
        );
      }
      return NextResponse.json({ success: true, ...result });
    }
    if (body.action === "categoryCreate" || body.action === "categoryUpdate") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 2 || name.length > 60)
        throw new Error(
          "Le nom de la catégorie doit contenir entre 2 et 60 caractères.",
        );
      const price = validateMoney(body.price, true);
      if (body.frequency !== "MONTHLY" && body.frequency !== "YEARLY")
        throw new Error("Choisissez une fréquence de facturation.");
      if (typeof body.active !== "boolean")
        throw new Error("État de catégorie invalide.");
      const config = await prisma.institution.findUniqueOrThrow({
        where: { schoolId },
      });
      const academicYear = chargeCalendar(config).academicYear;
      const duplicate = await prisma.studentChargeCategory.findFirst({
        where: {
          schoolId,
          name: { equals: name, mode: "insensitive" },
          ...(body.action === "categoryUpdate"
            ? { kind: { not: body.kind } }
            : {}),
        },
      });
      if (duplicate) throw new Error("Une catégorie porte déjà ce nom.");
      if (body.action === "categoryCreate") {
        const kind = `CUSTOM_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
        await prisma.$transaction(async (tx) => {
          await tx.studentChargeCategory.create({
            data: {
              schoolId,
              kind,
              name,
              price,
              frequency: body.frequency,
              active: body.active,
            },
          });
          await tx.auditLog.create({
            data: {
              schoolId,
              action: "CREATE",
              performedBy: adminId,
              entityType: "StudentChargeCategory",
              entityId: kind,
              description: `Created ${name}: ${price} TND, ${body.frequency}.`,
            },
          });
        });
      } else {
        if (typeof body.kind !== "string" || !isCustomChargeKind(body.kind))
          throw new Error("Catégorie invalide.");
        const current = await prisma.studentChargeCategory.findUnique({
          where: { schoolId_kind: { schoolId, kind: body.kind } },
        });
        if (!current)
          throw new Error("Catégorie introuvable dans cette école.");
        if (
          name !== current.name &&
          (await prisma.studentCharge.count({
            where: { schoolId, kind: body.kind },
          }))
        )
          throw new Error(
            "Le nom d’une catégorie déjà facturée ne peut pas changer, afin de préserver les reçus existants.",
          );
        const hasCharges =
          (await prisma.studentCharge.count({
            where: { schoolId, kind: body.kind, academicYear, voidedAt: null },
          })) > 0;
        const effectiveFrequency =
          current.nextFrequency &&
          current.frequencyYear &&
          academicYear > current.frequencyYear
            ? current.nextFrequency
            : current.frequency;
        await prisma.$transaction(async (tx) => {
          await tx.studentChargeCategory.update({
            where: { schoolId_kind: { schoolId, kind: body.kind } },
            data: {
              name,
              price,
              active: body.active,
              frequency: hasCharges ? effectiveFrequency : body.frequency,
              nextFrequency:
                hasCharges && body.frequency !== effectiveFrequency
                  ? body.frequency
                  : null,
              frequencyYear: academicYear,
            },
          });
          if (current.price !== price)
            await tx.studentServiceAssignment.updateMany({
              where: { schoolId, kind: body.kind, monthlyFee: current.price },
              data: { monthlyFee: price },
            });
          await tx.auditLog.create({
            data: {
              schoolId,
              action: "UPDATE",
              performedBy: adminId,
              entityType: "StudentChargeCategory",
              entityId: body.kind,
              description: `Updated ${name}: ${price} TND, ${body.frequency}. Existing charges unchanged.`,
            },
          });
        });
      }
      await syncStudentCharges(schoolId);
      invalidateTenantTags(schoolId, "finance", "students");
      return NextResponse.json({ success: true });
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
          transportMonthlyFee: true,
          gardeMonthlyFee: true,
          transportFrequency: true,
          gardeFrequency: true,
          transportNextFrequency: true,
          gardeNextFrequency: true,
          transportFrequencyYear: true,
          gardeFrequencyYear: true,
        },
      });
      const currentAcademicYear = chargeCalendar(school).academicYear;
      const nullableFee = (value: unknown) =>
        value === null ? null : validateMoney(value, true);
      const frequencySettings: Record<string, string | null> = {};
      for (const [kind, prefix] of [
        ["TRANSPORT", "transport"],
        ["GARDE", "garde"],
      ] as const) {
        const requested = body[`${prefix}Frequency`];
        if (!["MONTHLY", "YEARLY"].includes(requested))
          throw new Error("Fréquence de facturation invalide.");
        const effective = serviceFrequency(school, kind, currentAcademicYear);
        const hasCharges =
          (await prisma.studentCharge.count({
            where: {
              schoolId,
              kind,
              academicYear: currentAcademicYear,
              voidedAt: null,
            },
          })) > 0;
        frequencySettings[`${prefix}Frequency`] = hasCharges
          ? effective
          : requested;
        frequencySettings[`${prefix}NextFrequency`] =
          hasCharges && requested !== effective ? requested : null;
        frequencySettings[`${prefix}FrequencyYear`] = currentAcademicYear;
      }
      const config = {
        registrationFeeEnabled: body.registrationFeeEnabled,
        registrationFee,
        registrationReconciliationYear: body.hideCurrentRegistrationFromParents
          ? currentAcademicYear
          : null,
        transportMonthlyFee: nullableFee(body.transportMonthlyFee),
        gardeMonthlyFee: nullableFee(body.gardeMonthlyFee),
        ...frequencySettings,
      };
      await prisma.$transaction(async (tx) => {
        await tx.institution.update({ where: { schoolId }, data: config });
        for (const [kind, oldPrice, nextPrice] of [
          ["TRANSPORT", school.transportMonthlyFee, config.transportMonthlyFee],
          ["GARDE", school.gardeMonthlyFee, config.gardeMonthlyFee],
        ] as const) {
          if (oldPrice !== null && nextPrice !== null && oldPrice !== nextPrice)
            await tx.studentServiceAssignment.updateMany({
              where: { schoolId, kind, monthlyFee: oldPrice },
              data: { monthlyFee: nextPrice },
            });
        }
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
    if (body.action === "assignBulk") {
      if (
        !(
          body.kind === "TRANSPORT" ||
          body.kind === "GARDE" ||
          (typeof body.kind === "string" && isCustomChargeKind(body.kind))
        ) ||
        !Array.isArray(body.studentIds) ||
        body.studentIds.length < 1 ||
        body.studentIds.length > 1000 ||
        new Set(body.studentIds).size !== body.studentIds.length ||
        body.studentIds.some((id: unknown) => typeof id !== "string")
      )
        throw new Error("Sélectionnez des élèves de cette école.");
      const config = await prisma.institution.findUniqueOrThrow({
        where: { schoolId },
      });
      const category = isCustomChargeKind(body.kind)
        ? await prisma.studentChargeCategory.findUnique({
            where: { schoolId_kind: { schoolId, kind: body.kind } },
          })
        : null;
      if (isCustomChargeKind(body.kind) && !category?.active)
        throw new Error("Cette catégorie n’est pas active dans cette école.");
      const price = category
        ? category.active
          ? category.price
          : null
        : body.kind === "TRANSPORT"
          ? config.transportMonthlyFee
          : config.gardeMonthlyFee;
      if (price === null)
        throw new Error("Définissez d’abord le tarif du service.");
      const calendar = chargeCalendar(config);
      if (
        typeof body.startPeriod !== "string" ||
        !/^\d{4}-(0[1-6]|09|1[0-2])$/.test(body.startPeriod) ||
        body.startPeriod < calendar.academicYear.slice(0, 4) + "-09" ||
        body.startPeriod > calendar.academicYear.slice(5) + "-06"
      )
        throw new Error("Choisissez un mois de cette année scolaire.");
      const owned = await prisma.student.count({
        where: { schoolId, id: { in: body.studentIds } },
      });
      if (owned !== body.studentIds.length)
        throw new Error("Un élève ne fait pas partie de cette école.");
      const alreadyAssigned = await prisma.studentServiceAssignment.count({
        where: {
          schoolId,
          kind: body.kind,
          studentId: { in: body.studentIds },
          active: true,
        },
      });
      if (alreadyAssigned)
        throw new Error(
          "Des élèves sélectionnés utilisent déjà ce service. Modifiez-les individuellement.",
        );
      await prisma.$transaction(async (tx) => {
        await tx.studentServiceAssignment.updateMany({
          where: {
            schoolId,
            kind: body.kind,
            studentId: { in: body.studentIds },
          },
          data: {
            active: true,
            startPeriod: body.startPeriod,
            monthlyFee: price,
            discountType: null,
            discountValue: 0,
          },
        });
        await tx.studentServiceAssignment.createMany({
          data: body.studentIds.map((studentId: string) => ({
            schoolId,
            studentId,
            kind: body.kind,
            monthlyFee: price,
            startPeriod: body.startPeriod,
          })),
          skipDuplicates: true,
        });
        await tx.auditLog.create({
          data: {
            schoolId,
            action: "UPDATE",
            performedBy: adminId,
            entityType: "StudentServiceAssignment",
            description: `${body.kind}: bulk assigned to ${body.studentIds.length} students from ${body.startPeriod}. Existing charges retained.`,
          },
        });
      });
      const sync = await syncStudentCharges(schoolId);
      invalidateTenantTags(schoolId, "students", "finance");
      return NextResponse.json({
        success: true,
        assigned: body.studentIds.length,
        ...sync,
      });
    }
    if (body.action === "assign") {
      if (
        !(
          body.kind === "TRANSPORT" ||
          body.kind === "GARDE" ||
          (typeof body.kind === "string" && isCustomChargeKind(body.kind))
        ) ||
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
        if (isCustomChargeKind(body.kind)) {
          const category = await prisma.studentChargeCategory.findUnique({
            where: { schoolId_kind: { schoolId, kind: body.kind } },
          });
          if (!category?.active)
            throw new Error(
              "Cette catégorie n’est pas active dans cette école.",
            );
        }
        const discountType =
          body.discountType === null || body.discountType === undefined
            ? null
            : body.discountType;
        if (
          discountType !== null &&
          !["FIXED", "PERCENT"].includes(discountType)
        )
          throw new Error("Type de réduction invalide.");
        const discountValue =
          discountType === null ? 0 : validateMoney(body.discountValue, true);
        if (
          (discountType === "PERCENT" && discountValue > 100) ||
          (discountType === "FIXED" && discountValue > monthlyFee)
        )
          throw new Error("Réduction supérieure au tarif.");
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
          update: {
            monthlyFee,
            startPeriod: body.startPeriod,
            active: true,
            discountType,
            discountValue,
          },
          create: {
            schoolId,
            studentId: body.studentId,
            kind: body.kind,
            monthlyFee,
            discountType,
            discountValue,
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
