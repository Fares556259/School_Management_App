import prisma from "@/lib/prisma";
import { attachOvertimeLines } from "@/lib/teacherOvertimeBreakdown";
import type { Prisma } from "@prisma/client";
import type { ToolContext } from "@/lib/telegram/tools/readTools";
import {
  collectStudentBilling,
  getStudentBilling,
  studentBillingVersion,
} from "@/lib/studentBilling";
import { studentTuitionForMonth } from "@/lib/tuitionPolicy";
import { computeTeacherPaymentStatus } from "@/lib/payrollUtils";
import { saveTeacherOvertime } from "@/lib/teacherOvertime";
import { appendOvertime } from "@/lib/overtimeAmount";
import { validateMoney } from "@/lib/studentCharges";
import {
  schoolDate,
  schoolDayRange,
  schoolMonth,
  roundMoney,
} from "./dataAccuracy";
import { actionReviewFingerprint } from "./actionReview";
import { invalidateTenantTags } from "@/lib/cache";

export interface PaymentChoice {
  key: string;
  kind: string;
  label: string;
  period: string;
  due: number;
  chargeId?: string;
}
export interface PaymentReview {
  type: "student" | "teacher" | "overtime";
  beneficiary: string;
  choices?: PaymentChoice[];
  baseSalary?: number;
  deduction?: number;
  overtimeHours?: number;
  overtimeLines?: import("@/lib/overtimeBreakdown").OvertimeLine[];
  hourlyAmount?: number;
  fixedAmount?: number;
  amountPaid?: number;
  remaining?: number;
}
export interface PaymentDisplay {
  beneficiary: string;
  payment: PaymentReview;
}
export const PAYMENT_ACTIONS = new Set([
  "record_payment",
  "pay_teacher_salary",
  "set_teacher_overtime",
]);

/** Names must identify one person in this school. Ambiguous matches never select the first row. */
async function exactPerson(
  role: "student" | "teacher",
  query: unknown,
  schoolId: string,
  className?: string,
) {
  if (typeof query !== "string" || !query.trim())
    throw new Error("Précisez le nom complet ou l’identifiant.");
  const text = query.trim(),
    words = text.split(/\s+/);
  const OR: any[] = [
    { id: text },
    { username: { equals: text, mode: "insensitive" } },
  ];
  for (let i = 1; i < words.length; i++) {
    const name = words.slice(0, i).join(" "),
      surname = words.slice(i).join(" ");
    OR.push(
      {
        name: { equals: name, mode: "insensitive" },
        surname: { equals: surname, mode: "insensitive" },
      },
      {
        name: { equals: surname, mode: "insensitive" },
        surname: { equals: name, mode: "insensitive" },
      },
    );
  }
  const rows =
    role === "student"
      ? await prisma.student.findMany({
          where: {
            schoolId,
            OR,
            ...(className
              ? {
                  class: {
                    schoolId,
                    name: { equals: className, mode: "insensitive" },
                  },
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            surname: true,
            class: { select: { name: true } },
          },
          take: 2,
        })
      : await prisma.teacher.findMany({
          where: { schoolId, OR },
          select: { id: true, name: true, surname: true },
          take: 2,
        });
  if (rows.length !== 1)
    throw new Error(
      "Personne introuvable ou nom ambigu. Précisez le nom complet, la classe ou l’identifiant exact dans cette école.",
    );
  return rows[0];
}
const periodLabel = (month: number, year: number) =>
  `${year}-${String(month).padStart(2, "0")}`;
const kindLabel = (kind: string) =>
  (
    ({
      TUITION: "Scolarité",
      REGISTRATION: "Inscription",
      TRANSPORT: "Transport",
      GARDE: "Garde",
    }) as Record<string, string>
  )[kind] || "Service";
export function studentPaymentChoices(
  billing: Awaited<ReturnType<typeof getStudentBilling>>,
): PaymentChoice[] {
  const startYear = Number(billing.academicYear.split("-")[0]);
  const choices: PaymentChoice[] = [];
  for (const month of [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]) {
    const year = month >= 9 ? startYear : startYear + 1,
      period = periodLabel(month, year);
    const paid = billing.payments.find(
      (p) => p.month === month && p.year === year,
    );
    const due = roundMoney(
      Math.max(
        0,
        studentTuitionForMonth(
          billing.student,
          month,
          year,
          billing.halfBoundaryMonths,
        ) -
          (paid && ["PAID", "PARTIAL"].includes(paid.status) ? paid.amount : 0),
      ),
    );
    if (due > 0)
      choices.push({
        key: `TUITION:${period}`,
        kind: "TUITION",
        label: "Scolarité",
        period,
        due,
      });
  }
  for (const charge of billing.charges) {
    if (charge.academicYear !== billing.academicYear) continue;
    const due = roundMoney(charge.amount - charge.paidAmount);
    if (due > 0)
      choices.push({
        key: `${charge.kind}:${charge.period}`,
        kind: charge.kind,
        label: charge.categoryName || kindLabel(charge.kind),
        period: charge.period,
        due,
        chargeId: charge.id,
      });
  }
  if (billing.bus)
    for (const month of [9, 10, 11, 12, 1, 2, 3, 4, 5, 6]) {
      const period = periodLabel(month, month >= 9 ? startYear : startYear + 1);
      if (
        period < billing.bus.startPeriod ||
        billing.charges.some(
          (c) => c.kind === "TRANSPORT" && c.period === period,
        )
      )
        continue;
      if (billing.bus.monthlyAmount > 0)
        choices.push({
          key: `TRANSPORT:${period}`,
          kind: "TRANSPORT",
          label: "Transport",
          period,
          due: billing.bus.monthlyAmount,
        });
    }
  return choices;
}
export async function teacherPaymentState(
  schoolId: string,
  teacherId: string,
  month: number,
  year: number,
  db: Prisma.TransactionClient = prisma,
) {
  const teacher = await db.teacher.findFirst({
    where: { id: teacherId, schoolId },
  });
  if (!teacher) throw new Error("Enseignant introuvable dans cette école.");
  const payment = await db.payment.findUnique({
    where: { teacherId_month_year: { teacherId, month, year } },
  });
  if (payment && payment.schoolId !== schoolId)
    throw new Error("Paiement non autorisé dans cette école.");
  const calc = computeTeacherPaymentStatus(
    { ...teacher, payments: payment ? [payment] : [] },
    month,
    year,
  );
  const version = actionReviewFingerprint(teacherId, "payroll", {
    salary: teacher.salary,
    hourlyRate: teacher.hourlyRate,
    hoursPerMonth: teacher.hoursPerMonth,
    payment,
  });
  const [detailed] = await attachOvertimeLines(schoolId, payment ? [payment] : [], db, calc.overtimeRate);
  return { teacher, payment: detailed ?? payment, calc, version };
}
export async function preparePaymentAction(
  name: string,
  source: Record<string, any>,
  context: ToolContext,
): Promise<{ args: Record<string, any>; display: PaymentDisplay } | null> {
  if (!PAYMENT_ACTIONS.has(name)) return null;
  const args = { ...source };
  if (name === "record_payment") {
    const person = await exactPerson(
      "student",
      args.studentNameOrId,
      context.schoolId,
      args.className,
    );
    const billing = await getStudentBilling(context.schoolId, person.id);
    const choices = studentPaymentChoices(billing);
    const changed =
      args._paymentVersion &&
      args._paymentVersion !== studentBillingVersion(billing);
    let items = changed ? [] : args.items;
    if (changed) delete args.amount;
    if (!items && args.amount !== undefined) {
      let remaining = validateMoney(args.amount);
      const start = schoolMonth(args.month, args.year),
        from = periodLabel(start.month, start.year);
      items = [];
      for (const choice of choices.filter(
        (c) => c.kind === "TUITION" && c.period >= from,
      )) {
        if (remaining <= 0) break;
        const amount = Math.min(remaining, choice.due);
        items.push({ kind: choice.kind, period: choice.period, amount });
        remaining = roundMoney(remaining - amount);
      }
      if (remaining > 0)
        throw new Error(
          "Le montant dépasse la scolarité restante. Choisissez les services et les mois dans la carte.",
        );
    }
    if (!Array.isArray(items ?? []))
      throw new Error("Sélection de paiement invalide.");
    items = (items ?? []).map((item: any) => {
      const choice = choices.find(
        (c) => c.kind === item.kind && c.period === item.period,
      );
      const amount = validateMoney(item.amount);
      if (!choice || amount > choice.due)
        throw new Error(
          "Un mois est soldé, non attribué ou son solde a changé. Modifiez la sélection.",
        );
      return { kind: choice.kind, period: choice.period, amount };
    });
    if (
      new Set(items.map((i: any) => `${i.kind}:${i.period}`)).size !==
        items.length ||
      items.length > 50
    )
      throw new Error("Sélection répétée ou trop longue.");
    const paidOn = args.paidOn || schoolDate();
    schoolDayRange(paidOn);
    if (paidOn > schoolDate())
      throw new Error("La date d’encaissement ne peut pas être dans le futur.");
    if (
      !["Espèces", "Chèque", "Virement", "Carte"].includes(
        args.paymentMethod || "Espèces",
      )
    )
      throw new Error("Mode de règlement invalide.");
    const total = roundMoney(
      items.reduce((sum: number, i: any) => sum + i.amount, 0),
    );
    delete args.amount;
    const beneficiary =
      `${person.name} ${person.surname}`.trim() +
      ("class" in person && (person as any).class?.name
        ? ` · ${(person as any).class.name}`
        : "");
    return {
      args: {
        ...args,
        studentNameOrId: person.id,
        items,
        ...(total > 0 ? { amount: total } : {}),
        paymentMethod: args.paymentMethod || "Espèces",
        paidOn: args.paidOn || schoolDate(),
        _paymentVersion: studentBillingVersion(billing),
      },
      display: {
        beneficiary,
        payment: { type: "student", beneficiary, choices },
      },
    };
  }
  const person = await exactPerson(
    "teacher",
    args.teacherNameOrId,
    context.schoolId,
  );
  const { month, year } = schoolMonth(args.month, args.year);
  const { teacher, payment, calc, version } = await teacherPaymentState(
    context.schoolId,
    person.id,
    month,
    year,
  );
  if (payment?.status === "PAID")
    throw new Error("Ce mois est clôturé et payé. Choisissez un autre mois.");
  if (args.missedHours !== undefined && args.missedHours !== calc.missedHours)
    throw new Error(
      "Modifiez les absences séparément avant de préparer le paiement.",
    );
  const beneficiary = `${teacher.name} ${teacher.surname}`.trim();
  const paymentReview: PaymentReview = {
    type: name === "set_teacher_overtime" ? "overtime" : "teacher",
    beneficiary,
    baseSalary: calc.baseSalary,
    deduction: calc.deduction,
    overtimeHours: calc.overtimeHours,
    overtimeLines: payment?.overtimeLines || [],
    hourlyAmount: roundMoney(calc.overtimeAmount - calc.overtimeFixedAmount),
    fixedAmount: calc.overtimeFixedAmount,
    amountPaid: calc.amountPaid,
    remaining: calc.remaining,
  };
  if (name === "set_teacher_overtime") {
    const entry =
      args.mode === "fixed"
        ? { mode: "fixed" as const, amount: args.amount }
        : {
            mode: "hourly" as const,
            hours: args.hours,
            rate: args.rate ?? teacher.hourlyRate ?? 0,
          };
    appendOvertime(payment, entry, teacher.hourlyRate || 0); // same precision/cap checks as the dashboard, no write
    return {
      args: {
        teacherNameOrId: person.id,
        month,
        year,
        ...entry,
        _paymentVersion: version,
      },
      display: { beneficiary, payment: paymentReview },
    };
  }
  const amount = validateMoney(args.amount ?? calc.remaining);
  if (amount > calc.remaining)
    throw new Error(
      "Le montant dépasse le salaire restant. Vérifiez les ajustements.",
    );
  return {
    args: {
      ...args,
      teacherNameOrId: person.id,
      month,
      year,
      amount,
      isAdvance: Boolean(args.isAdvance),
      _paymentVersion: version,
    },
    display: { beneficiary, payment: paymentReview },
  };
}
export async function recordStudentPayment(
  args: Record<string, any>,
  context: ToolContext,
) {
  if (!args._paymentVersion || !context.actionId)
    throw new Error(
      "Actualisez et vérifiez la carte de paiement avant de confirmer.",
    );
  const billing = await getStudentBilling(
      context.schoolId,
      args.studentNameOrId,
    ),
    choices = studentPaymentChoices(billing);
  const tuition: any[] = [],
    charges: any[] = [],
    advanceBus: any[] = [];
  for (const item of args.items || []) {
    const choice = choices.find(
      (c) => c.kind === item.kind && c.period === item.period,
    );
    if (!choice) throw new Error("Sélection périmée. Actualisez les soldes.");
    if (choice.kind === "TUITION")
      tuition.push({ monthYear: item.period, amount: item.amount });
    else if (choice.chargeId)
      charges.push({ id: choice.chargeId, amount: item.amount });
    else if (choice.kind === "TRANSPORT")
      advanceBus.push({ period: item.period, amount: item.amount });
    else throw new Error("Service non attribué.");
  }
  const result = await collectStudentBilling(
    {
      studentId: args.studentNameOrId,
      tuition,
      charges,
      advanceBus,
      paymentMethod: args.paymentMethod,
      paidOn: args.paidOn,
      idempotencyKey: `hnia-${context.actionId}`,
      expectedVersion: args._paymentVersion,
    },
    context,
  );
  return {
    ...result,
    message: `Paiement enregistré : ${result.total} TND. Reçu disponible dans les paiements de l’élève.`,
    summary: `Paiement ${result.total} TND`,
    data: result,
  };
}
export async function executeTeacherPayment(
  args: Record<string, any>,
  context: ToolContext,
) {
  const { month, year } = schoolMonth(args.month, args.year);
  if (!args._paymentVersion)
    throw new Error(
      "Actualisez et vérifiez la carte de paie avant de confirmer.",
    );
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Teacher" WHERE id=${args.teacherNameOrId} AND "schoolId"=${context.schoolId} FOR UPDATE`;
    const { teacher, payment, calc, version } = await teacherPaymentState(
      context.schoolId,
      args.teacherNameOrId,
      month,
      year,
      tx,
    );
    if (version !== args._paymentVersion || payment?.status === "PAID")
      throw new Error(
        "La paie a changé. Préparez une nouvelle carte avant de payer.",
      );
    const amount = validateMoney(args.amount);
    if (amount > calc.remaining)
      throw new Error("Montant supérieur au salaire restant.");
    const total = roundMoney(calc.amountPaid + amount),
      remaining = roundMoney(calc.remaining - amount);
    const record = await tx.payment.upsert({
      where: { teacherId_month_year: { teacherId: teacher.id, month, year } },
      update: {
        amount: total,
        status: remaining <= 0 ? "PAID" : "PARTIAL",
        paidAt: new Date(),
        deferredAmount: remaining,
      },
      create: {
        teacherId: teacher.id,
        schoolId: context.schoolId,
        userType: "TEACHER",
        month,
        year,
        amount: total,
        status: remaining <= 0 ? "PAID" : "PARTIAL",
        paidAt: new Date(),
        deferredAmount: remaining,
      },
    });
    await tx.expense.create({
      data: {
        schoolId: context.schoolId,
        title: `${args.isAdvance ? "Avance" : "Salaire"} : ${teacher.name} ${teacher.surname} (${periodLabel(month, year)})`,
        amount,
        category: args.isAdvance ? "Advance" : "Salary",
        date: new Date(),
        referenceType: "TeacherSalary",
        referenceId: String(record.id),
      },
    });
    await tx.auditLog.create({
      data: {
        schoolId: context.schoolId,
        performedBy: context.adminId,
        action: args.isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
        entityType: "Payment",
        entityId: String(record.id),
        amount,
        description: `Hnia : versement confirmé ${amount} TND (${periodLabel(month, year)}).`,
      },
    });
    return {
      paymentId: record.id,
      amount,
      remainingAfter: remaining,
      teacherId: teacher.id,
    };
  });
  invalidateTenantTags(
    context.schoolId,
    "teachers",
    "finance",
    "expenses",
    "dashboard",
  );
  return {
    success: true,
    message: `Versement enregistré : ${result.amount} TND. Reste à payer : ${result.remainingAfter} TND.`,
    summary: "Versement enseignant enregistré",
    data: result,
  };
}
export async function executeTeacherOvertime(
  args: Record<string, any>,
  context: ToolContext,
) {
  const { month, year } = schoolMonth(args.month, args.year);
  const { payment, calc, version } = await teacherPaymentState(
    context.schoolId,
    args.teacherNameOrId,
    month,
    year,
  );
  if (!args._paymentVersion || version !== args._paymentVersion)
    throw new Error("La paie a changé. Vérifiez une nouvelle proposition.");
  const entry =
    args.mode === "fixed"
      ? { mode: "fixed" as const, amount: args.amount }
      : { mode: "hourly" as const, hours: args.hours, rate: args.rate };
  const result = await saveTeacherOvertime({
    schoolId: context.schoolId,
    adminId: context.adminId,
    teacherId: args.teacherNameOrId,
    month,
    year,
    hours: 0,
    entry,
    expectedOvertime: {
      hours: payment?.overtimeHours || 0,
      rate: payment?.overtimeRate ?? null,
      fixedAmount: payment?.overtimeFixedAmount || 0,
    },
    expectedSalary: {
      baseSalary: calc.baseSalary,
      deduction: calc.deduction,
      amountPaid: calc.amountPaid,
    },
  });
  invalidateTenantTags(context.schoolId, "teachers", "finance", "dashboard");
  return {
    success: true,
    message:
      "Ajout au salaire enregistré. Aucun salaire versé. Préparez le versement séparément.",
    summary: "Ajout au salaire enregistré",
    data: result,
  };
}
