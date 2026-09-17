import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { buildNameSearchConditions } from "./nameSearch";
import { resolveTeacherByName, resolveStaffByName, resolveSubjectByName, resolveClassByName } from "./entityResolvers";

/**
 * Tool: get_staff
 * Lists non-teaching personnel (admins, maintenance, drivers, accountants).
 */
export async function getStaffTool(
  args: {
    query?: string;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.query) {
    const q = args.query.trim();
    where.OR = [
      ...buildNameSearchConditions(q),
      { role: { contains: q, mode: "insensitive" } },
    ];
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const staffList = await prisma.staff.findMany({
    where,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      surname: true,
      phone: true,
      salary: true,
      role: true,
      payments: {
        where: { schoolId: context.schoolId, month: currentMonth, year: currentYear, userType: "STAFF" },
        select: { amount: true, status: true, paidAt: true },
      },
    },
  });

  return {
    total: staffList.length,
    staff: staffList.map((s) => {
      const currentP = s.payments[0];
      const statusLabel = currentP?.status === "PAID"
        ? "Payé ce mois ✅"
        : currentP?.status === "PARTIAL"
        ? `Avance perçue : ${currentP.amount} DT ⚠️`
        : "Non payé ce mois ⏳";

      return {
        fullName: `${s.name} ${s.surname}`,
        role: s.role || "Général",
        phone: s.phone || "Non renseigné",
        salary: s.salary ? `${s.salary} DT` : "Non fixé",
        currentMonthStatus: statusLabel,
      };
    }),
  };
}

/**
 * Tool: create_teacher
 * Adds a new instructor, links subjects taught and salary configuration.
 */
export async function createTeacherTool(
  args: {
    name: string;
    surname: string;
    phone: string;
    subjectNames?: string[];
    classNames?: string[];
    hourlyRate?: number;
    hoursPerMonth?: number;
    sex?: "MALE" | "FEMALE";
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const name = args.name.trim();
  const surname = args.surname.trim();
  const phone = args.phone.replace(/\s+/g, "");

  const username = `prof.${name.toLowerCase().replace(/[^a-z]/g, "")}.${Date.now().toString().slice(-4)}`;

  // Resolve subjects
  const subjectIds: number[] = [];
  const resolvedSubjectNames: string[] = [];
  if (args.subjectNames && args.subjectNames.length > 0) {
    for (const subName of args.subjectNames) {
      const subject = await prisma.subject.findFirst({
        where: {
          schoolId: context.schoolId,
          name: { contains: subName.trim(), mode: "insensitive" },
        },
      });
      if (subject) {
        subjectIds.push(subject.id);
        resolvedSubjectNames.push(subject.name);
      }
    }
  }

  // Resolve classes
  const classIds: number[] = [];
  const resolvedClassNames: string[] = [];
  if (args.classNames && args.classNames.length > 0) {
    for (const clsName of args.classNames) {
      const cls = await resolveClassByName(context.schoolId, clsName);
      if (cls) {
        classIds.push(cls.id);
        resolvedClassNames.push(cls.name);
      }
    }
  }

  const monthlySalary =
    args.hourlyRate && args.hoursPerMonth ? args.hourlyRate * args.hoursPerMonth : null;

  const teacher = await prisma.$transaction(async (tx) => {
    const newTeacher = await tx.teacher.create({
      data: {
        id: `t_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        username,
        name,
        surname,
        phone,
        sex: args.sex || "MALE",
        address: "Tunis",
        bloodType: "Inconnu",
        birthday: new Date(1990, 0, 1),
        hourlyRate: args.hourlyRate ?? null,
        hoursPerMonth: args.hoursPerMonth ?? null,
        salary: monthlySalary ?? 3000,
        schoolId: context.schoolId,
        subjects: subjectIds.length > 0 ? { connect: subjectIds.map((id) => ({ id })) } : undefined,
        classes: classIds.length > 0 ? { connect: classIds.map((id) => ({ id })) } : undefined,
      },
      include: { subjects: true, classes: true },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Teacher",
        entityId: newTeacher.id,
        description: `[Hnia AI Telegram] Ajout enseignant : ${name} ${surname} (${phone}) - Matières: ${resolvedSubjectNames.join(", ") || "Aucune"} - Classes: ${resolvedClassNames.join(", ") || "Aucune"}`,
        schoolId: context.schoolId,
      },
    });

    return newTeacher;
  });

  invalidateTenantTags(context.schoolId, "teachers", "classes", "dashboard");

  return {
    success: true,
    message: `✅ L'enseignant(e) **${name} ${surname}** a été ajouté(e) avec succès.
• 📞 **Téléphone :** <code>${phone}</code>
• 📚 **Matières :** <b>${(teacher as any).subjects?.map((s: any) => s.name).join(", ") || "Aucune"}</b>
• 🏫 **Classes :** <b>${(teacher as any).classes?.map((c: any) => c.name).join(", ") || "Aucune"}</b>
• 💰 **Salaire prévu :** <code>${monthlySalary ? monthlySalary + " DT/mois" : "Non fixé"}</code>`,
    summary: `Ajout de l'enseignant ${name} ${surname}`,
    data: { teacherId: teacher.id },
  };
}

/**
 * Tool: create_staff
 * Adds non-teaching personnel.
 */
export async function createStaffTool(
  args: {
    name: string;
    surname: string;
    phone: string;
    salary?: number;
    sex?: "MALE" | "FEMALE";
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const name = args.name.trim();
  const surname = args.surname.trim();
  const phone = args.phone.replace(/\s+/g, "");

  const username = `staff.${name.toLowerCase().replace(/[^a-z]/g, "")}.${Date.now().toString().slice(-4)}`;

  const staff = await prisma.$transaction(async (tx) => {
    const newStaff = await tx.staff.create({
      data: {
        id: `st_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        username,
        name,
        surname,
        phone,
        role: "General",
        address: "Tunis",
        bloodType: "O+",
        birthday: new Date(1990, 0, 1),
        salary: args.salary ?? 1500,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Staff",
        entityId: newStaff.id,
        description: `[Hnia AI Telegram] Ajout personnel : ${name} ${surname} (${phone})`,
        schoolId: context.schoolId,
      },
    });

    return newStaff;
  });

  invalidateTenantTags(context.schoolId, "staff", "dashboard");

  return {
    success: true,
    message: `✅ Le membre du personnel **${name} ${surname}** a été ajouté avec succès (Tél : ${phone}, Salaire : ${
      args.salary ? args.salary + " DT" : "Non fixé"
    }).`,
    summary: `Ajout staff : ${name} ${surname}`,
    data: { staffId: staff.id },
  };
}

export interface PaymentMeta {
  trackedHours: number;
  deductedHours: number;
  deductionStatus: "PENDING" | "APPLIED" | "EXCUSED";
  notes?: string;
}

export const parsePaymentMeta = (p?: { img?: string | null; missedHours?: number | null } | null): PaymentMeta => {
  if (!p) {
    return { trackedHours: 0, deductedHours: 0, deductionStatus: "PENDING" };
  }
  if (p.img) {
    try {
      const parsed = JSON.parse(p.img);
      if (typeof parsed === "object" && parsed !== null) {
        const tracked = Number(parsed.trackedHours ?? p.missedHours ?? 0);
        const status = (parsed.deductionStatus as "PENDING" | "APPLIED" | "EXCUSED") || "PENDING";
        const deducted = Number(parsed.deductedHours ?? (status === "APPLIED" ? tracked : 0));
        return {
          trackedHours: tracked,
          deductedHours: deducted,
          deductionStatus: status,
          notes: parsed.notes || "",
        };
      }
    } catch {
      // ignore json parse error
    }
  }
  const hrs = p.missedHours || 0;
  return {
    trackedHours: hrs,
    deductedHours: hrs,
    deductionStatus: hrs > 0 ? "APPLIED" : "PENDING",
  };
};

/**
 * Tool: get_salary_details
 * Retrieves complete salary, advance, deduction (missed hours) and outstanding balance
 * for a teacher or staff member with 100% web parity.
 */
export async function getSalaryDetailsTool(
  args: {
    nameOrId: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();
  const monthName = MONTHS[month - 1] || `Mois ${month}`;

  // 1. Try finding teacher first
  const teacher = await resolveTeacherByName(context.schoolId, args.nameOrId);
  if (teacher) {
    const [fullTeacher, allTeacherExpenses] = await Promise.all([
      prisma.teacher.findUnique({
        where: { id: teacher.id },
        include: {
          subjects: true,
          classes: true,
          payments: {
            where: { schoolId: context.schoolId, userType: "TEACHER" },
            orderBy: [{ year: "desc" }, { month: "desc" }],
          },
        },
      }),
      prisma.expense.findMany({
        where: {
          schoolId: context.schoolId,
          OR: [
            { referenceType: "TeacherSalary" },
            { category: "Advance" },
            { category: "Salary" },
          ],
        },
        orderBy: { date: "asc" },
      }),
    ]);

    if (!fullTeacher) {
      return { error: true, message: `Enseignant "${args.nameOrId}" introuvable.` };
    }

    const t = fullTeacher;
    const teacherFullName = `${t.name} ${t.surname}`;
    const baseSalary = t.salary || 600;
    const effectiveHourlyRate = t.hourlyRate && t.hourlyRate > 0 ? t.hourlyRate : 15;

    // Target month payment
    const targetPayment = t.payments.find((p) => p.month === month && p.year === year);
    const meta = parsePaymentMeta(targetPayment);
    const trackedHours = meta.trackedHours;
    const deductedHours = meta.deductionStatus === "APPLIED" ? (meta.deductedHours || trackedHours) : 0;
    const deductionAmount = deductedHours * effectiveHourlyRate;

    // Advances for this specific month
    const pIds = t.payments.map((p) => p.id.toString());
    const linkedExpenses = allTeacherExpenses.filter((exp) => {
      if (exp.referenceType === "TeacherSalary" && pIds.includes(exp.referenceId || "")) return true;
      if (exp.referenceType === "TeacherSalary" && exp.referenceId === t.id) return true;
      if (exp.category === "Advance" && exp.title?.toLowerCase().includes(t.name.toLowerCase())) return true;
      return false;
    });

    const targetMonthAdvanceExpenses = linkedExpenses.filter((e) => {
      if (targetPayment && String(e.referenceId) === String(targetPayment.id)) {
        return e.category === "Advance" || e.title?.toLowerCase().includes("avance") || e.title?.toLowerCase().includes("advance");
      }
      return false;
    });

    const expenseAdvanceTotal = targetMonthAdvanceExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const advancePaid = targetPayment?.status === "PARTIAL"
      ? targetPayment.amount
      : expenseAdvanceTotal > 0
      ? expenseAdvanceTotal
      : 0;

    const remainingToPay = targetPayment?.status === "PAID"
      ? 0
      : Math.max(0, baseSalary - deductionAmount - advancePaid);

    const isMonthAutoSettled = advancePaid > 0 && remainingToPay <= 0;
    const isFullyPaid = targetPayment?.status === "PAID" || isMonthAutoSettled;

    const academicStartYear = month >= 9 ? year : year - 1;
    const ACADEMIC_MONTHS = [
      { m: 9, y: academicStartYear, label: "Sep" },
      { m: 10, y: academicStartYear, label: "Oct" },
      { m: 11, y: academicStartYear, label: "Nov" },
      { m: 12, y: academicStartYear, label: "Déc" },
      { m: 1, y: academicStartYear + 1, label: "Jan" },
      { m: 2, y: academicStartYear + 1, label: "Fév" },
      { m: 3, y: academicStartYear + 1, label: "Mar" },
      { m: 4, y: academicStartYear + 1, label: "Avr" },
      { m: 5, y: academicStartYear + 1, label: "Mai" },
      { m: 6, y: academicStartYear + 1, label: "Juin" },
    ];

    const academicYearKeys = new Set(ACADEMIC_MONTHS.map((am) => `${am.m}-${am.y}`));

    // Total paid across months in the current academic year
    const academicPayments = t.payments.filter((p) => academicYearKeys.has(`${p.month}-${p.year}`));
    const totalPaidYear = academicPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidMonthsCount = academicPayments.filter((p) => {
      if (p.status === "PAID") return true;
      const pMeta = parsePaymentMeta(p);
      const pDedH = pMeta.deductionStatus === "APPLIED" ? (pMeta.deductedHours || pMeta.trackedHours) : 0;
      const pDed = pDedH * effectiveHourlyRate;
      const pNet = Math.max(0, baseSalary - pDed);
      return (p.amount || 0) > 0 && (p.amount || 0) >= pNet;
    }).length;

    let statusLabel = "⏳ Non encore payé";
    let statusBadge = "⏳ <code>NON PAYÉ</code>";
    if (isFullyPaid) {
      statusLabel = "Soldé / Entièrement réglé";
      statusBadge = "🟢 <code>SOLDÉ</code>";
    } else if (targetPayment?.status === "PARTIAL" || advancePaid > 0) {
      statusLabel = `Avance en cours (${advancePaid} DT perçus)`;
      statusBadge = "🟡 <code>AVANCE EN COURS</code>";
    }

    const subjectsList = t.subjects.map((s) => s.name.split("|")[0].trim()).join(", ") || "Aucune";

    const academicMonthsSchedule = ACADEMIC_MONTHS.map((am) => {
      const p = t.payments.find((pay) => pay.month === am.m && pay.year === am.y);
      const pMeta = parsePaymentMeta(p);
      const pDedH = pMeta.deductionStatus === "APPLIED" ? (pMeta.deductedHours || pMeta.trackedHours) : 0;
      const pDed = pDedH * effectiveHourlyRate;
      const pNet = Math.max(0, baseSalary - pDed);
      const isSettled = p?.status === "PAID" || (p && p.amount > 0 && p.amount >= pNet);

      let badge = "⏳ À venir";
      if (isSettled) badge = `🟢 Payé (${p?.amount} DT)`;
      else if (p?.status === "PARTIAL") badge = `🟡 Avance (${p.amount} DT)`;
      else if (am.y < year || (am.y === year && am.m < month)) badge = "🔴 En retard";
      return `${am.label}: ${badge}`;
    }).join(" • ");

    return {
      success: true,
      userType: "TEACHER",
      id: t.id,
      fullName: teacherFullName,
      phone: t.phone || "Non renseigné",
      subjects: subjectsList,
      targetMonth: `${monthName} ${year}`,
      month,
      year,
      baseSalary: `${baseSalary} DT`,
      hourlyRate: `${effectiveHourlyRate} DT/h`,
      hoursPerMonth: t.hoursPerMonth ? `${t.hoursPerMonth}h/mois` : "Non fixé",
      missedHours: `${trackedHours}h`,
      deductionStatus: meta.deductionStatus,
      deductionAmount: `${deductionAmount} DT`,
      advancePaid: `${advancePaid} DT`,
      remainingToPay: `${remainingToPay} DT`,
      status: statusLabel,
      statusBadge,
      isFullyPaid,
      totalPaidAcademicYear: `${totalPaidYear} DT (${paidMonthsCount} mois réglés)`,
      academicMonthsSchedule,
      summary: `${teacherFullName} (${monthName} ${year}) : Salaire de base ${baseSalary} DT, Déduction d'absence ${deductionAmount} DT (${trackedHours}h à ${effectiveHourlyRate} DT/h), Avances perçues ${advancePaid} DT, Reste net à payer : ${remainingToPay} DT`,
    };
  }

  // 2. Try finding Staff member
  const staff = await resolveStaffByName(context.schoolId, args.nameOrId);
  if (staff) {
    const fullStaff = await prisma.staff.findUnique({
      where: { id: staff.id },
      include: {
        payments: {
          where: { schoolId: context.schoolId, userType: "STAFF" },
          orderBy: [{ year: "desc" }, { month: "desc" }],
        },
      },
    });

    if (!fullStaff) {
      return { error: true, message: `Membre du personnel "${args.nameOrId}" introuvable.` };
    }

    const s = fullStaff;
    const staffFullName = `${s.name} ${s.surname}`;
    const baseSalary = s.salary || 1500;
    const targetPayment = s.payments.find((p) => p.month === month && p.year === year);
    const advancePaid = targetPayment?.status === "PARTIAL" ? targetPayment.amount : 0;
    const remainingToPay = targetPayment?.status === "PAID" ? 0 : Math.max(0, baseSalary - advancePaid);
    const totalPaidYear = s.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const paidMonthsCount = s.payments.filter((p) => p.status === "PAID").length;

    let statusBadge = "⏳ <code>NON PAYÉ</code>";
    if (targetPayment?.status === "PAID") {
      statusBadge = "🟢 <code>SOLDÉ</code>";
    } else if (targetPayment?.status === "PARTIAL" || advancePaid > 0) {
      statusBadge = "🟡 <code>AVANCE EN COURS</code>";
    }

    const staffAcademicStartYear = month >= 9 ? year : year - 1;
    const STAFF_ACADEMIC_MONTHS = [
      { m: 9, y: staffAcademicStartYear, label: "Sep" },
      { m: 10, y: staffAcademicStartYear, label: "Oct" },
      { m: 11, y: staffAcademicStartYear, label: "Nov" },
      { m: 12, y: staffAcademicStartYear, label: "Déc" },
      { m: 1, y: staffAcademicStartYear + 1, label: "Jan" },
      { m: 2, y: staffAcademicStartYear + 1, label: "Fév" },
      { m: 3, y: staffAcademicStartYear + 1, label: "Mar" },
      { m: 4, y: staffAcademicStartYear + 1, label: "Avr" },
      { m: 5, y: staffAcademicStartYear + 1, label: "Mai" },
      { m: 6, y: staffAcademicStartYear + 1, label: "Juin" },
    ];

    const staffMonthsSchedule = STAFF_ACADEMIC_MONTHS.map((am) => {
      const p = s.payments.find((pay) => pay.month === am.m && pay.year === am.y);
      let badge = "⏳ À venir";
      if (p?.status === "PAID") badge = `🟢 Payé (${p.amount} DT)`;
      else if (p?.status === "PARTIAL") badge = `🟡 Avance (${p.amount} DT)`;
      else if (am.y < year || (am.y === year && am.m < month)) badge = "🔴 En retard";
      return `${am.label}: ${badge}`;
    }).join(" • ");

    return {
      success: true,
      userType: "STAFF",
      id: s.id,
      fullName: staffFullName,
      role: s.role || "Général",
      phone: s.phone || "Non renseigné",
      targetMonth: `${monthName} ${year}`,
      month,
      year,
      baseSalary: `${baseSalary} DT`,
      advancePaid: `${advancePaid} DT`,
      remainingToPay: `${remainingToPay} DT`,
      statusBadge,
      isFullyPaid: targetPayment?.status === "PAID",
      totalPaidAcademicYear: `${totalPaidYear} DT (${paidMonthsCount} mois réglés)`,
      academicMonthsSchedule: staffMonthsSchedule,
      summary: `${staffFullName} (${monthName} ${year}) : Salaire de base ${baseSalary} DT, Avance ${advancePaid} DT, Reste net à payer : ${remainingToPay} DT`,
    };
  }

  return {
    error: true,
    message: `Aucun enseignant ou membre du personnel trouvé pour "${args.nameOrId}".`,
  };
}

/**
 * Tool: track_teacher_absent_hours
 * Records missed/absent hours for an instructor, computes deduction and updates net balance.
 */
export async function trackTeacherAbsentHoursTool(
  args: {
    teacherNameOrId: string;
    missedHours: number;
    month?: number;
    year?: number;
    deductionStatus?: "APPLIED" | "PENDING" | "EXCUSED";
    notes?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();
  const monthName = MONTHS[month - 1] || `Mois ${month}`;
  const deductionStatus = args.deductionStatus || "APPLIED";

  const teacher = await resolveTeacherByName(context.schoolId, args.teacherNameOrId);
  if (!teacher) {
    return { success: false, message: `Enseignant "${args.teacherNameOrId}" introuvable.`, summary: `Enseignant introuvable` };
  }

  const teacherFullName = `${teacher.name} ${teacher.surname}`;
  const effectiveHourlyRate = teacher.hourlyRate && teacher.hourlyRate > 0 ? teacher.hourlyRate : 15;
  const deductionAmount = deductionStatus === "APPLIED" ? args.missedHours * effectiveHourlyRate : 0;

  const meta = {
    trackedHours: args.missedHours,
    deductedHours: deductionStatus === "APPLIED" ? args.missedHours : 0,
    deductionStatus,
    notes: args.notes || `Saisi via Hnia Telegram (${args.missedHours}h manquées)`,
  };

  const baseSalary = teacher.salary || 600;

  // Check if there are advances already recorded for this month
  const existingPayment = await prisma.payment.findUnique({
    where: {
      teacherId_month_year: {
        teacherId: teacher.id,
        month,
        year,
      },
    },
  });
  const advancePaid = existingPayment ? (existingPayment.amount || 0) : 0;
  const newNetDue = Math.max(0, baseSalary - deductionAmount - advancePaid);
  const shouldAutoSettle = advancePaid > 0 && newNetDue <= 0;

  await prisma.payment.upsert({
    where: {
      teacherId_month_year: {
        teacherId: teacher.id,
        month,
        year,
      },
    },
    update: {
      missedHours: args.missedHours,
      img: JSON.stringify(meta),
      ...(shouldAutoSettle ? { status: "PAID" } : {}),
    },
    create: {
      teacherId: teacher.id,
      amount: 0,
      month,
      year,
      status: shouldAutoSettle ? "PAID" : "PENDING",
      userType: "TEACHER",
      missedHours: args.missedHours,
      img: JSON.stringify(meta),
      schoolId: context.schoolId,
    },
  });

  invalidateTenantTags(context.schoolId, "teachers", "finance", "dashboard");

  let advanceLine = "";
  if (advancePaid > 0) {
    advanceLine = `\n• Avances déjà perçues : <code>${advancePaid} DT</code>`;
  }

  return {
    success: true,
    message: `✅ **Heures d'absence enregistrées avec succès pour ${teacherFullName} (${monthName} ${year}) !**\n\n• Heures manquées : <code>${args.missedHours}h</code>\n• Taux horaire de retenue : <code>${effectiveHourlyRate} DT/h</code>\n• Retenue calculée : <code>-${deductionAmount} DT</code>\n• Salaire de base : <code>${baseSalary} DT</code>${advanceLine}\n• <b>Nouveau solde net restant dû :</b> <code>${newNetDue} DT</code>.`,
    summary: `Absence ${teacherFullName} : ${args.missedHours}h (-${deductionAmount} DT) · Reste net : ${newNetDue} DT`,
    data: { teacherId: teacher.id, missedHours: args.missedHours, deductionAmount, advancePaid, newNetDue },
  };
}

/**
 * Tool: pay_teacher_salary
 * Records teacher payroll payment or salary advance, calculates deductions for missed hours,
 * updates Payment and Expense ledger, writes AuditLog.
 */
export async function payTeacherSalaryTool(
  args: {
    teacherNameOrId: string;
    amount: number;
    month?: number;
    year?: number;
    isAdvance?: boolean;
    missedHours?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  // Find teacher
  const teacher = await resolveTeacherByName(context.schoolId, args.teacherNameOrId);
  if (!teacher) {
    return { success: false, message: `Enseignant "${args.teacherNameOrId}" introuvable.`, summary: `Enseignant introuvable` };
  }

  const teacherFullName = `${teacher.name} ${teacher.surname}`;
  const monthName = MONTHS[month - 1] || `Mois ${month}`;
  const isAdvance = Boolean(args.isAdvance);

  // Deduction calculation matching web TeacherFinanceHub
  const effectiveHourlyRate = teacher.hourlyRate && teacher.hourlyRate > 0 ? teacher.hourlyRate : 15;
  const baseSalary = teacher.salary || 600;

  const result = await prisma.$transaction(async (tx) => {
    // 1. Check or update Payment record
    const existingPayment = await tx.payment.findFirst({
      where: {
        teacherId: teacher.id,
        month,
        year,
        userType: "TEACHER",
      },
    });

    if (existingPayment?.status === "PAID") {
      throw new Error(`Le mois de ${monthName} ${year} est déjà entièrement payé et clôturé pour ${teacherFullName}.`);
    }

    const existingMeta = parsePaymentMeta(existingPayment);
    const newMissedHours = args.missedHours !== undefined ? args.missedHours : (existingPayment?.missedHours || 0);
    const deductionAmount = newMissedHours * effectiveHourlyRate;

    const newMeta = {
      trackedHours: newMissedHours,
      deductedHours: newMissedHours,
      deductionStatus: (newMissedHours > 0 ? "APPLIED" : existingMeta.deductionStatus) as "APPLIED" | "PENDING" | "EXCUSED",
      notes: isAdvance ? `Avance de ${args.amount} DT` : `Règlement salaire ${args.amount} DT`,
    };

    let paymentRecord;
    const newTotalPaid = (existingPayment?.amount || 0) + args.amount;
    const netDue = Math.max(0, baseSalary - deductionAmount);
    const isFullyCovered = !isAdvance || (newTotalPaid >= netDue && newTotalPaid > 0);
    const paymentStatus = isFullyCovered ? "PAID" : "PARTIAL";

    if (existingPayment) {
      paymentRecord = await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: newTotalPaid,
          status: paymentStatus,
          missedHours: newMissedHours,
          img: JSON.stringify(newMeta),
          paidAt: new Date(),
        },
      });
    } else {
      paymentRecord = await tx.payment.create({
        data: {
          teacherId: teacher.id,
          month,
          year,
          amount: newTotalPaid,
          status: paymentStatus,
          userType: "TEACHER",
          missedHours: newMissedHours,
          img: JSON.stringify(newMeta),
          paidAt: new Date(),
          schoolId: context.schoolId,
        },
      });
    }

    // 2. Add Expense ledger entry matching app categories ("Advance" | "Salary")
    let expenseTitle = isAdvance
      ? `Avance sur salaire : ${teacherFullName} (${monthName} ${year})`
      : `Salaire : ${teacherFullName} (${monthName} ${year})`;

    if (deductionAmount > 0) {
      expenseTitle += ` (${newMissedHours}h absence, -${deductionAmount} DT)`;
    }

    await tx.expense.create({
      data: {
        title: expenseTitle,
        amount: args.amount,
        category: isAdvance ? "Advance" : "Salary",
        date: new Date(),
        referenceType: "TeacherSalary",
        referenceId: paymentRecord.id.toString(),
        schoolId: context.schoolId,
      },
    });

    // 3. Write AuditLog
    await tx.auditLog.create({
      data: {
        action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: paymentRecord.id.toString(),
        amount: args.amount,
        description: `[Hnia AI Telegram] Paiement ${isAdvance ? "avance" : "salaire"} enseignant : ${teacherFullName} (${args.amount} DT - ${monthName} ${year})${
          deductionAmount > 0 ? ` [${newMissedHours}h absence, -${deductionAmount} DT]` : ""
        }`,
        schoolId: context.schoolId,
      },
    });

    return { paymentRecord, newTotalPaid, deductionAmount, missedHours: newMissedHours };
  });

  invalidateTenantTags(context.schoolId, "teachers", "finance", "expenses", "dashboard");

  const remainingAfter = isAdvance
    ? Math.max(0, baseSalary - result.deductionAmount - result.newTotalPaid)
    : 0;

  const resultMsg = isAdvance
    ? `✅ **Avance sur salaire enregistrée avec succès pour ${teacherFullName} (${monthName} ${year}) !**\n\n• Montant versé maintenant : <code>${args.amount} DT</code>\n• Total avances ce mois : <code>${result.newTotalPaid} DT</code>\n• Salaire de base : <code>${baseSalary} DT</code>${
        result.deductionAmount > 0 ? `\n• Retenue d'absence : <code>-${result.deductionAmount} DT</code>` : ""
      }\n• <b>Solde restant dû :</b> <code>${remainingAfter} DT</code>.`
    : `✅ **Salaire soldé avec succès pour ${teacherFullName} (${monthName} ${year}) !**\n\n• Montant réglé : <code>${args.amount} DT</code>\n• Total perçu ce mois : <code>${result.newTotalPaid} DT</code>\n• Statut du mois : 🟢 <b>SOLDÉ / CLÔTURÉ</b>.`;

  return {
    success: true,
    message: resultMsg,
    summary: `${isAdvance ? "Avance" : "Salaire"} ${teacherFullName} (${args.amount} DT)`,
    data: {
      paymentId: result.paymentRecord.id,
      remainingAfter,
      teacherId: teacher.id,
      teacherName: teacherFullName,
      amount: args.amount,
      month,
      year,
      isAdvance,
      baseSalary,
      missedHours: result.missedHours,
      deductionAmount: result.deductionAmount,
      totalPaid: result.newTotalPaid,
    },
  };
}

/**
 * Tool: pay_staff_salary
 * Records staff salary payment or advance.
 */
export async function payStaffSalaryTool(
  args: {
    staffNameOrId: string;
    amount: number;
    month?: number;
    year?: number;
    isAdvance?: boolean;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const staff = await resolveStaffByName(context.schoolId, args.staffNameOrId);
  if (!staff) {
    return { success: false, message: `Membre du personnel "${args.staffNameOrId}" introuvable.`, summary: `Staff introuvable` };
  }

  const staffFullName = `${staff.name} ${staff.surname}`;
  const monthName = MONTHS[month - 1] || `Mois ${month}`;
  const isAdvance = Boolean(args.isAdvance);
  const baseSalary = staff.salary || 1500;

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.payment.findFirst({
      where: {
        staffId: staff.id,
        month,
        year,
        userType: "STAFF",
      },
    });

    if (existing?.status === "PAID") {
      throw new Error(`Le mois de ${monthName} ${year} est déjà entièrement payé et clôturé pour ${staffFullName}.`);
    }

    let paymentRecord;
    const newTotal = (existing?.amount || 0) + args.amount;

    if (existing) {
      paymentRecord = await tx.payment.update({
        where: { id: existing.id },
        data: {
          amount: newTotal,
          status: isAdvance ? "PARTIAL" : "PAID",
          paidAt: new Date(),
        },
      });
    } else {
      paymentRecord = await tx.payment.create({
        data: {
          staffId: staff.id,
          month,
          year,
          amount: newTotal,
          status: isAdvance ? "PARTIAL" : "PAID",
          userType: "STAFF",
          paidAt: new Date(),
          schoolId: context.schoolId,
        },
      });
    }

    const expenseTitle = isAdvance
      ? `Avance sur salaire staff : ${staffFullName} (${monthName} ${year})`
      : `Salaire staff : ${staffFullName} (${monthName} ${year})`;

    await tx.expense.create({
      data: {
        title: expenseTitle,
        amount: args.amount,
        category: isAdvance ? "Advance" : "Salary",
        date: new Date(),
        referenceType: "StaffSalary",
        referenceId: paymentRecord.id.toString(),
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: isAdvance ? "PAY_ADVANCE" : "PAY_SALARY",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: paymentRecord.id.toString(),
        amount: args.amount,
        description: `[Hnia AI Telegram] Paiement ${isAdvance ? "avance" : "salaire"} staff : ${staffFullName} (${args.amount} DT - ${monthName} ${year})`,
        schoolId: context.schoolId,
      },
    });

    return { paymentRecord, newTotal };
  });

  invalidateTenantTags(context.schoolId, "staff", "finance", "expenses", "dashboard");

  const remainingAfter = isAdvance ? Math.max(0, baseSalary - result.newTotal) : 0;

  const resultMsg = isAdvance
    ? `✅ **Avance sur salaire enregistrée avec succès pour ${staffFullName} (${monthName} ${year}) !**\n\n• Montant versé maintenant : <code>${args.amount} DT</code>\n• Total avances perçues ce mois : <code>${result.newTotal} DT</code>\n• Salaire de base : <code>${baseSalary} DT</code>\n• <b>Solde restant dû :</b> <code>${remainingAfter} DT</code>.`
    : `✅ **Salaire soldé avec succès pour ${staffFullName} (${monthName} ${year}) !**\n\n• Montant réglé : <code>${args.amount} DT</code>\n• Statut du mois : 🟢 <b>SOLDÉ / CLÔTURÉ</b>.`;

  return {
    success: true,
    message: resultMsg,
    summary: `${isAdvance ? "Avance" : "Salaire"} staff ${staffFullName} (${args.amount} DT)`,
    data: {
      paymentId: result.paymentRecord.id,
      remainingAfter,
      staffId: staff.id,
      staffName: staffFullName,
      role: staff.role || "Staff",
      amount: args.amount,
      month,
      year,
      isAdvance,
      baseSalary,
      totalPaid: result.newTotal,
    },
  };
}

/**
 * Tool: update_teacher
 * Modifies an existing teacher's profile: name, surname, phone, address, salary, hourly rate, hours per month, blood type, birthday, sex, photo, subjects taught.
 */
export async function updateTeacherTool(
  args: {
    teacherNameOrId: string;
    name?: string;
    surname?: string;
    phone?: string;
    address?: string;
    salary?: number;
    hourlyRate?: number;
    hoursPerMonth?: number;
    bloodType?: string;
    birthday?: string;
    sex?: "MALE" | "FEMALE";
    img?: string;
    subjectNames?: string[];
    classNames?: string[];
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const teacher = await resolveTeacherByName(context.schoolId, args.teacherNameOrId);
  if (!teacher) {
    return {
      success: false,
      message: `Enseignant "${args.teacherNameOrId}" introuvable.`,
      summary: "Enseignant introuvable",
    };
  }

  const updateData: any = {};
  const changeDescriptions: string[] = [];

  if (args.name && args.name.trim() !== teacher.name) {
    updateData.name = args.name.trim();
    changeDescriptions.push(`Prénom : <b>${args.name.trim()}</b>`);
  }

  if (args.surname && args.surname.trim() !== teacher.surname) {
    updateData.surname = args.surname.trim();
    changeDescriptions.push(`Nom : <b>${args.surname.trim()}</b>`);
  }

  if (args.phone) {
    const cleanPhone = args.phone.replace(/[\s\-\+]/g, "").slice(-8);
    if (cleanPhone !== teacher.phone) {
      updateData.phone = cleanPhone;
      changeDescriptions.push(`Téléphone : <code>${cleanPhone}</code>`);
    }
  }

  if (args.address && args.address.trim() !== teacher.address) {
    updateData.address = args.address.trim();
    changeDescriptions.push(`Adresse : <code>${args.address.trim()}</code>`);
  }

  if (args.bloodType && args.bloodType.trim() !== teacher.bloodType) {
    updateData.bloodType = args.bloodType.trim();
    changeDescriptions.push(`Groupe sanguin : <code>${args.bloodType.trim()}</code>`);
  }

  if (args.birthday) {
    const bDate = new Date(args.birthday);
    if (!isNaN(bDate.getTime())) {
      updateData.birthday = bDate;
      changeDescriptions.push(`Date de naissance : <code>${bDate.toISOString().slice(0, 10)}</code>`);
    }
  }

  if (args.sex && args.sex !== teacher.sex) {
    updateData.sex = args.sex;
    changeDescriptions.push(`Sexe : <code>${args.sex === "MALE" ? "Homme (M)" : "Femme (F)"}</code>`);
  }

  if (args.img !== undefined) {
    updateData.img = args.img || null;
    changeDescriptions.push(`Photo de profil mise à jour 🖼️`);
  }

  if (args.hourlyRate !== undefined) {
    const hr = Number(args.hourlyRate);
    updateData.hourlyRate = hr;
    changeDescriptions.push(`Taux horaire : <code>${hr} DT/h</code>`);
  }

  if (args.hoursPerMonth !== undefined) {
    const hm = Number(args.hoursPerMonth);
    updateData.hoursPerMonth = hm;
    changeDescriptions.push(`Volume horaire mensuel : <code>${hm}h</code>`);
  }

  // Auto-recalculate salary if hourlyRate or hoursPerMonth were updated and no explicit salary was provided
  if (args.salary !== undefined) {
    const sal = Number(args.salary);
    updateData.salary = sal;
    changeDescriptions.push(`Salaire de base : <code>${sal} DT/mois</code>`);
  } else if (args.hourlyRate !== undefined || args.hoursPerMonth !== undefined) {
    const finalRate = args.hourlyRate !== undefined ? Number(args.hourlyRate) : (teacher.hourlyRate || 0);
    const finalHours = args.hoursPerMonth !== undefined ? Number(args.hoursPerMonth) : (teacher.hoursPerMonth || 0);
    if (finalRate > 0 && finalHours > 0) {
      const calculatedSalary = finalRate * finalHours;
      updateData.salary = calculatedSalary;
      changeDescriptions.push(`Salaire calculé (${finalRate} DT × ${finalHours}h) : <code>${calculatedSalary} DT/mois</code>`);
    }
  }

  // Handle subjects taught
  if (args.subjectNames && args.subjectNames.length > 0) {
    const resolvedSubjectIds: number[] = [];
    const resolvedSubjectNames: string[] = [];
    for (const subName of args.subjectNames) {
      const subj = await resolveSubjectByName(context.schoolId, subName);
      if (subj) {
        resolvedSubjectIds.push(subj.id);
        resolvedSubjectNames.push(subj.name);
      }
    }
    if (resolvedSubjectIds.length > 0) {
      updateData.subjects = {
        set: resolvedSubjectIds.map((id) => ({ id })),
      };
      changeDescriptions.push(`Matières enseignées : <b>${resolvedSubjectNames.join(", ")}</b>`);
    }
  }

  // Handle classes taught
  if (args.classNames !== undefined) {
    const resolvedClassIds: number[] = [];
    const resolvedClassNames: string[] = [];
    for (const clsName of args.classNames) {
      const cls = await resolveClassByName(context.schoolId, clsName);
      if (cls) {
        resolvedClassIds.push(cls.id);
        resolvedClassNames.push(cls.name);
      }
    }
    updateData.classes = {
      set: resolvedClassIds.map((id) => ({ id })),
    };
    changeDescriptions.push(`Classes assignées : <b>${resolvedClassNames.length > 0 ? resolvedClassNames.join(", ") : "Aucune"}</b>`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour cet enseignant.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacher.update({
      where: { id: teacher.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Teacher",
        entityId: teacher.id,
        description: `[Hnia AI Telegram] Mise à jour enseignant ${teacher.name} ${teacher.surname} : ${changeDescriptions.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "teachers", "classes", "dashboard");

  return {
    success: true,
    message: `👨‍🏫 <b>Fiche Enseignant Mise à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Enseignant :</b> <b>${teacher.name} ${teacher.surname}</b>
• ${changeDescriptions.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les informations de l'enseignant ont été actualisées avec succès.</blockquote>`,
    summary: `Mise à jour enseignant ${teacher.name} ${teacher.surname}`,
    data: { teacherId: teacher.id, updates: updateData },
  };
}

/**
 * Tool: delete_teacher
 * Safely removes a teacher from the school with full cascading relation cleanup:
 * unlinks class supervision, timetable slots, grade sheets, removes associated lessons and salary payments.
 */
export async function deleteTeacherTool(
  args: {
    teacherNameOrId: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const teacher = await resolveTeacherByName(context.schoolId, args.teacherNameOrId);
  if (!teacher) {
    return {
      success: false,
      message: `Enseignant "${args.teacherNameOrId}" introuvable.`,
      summary: "Enseignant introuvable",
    };
  }

  const teacherFullName = `${teacher.name} ${teacher.surname}`;

  await prisma.$transaction(async (tx) => {
    // 1. Unlink supervisor role from any classes
    await tx.class.updateMany({
      where: { supervisorId: teacher.id },
      data: { supervisorId: null },
    });

    // 2. Unlink from timetable slots
    await tx.timetableSlot.updateMany({
      where: { teacherId: teacher.id },
      data: { teacherId: null },
    });

    // 3. Unlink from grade sheets
    await tx.gradeSheet.updateMany({
      where: { teacherId: teacher.id },
      data: { teacherId: null },
    });

    // 4. Handle lessons taught by this teacher
    const lessons = await tx.lesson.findMany({
      where: { teacherId: teacher.id },
      select: { id: true },
    });
    if (lessons.length > 0) {
      const lessonIds = lessons.map((l) => l.id);
      await tx.attendance.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.assignment.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.exam.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.resource.deleteMany({ where: { lessonId: { in: lessonIds } } });
      await tx.lesson.deleteMany({ where: { id: { in: lessonIds } } });
    }

    // 5. Delete salary payments
    await tx.payment.deleteMany({
      where: { teacherId: teacher.id },
    });

    // 6. Delete teacher record
    await tx.teacher.delete({
      where: { id: teacher.id },
    });

    // 7. Audit log
    await tx.auditLog.create({
      data: {
        action: "DELETE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Teacher",
        entityId: teacher.id,
        description: `[Hnia AI Telegram] Suppression définitive enseignant : ${teacherFullName} (Tél: ${teacher.phone || "N/A"}, ID: ${teacher.id})`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "teachers", "classes", "dashboard", "exams");

  return {
    success: true,
    message: `🗑️ <b>Enseignant Supprimé Définitivement</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Enseignant :</b> <b>${teacherFullName}</b>
📞 <b>Téléphone :</b> <code>${teacher.phone || "Non renseigné"}</code>
🆔 <b>Identifiant :</b> <code>${teacher.id}</code>

<blockquote>💡 <b>Hnia :</b> L'enseignant a été retiré de l'école. Les classes et créneaux horaires associés ont été libérés.</blockquote>`,
    summary: `Suppression enseignant ${teacherFullName}`,
    data: { teacherId: teacher.id, teacherFullName },
  };
}

/**
 * Tool: update_staff
 * Modifies an existing non-teaching staff member (name, surname, phone, address, salary, role, blood type, birthday, photo).
 */
export async function updateStaffTool(
  args: {
    staffNameOrId: string;
    name?: string;
    surname?: string;
    phone?: string;
    address?: string;
    salary?: number;
    role?: string;
    bloodType?: string;
    birthday?: string;
    img?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const staff = await resolveStaffByName(context.schoolId, args.staffNameOrId);
  if (!staff) {
    return {
      success: false,
      message: `Membre du personnel "${args.staffNameOrId}" introuvable.`,
      summary: "Personnel introuvable",
    };
  }

  const updateData: any = {};
  const changeDescriptions: string[] = [];

  if (args.name && args.name.trim() !== staff.name) {
    updateData.name = args.name.trim();
    changeDescriptions.push(`Prénom : <b>${args.name.trim()}</b>`);
  }

  if (args.surname && args.surname.trim() !== staff.surname) {
    updateData.surname = args.surname.trim();
    changeDescriptions.push(`Nom : <b>${args.surname.trim()}</b>`);
  }

  if (args.phone) {
    const cleanPhone = args.phone.replace(/[\s\-\+]/g, "").slice(-8);
    if (cleanPhone !== staff.phone) {
      updateData.phone = cleanPhone;
      changeDescriptions.push(`Téléphone : <code>${cleanPhone}</code>`);
    }
  }

  if (args.address && args.address.trim() !== staff.address) {
    updateData.address = args.address.trim();
    changeDescriptions.push(`Adresse : <code>${args.address.trim()}</code>`);
  }

  if (args.role && args.role.trim() !== staff.role) {
    updateData.role = args.role.trim();
    changeDescriptions.push(`Rôle / Poste : <b>${args.role.trim()}</b>`);
  }

  if (args.salary !== undefined) {
    const sal = Number(args.salary);
    if (sal !== staff.salary) {
      updateData.salary = sal;
      changeDescriptions.push(`Salaire mensuel : <code>${sal} DT</code>`);
    }
  }

  if (args.bloodType && args.bloodType.trim() !== staff.bloodType) {
    updateData.bloodType = args.bloodType.trim();
    changeDescriptions.push(`Groupe sanguin : <code>${args.bloodType.trim()}</code>`);
  }

  if (args.birthday) {
    const bDate = new Date(args.birthday);
    if (!isNaN(bDate.getTime())) {
      updateData.birthday = bDate;
      changeDescriptions.push(`Date de naissance : <code>${bDate.toISOString().slice(0, 10)}</code>`);
    }
  }

  if (args.img !== undefined) {
    updateData.img = args.img || null;
    changeDescriptions.push(`Photo de profil mise à jour 🖼️`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour ce membre du personnel.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.staff.update({
      where: { id: staff.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Staff",
        entityId: staff.id,
        description: `[Hnia AI Telegram] Mise à jour personnel ${staff.name} ${staff.surname} : ${changeDescriptions.join(", ")}`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "staff", "dashboard");

  return {
    success: true,
    message: `💼 <b>Fiche Personnel Mise à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Collaborateur :</b> <b>${staff.name} ${staff.surname}</b>
• ${changeDescriptions.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les informations du membre du personnel ont été actualisées avec succès.</blockquote>`,
    summary: `Mise à jour staff ${staff.name} ${staff.surname}`,
    data: { staffId: staff.id, updates: updateData },
  };
}

/**
 * Tool: delete_staff
 * Safely removes a staff member and cleans up associated salary records.
 */
export async function deleteStaffTool(
  args: {
    staffNameOrId: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const staff = await resolveStaffByName(context.schoolId, args.staffNameOrId);
  if (!staff) {
    return {
      success: false,
      message: `Membre du personnel "${args.staffNameOrId}" introuvable.`,
      summary: "Personnel introuvable",
    };
  }

  const staffFullName = `${staff.name} ${staff.surname}`;

  await prisma.$transaction(async (tx) => {
    // 1. Delete salary payments
    await tx.payment.deleteMany({
      where: { staffId: staff.id },
    });

    // 2. Delete staff member
    await tx.staff.delete({
      where: { id: staff.id },
    });

    // 3. Audit log
    await tx.auditLog.create({
      data: {
        action: "DELETE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Staff",
        entityId: staff.id,
        description: `[Hnia AI Telegram] Suppression définitive personnel : ${staffFullName} (Rôle: ${staff.role}, ID: ${staff.id})`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "staff", "dashboard", "finance");

  return {
    success: true,
    message: `🗑️ <b>Membre du Personnel Supprimé Définitivement</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Collaborateur :</b> <b>${staffFullName}</b>
💼 <b>Poste :</b> <code>${staff.role || "Général"}</code>
🆔 <b>Identifiant :</b> <code>${staff.id}</code>

<blockquote>💡 <b>Hnia :</b> Le collaborateur a été retiré de la base de données du personnel de l'établissement.</blockquote>`,
    summary: `Suppression staff ${staffFullName}`,
    data: { staffId: staff.id, staffFullName },
  };
}
