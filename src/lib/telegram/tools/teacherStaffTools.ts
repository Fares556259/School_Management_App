import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { buildNameSearchConditions } from "./nameSearch";
import { resolveTeacherByName, resolveStaffByName } from "./entityResolvers";

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
        bloodType: "O+",
        birthday: new Date(1990, 0, 1),
        hourlyRate: args.hourlyRate ?? null,
        hoursPerMonth: args.hoursPerMonth ?? null,
        salary: monthlySalary ?? 3000,
        schoolId: context.schoolId,
        subjects: subjectIds.length > 0 ? { connect: subjectIds.map((id) => ({ id })) } : undefined,
      },
      include: { subjects: true },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Teacher",
        entityId: newTeacher.id,
        description: `[Hnia AI Telegram] Ajout enseignant : ${name} ${surname} (${phone})`,
        schoolId: context.schoolId,
      },
    });

    return newTeacher;
  });

  invalidateTenantTags(context.schoolId, "teachers", "dashboard");

  return {
    success: true,
    message: `✅ L'enseignant(e) **${name} ${surname}** a été ajouté(e) avec succès.\n• Téléphone : ${phone}\n• Matières : ${
      (teacher as any).subjects?.map((s: any) => s.name).join(", ") || "Aucune"
    }\n• Salaire mensuel prévu : ${monthlySalary ? monthlySalary + " DT" : "Non fixé"}`,
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

  // Deduction calculation
  const hourlyRate = teacher.hourlyRate || 25;
  const deductionAmount = args.missedHours ? args.missedHours * hourlyRate : 0;

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

    let paymentRecord;
    const newTotalPaid = (existingPayment?.amount || 0) + args.amount;
    const newMissedHours = args.missedHours !== undefined ? args.missedHours : (existingPayment?.missedHours || 0);

    if (existingPayment) {
      paymentRecord = await tx.payment.update({
        where: { id: existingPayment.id },
        data: {
          amount: newTotalPaid,
          status: isAdvance ? "PARTIAL" : "PAID",
          missedHours: newMissedHours,
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
          status: isAdvance ? "PARTIAL" : "PAID",
          userType: "TEACHER",
          missedHours: newMissedHours,
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

    return paymentRecord;
  });

  invalidateTenantTags(context.schoolId, "teachers", "finance", "expenses", "dashboard");

  return {
    success: true,
    message: `✅ ${isAdvance ? "L'avance" : "Le salaire"} de **${args.amount} DT** pour **${teacherFullName}** (${monthName} ${year}) a été enregistré avec succès dans le journal des dépenses.${
      deductionAmount > 0 ? ` Déduction appliquée pour heures manquées : ${deductionAmount} DT.` : ""
    }`,
    summary: `Paiement salaire ${teacherFullName} (${args.amount} DT)`,
    data: { paymentId: result.id },
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

    return paymentRecord;
  });

  invalidateTenantTags(context.schoolId, "staff", "finance", "expenses", "dashboard");

  return {
    success: true,
    message: `✅ ${isAdvance ? "L'avance" : "Le salaire"} de **${args.amount} DT** pour **${staffFullName}** (${monthName} ${year}) a été enregistré avec succès.`,
    summary: `Paiement staff ${staffFullName} (${args.amount} DT)`,
    data: { paymentId: result.id },
  };
}
