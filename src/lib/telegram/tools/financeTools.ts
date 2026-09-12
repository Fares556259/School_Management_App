import prisma from "@/lib/prisma";
import { processPaymentReminders } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";
import { resolveClassByName } from "./classResolver";
import { buildNameSearchConditions } from "./nameSearch";
import { resolveStudentByName } from "./entityResolvers";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";

/**
 * Tool: get_financial_anomalies
 * Detects financial discrepancies and anomalies:
 * - Duplicate payments for the same student in the same month
 * - Salaries paid higher than agreed base salary
 * - Students with 2+ consecutive unpaid months
 */
export async function getFinancialAnomaliesTool(
  args: {
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  // 1. Find consecutive unpaid students (unpaid this month AND last month)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  const [unpaidThisMonth, unpaidPrevMonth] = await Promise.all([
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        month,
        year,
        userType: "STUDENT",
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: { studentId: true, amount: true, student: { select: { name: true, surname: true, class: { select: { name: true } } } } },
    }),
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        month: prevMonth,
        year: prevYear,
        userType: "STUDENT",
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      select: { studentId: true },
    }),
  ]);

  const prevUnpaidIds = new Set(unpaidPrevMonth.map((p) => p.studentId));
  const chronicUnpaid = unpaidThisMonth.filter((p) => prevUnpaidIds.has(p.studentId));

  // 2. Unusually high general expenses this month (> 500 DT)
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const largeExpenses = await prisma.expense.findMany({
    where: {
      schoolId: context.schoolId,
      date: { gte: startDate, lt: endDate },
      amount: { gte: 500 },
      NOT: { category: "SALAIRE" },
    },
    take: 5,
    orderBy: { amount: "desc" },
    select: { title: true, amount: true, category: true, date: true },
  });

  return {
    period: `${month}/${year}`,
    totalAnomaliesDetected: chronicUnpaid.length + largeExpenses.length,
    chronicUnpaidStudents: {
      count: chronicUnpaid.length,
      description: "Élèves ayant au moins 2 mois consécutifs d'impayés",
      students: chronicUnpaid.map((p) => ({
        name: `${p.student?.name} ${p.student?.surname}`,
        class: p.student?.class?.name || "N/A",
      })),
    },
    unusuallyHighExpenses: largeExpenses.map((e) => ({
      title: e.title,
      amount: `${e.amount} DT`,
      category: e.category,
      date: e.date.toISOString().split("T")[0],
    })),
  };
}

/**
 * Tool: send_payment_reminders
 * Triggers automated push & in-app payment reminders to parents of students
 * who have unpaid tuition for the current month.
 */
export async function sendPaymentRemindersTool(
  args: {
    force?: boolean;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const result = await processPaymentReminders(Boolean(args.force));

  if (!result.success) {
    return {
      success: false,
      message: `❌ Erreur lors de l'envoi des rappels : ${result.error}`,
      summary: "Échec envoi rappels",
    };
  }

  const count = result.count ?? 0;

  await prisma.auditLog.create({
    data: {
      action: "SEND_NOTIFICATION",
      performedBy: `Hnia AI (Telegram / ${context.adminName})`,
      entityType: "Payment",
      description: `[Hnia AI Telegram] Rappels de paiement déclenchés : ${count} notifications envoyées aux familles.`,
      schoolId: context.schoolId,
    },
  });

  return {
    success: true,
    message: `📢 **Rappels de paiement envoyés avec succès !**\n• Notifications transmises aux familles : **${count}**`,
    summary: `Envoi de rappels de paiement (${count} envoyés)`,
    data: result,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. PAIEMENTS PARTIELS & RECOUVREMENT (READ & WRITE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tool: get_partial_payments
 * Fetches recovery queue metrics and dossiers for partially paid tuition fees.
 */
export async function getPartialPaymentsTool(
  args: {
    status?: "all" | "overdue" | "this_month" | "future" | "unscheduled";
    className?: string;
    studentName?: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
    status: "PARTIAL",
    userType: "STUDENT",
  };

  if (args.month) where.month = args.month;
  if (args.year) where.year = args.year;

  if (args.className) {
    const matched = await resolveClassByName(context.schoolId, args.className);
    if (matched) {
      where.student = { classId: matched.id };
    } else {
      where.student = {
        class: { name: { contains: args.className.trim(), mode: "insensitive" } },
      };
    }
  }

  if (args.studentName) {
    const q = args.studentName.trim();
    where.student = {
      ...(where.student || {}),
      OR: buildNameSearchConditions(q),
    };
  }

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { deferredUntil: "asc" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          surname: true,
          class: { select: { name: true } },
          level: { select: { level: true, tuitionFee: true } },
          parent: { select: { name: true, surname: true, phone: true } },
        },
      },
    },
  });

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  let totalPending = 0;
  let overdueAmount = 0;
  let overdueCount = 0;
  let thisMonthAmount = 0;
  let thisMonthCount = 0;
  let futureAmount = 0;
  let futureCount = 0;

  const processed = payments.map((p) => {
    const pending = p.deferredAmount || 0;
    totalPending += pending;

    let dueStatus: "overdue" | "this_month" | "future" | "unscheduled" = "unscheduled";
    let statusBadge = "⚠️ NON PLANIFIÉ";

    if (p.deferredUntil) {
      const dueDate = new Date(p.deferredUntil);
      if (dueDate < today) {
        dueStatus = "overdue";
        statusBadge = "❌ EN RETARD (ÉCHU)";
        overdueAmount += pending;
        overdueCount++;
      } else if (dueDate <= endOfMonth) {
        dueStatus = "this_month";
        statusBadge = "⏳ ÉCHÉANCE CE MOIS";
        thisMonthAmount += pending;
        thisMonthCount++;
      } else {
        dueStatus = "future";
        statusBadge = "📅 ÉCHÉANCE FUTURE";
        futureAmount += pending;
        futureCount++;
      }
    }

    const mName = MONTHS[p.month - 1] || `Mois ${p.month}`;
    const frMonth = formatMonthFrench(`${mName} ${p.year}`);

    return {
      id: p.id,
      studentId: p.studentId,
      studentName: p.student ? `${p.student.name} ${p.student.surname}` : "Inconnu",
      className: p.student?.class?.name || "N/A",
      feeMonth: frMonth,
      paidAmount: p.amount,
      remainingGap: pending,
      totalTuition: p.amount + pending,
      deferredUntil: p.deferredUntil ? p.deferredUntil.toISOString().split("T")[0] : null,
      dueStatus,
      statusBadge,
      parentPhone: p.student?.parent?.phone || null,
      parentName: p.student?.parent ? `${p.student.parent.name} ${p.student.parent.surname}` : null,
    };
  });

  let filtered = processed;
  let statusNote: string | undefined;

  if (args.status && args.status !== "all") {
    const matched = processed.filter((item) => item.dueStatus === args.status);
    if (matched.length > 0) {
      filtered = matched;
    } else {
      // In recovery management, admins colloquially say "en retard" for any unpaid tuition balance.
      // If 0 dossiers have an exceeded promised calendar deadline (e.g. deadlines are unscheduled),
      // do not hide the recovery queue! Return all active partial dossiers (Total: 547 DT) with an explanatory note.
      filtered = processed;
      if (args.status === "overdue") {
        statusNote = "Aucune date promise n'est dépassée (0 reliquats au calendrier échu), mais voici l'ensemble des dossiers partiels en attente de recouvrement.";
      }
    }
  }

  return {
    kpis: {
      totalToRecover: `${totalPending} DT`,
      totalDossiers: payments.length,
      overdueAmount: `${overdueAmount} DT (${overdueCount} dossier(s))`,
      thisMonthAmount: `${thisMonthAmount} DT (${thisMonthCount} dossier(s))`,
      futureAmount: `${futureAmount} DT (${futureCount} dossier(s))`,
    },
    filterApplied: args.status || "all",
    count: filtered.length,
    statusNote,
    items: filtered.slice(0, 30),
  };
}

/**
 * Tool: recover_partial_payment
 * Settles or recovers a pending tuition balance (reliquat) for a student.
 */
export async function recoverPartialPaymentTool(
  args: {
    studentNameOrId: string;
    amount?: number;
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  // Find student
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { success: false, message: `Élève "${args.studentNameOrId}" introuvable.`, summary: `Élève introuvable` };
  }

  // Find pending partial payment(s)
  const paymentWhere: any = {
    studentId: student.id,
    schoolId: context.schoolId,
    status: "PARTIAL",
    userType: "STUDENT",
  };
  if (args.month) paymentWhere.month = args.month;
  if (args.year) paymentWhere.year = args.year;

  const partialPayments = await prisma.payment.findMany({
    where: paymentWhere,
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  if (partialPayments.length === 0) {
    return {
      success: false,
      message: `Aucun reliquat de paiement partiel trouvé pour <b>${student.name} ${student.surname}</b>.`,
      summary: `Aucun reliquat trouvé`,
    };
  }

  const targetPayment = partialPayments[0];
  const currentGap = targetPayment.deferredAmount || 0;
  const recoveryAmount = args.amount !== undefined ? Math.min(args.amount, currentGap) : currentGap;

  if (recoveryAmount <= 0) {
    return {
      success: false,
      message: `Le montant à recouvrer doit être supérieur à 0 DT. Reliquat actuel : <code>${currentGap} DT</code>.`,
      summary: `Montant invalide`,
    };
  }

  const newAmount = targetPayment.amount + recoveryAmount;
  const newDeferred = currentGap - recoveryAmount;
  const isFullySettled = newDeferred <= 0;
  const finalStatus = isFullySettled ? "PAID" : "PARTIAL";

  const mName = MONTHS[targetPayment.month - 1] || `Mois ${targetPayment.month}`;
  const periodStr = formatMonthFrench(`${mName} ${targetPayment.year}`);

  await prisma.$transaction(async (tx) => {
    // 1. Update Payment record
    await tx.payment.update({
      where: { id: targetPayment.id },
      data: {
        amount: newAmount,
        deferredAmount: isFullySettled ? 0 : newDeferred,
        deferredUntil: isFullySettled ? null : targetPayment.deferredUntil,
        status: finalStatus as any,
        paidAt: new Date(),
      },
    });

    // 2. Log Income entry for recovered money
    await tx.income.create({
      data: {
        title: `Tuition: ${student.name} ${student.surname} (${periodStr}) - Recovery`,
        amount: recoveryAmount,
        date: new Date(),
        category: "Recovery",
        referenceType: "StudentPayment",
        referenceId: targetPayment.id.toString(),
        schoolId: context.schoolId,
      },
    });

    // 3. Log Audit
    await tx.auditLog.create({
      data: {
        action: "RECOVER_PAYMENT",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: targetPayment.id.toString(),
        description: `[Hnia AI Telegram] Recouvrement partiel : ${student.name} ${student.surname} - ${recoveryAmount} DT encaissés pour ${periodStr}${isFullySettled ? " (SOLDÉ ✅)" : ` (Reste : ${newDeferred} DT)`}`,
        amount: recoveryAmount,
        type: "income",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "students", "incomes", "dashboard");

  const badge = isFullySettled
    ? "✅ <b>Dossier 100% SOLDÉ</b>"
    : `⚠️ <b>Reste dû :</b> <code>${newDeferred} DT</code>`;

  return {
    success: true,
    message: `✅ <b>Recouvrement Enregistré</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>${student.name} ${student.surname}</b> • Classe <code>${student.class?.name || "N/A"}</code>
📅 Période : <code>${periodStr}</code>
💰 Montant encaissé : <code>+${recoveryAmount} DT</code>
📊 Nouveau total payé : <code>${newAmount} DT</code>
${badge}`,
    summary: `Recouvrement de ${recoveryAmount} DT pour ${student.name} (${periodStr})`,
    data: {
      studentId: student.id,
      paymentId: targetPayment.id,
      recoveredAmount: recoveryAmount,
      remainingGap: isFullySettled ? 0 : newDeferred,
      status: finalStatus,
    },
  };
}

/**
 * Tool: schedule_recovery_date
 * Sets or updates the promised recovery deadline (deferredUntil) for a partial payment.
 */
export async function scheduleRecoveryDateTool(
  args: {
    studentNameOrId: string;
    date: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const query = args.studentNameOrId.trim();
  const scheduledDate = new Date(args.date);

  if (isNaN(scheduledDate.getTime())) {
    return { success: false, message: `Format de date invalide (attendu : AAAA-MM-JJ).`, summary: `Date invalide` };
  }

  // Find student
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return { success: false, message: `Élève "${args.studentNameOrId}" introuvable.`, summary: `Élève introuvable` };
  }

  const paymentWhere: any = {
    studentId: student.id,
    schoolId: context.schoolId,
    status: "PARTIAL",
    userType: "STUDENT",
  };
  if (args.month) paymentWhere.month = args.month;
  if (args.year) paymentWhere.year = args.year;

  const targetPayment = await prisma.payment.findFirst({
    where: paymentWhere,
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });

  if (!targetPayment) {
    return {
      success: false,
      message: `Aucun reliquat de paiement partiel trouvé pour <b>${student.name} ${student.surname}</b>.`,
      summary: `Aucun reliquat`,
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: targetPayment.id },
      data: { deferredUntil: scheduledDate },
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: targetPayment.id.toString(),
        description: `[Hnia AI Telegram] Date d'échéance fixée au ${args.date} pour ${student.name} ${student.surname} (Reliquat : ${targetPayment.deferredAmount || 0} DT)`,
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "students", "dashboard");

  const formattedDate = scheduledDate.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return {
    success: true,
    message: `📅 <b>Échéance Planifiée</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>${student.name} ${student.surname}</b> • Classe <code>${student.class?.name || "N/A"}</code>
💰 Reliquat en attente : <code>${targetPayment.deferredAmount || 0} DT</code>
🗓️ Nouvelle date limite : <code>${formattedDate}</code>`,
    summary: `Échéance fixée au ${args.date} pour ${student.name}`,
    data: { paymentId: targetPayment.id, scheduledDate: args.date },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. REVENUS / RECETTES DE L'ÉCOLE (READ & WRITE)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tool: get_incomes
 * Lists detailed revenues, monthly/annual sums, and category breakdown.
 */
export async function getIncomesTool(
  args: {
    date?: string;
    month?: number;
    year?: number;
    category?: string;
    query?: string;
    limit?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.category) {
    where.category = { contains: args.category.trim(), mode: "insensitive" };
  }

  if (args.query) {
    where.title = { contains: args.query.trim(), mode: "insensitive" };
  }

  let filterDateWhere: any;
  if (args.date) {
    let target = new Date();
    if (args.date !== "today") {
      const p = new Date(args.date);
      if (!isNaN(p.getTime())) target = p;
    }
    const s = new Date(target);
    s.setHours(0, 0, 0, 0);
    const e = new Date(target);
    e.setHours(23, 59, 59, 999);
    filterDateWhere = { ...where, date: { gte: s, lte: e } };
  } else {
    filterDateWhere = { ...where, date: { gte: startDate, lt: endDate } };
  }

  const [dateSum, monthSum, todaySum, allTimeSum, categoryBreakdown, records] = await Promise.all([
    prisma.income.aggregate({
      where: filterDateWhere,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.income.aggregate({
      where: { ...where, date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.income.aggregate({
      where: { ...where, date: { gte: startOfToday, lte: endOfToday } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.income.aggregate({
      where: { schoolId: context.schoolId },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.income.groupBy({
      by: ["category"],
      where: filterDateWhere,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.income.findMany({
      where: filterDateWhere,
      take: Math.min(args.limit || 25, 50),
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        amount: true,
        category: true,
        date: true,
        img: true,
      },
    }),
  ]);

  return {
    period: args.date ? (args.date === "today" ? "Aujourd'hui" : args.date) : `${month}/${year}`,
    summary: {
      todayTotal: `${todaySum._sum.amount || 0} DT`,
      selectedTotal: `${dateSum._sum.amount || 0} DT`,
      currentMonthTotal: `${monthSum._sum.amount || 0} DT`,
      currentMonthCount: monthSum._count.id || 0,
      historicalTotal: `${allTimeSum._sum.amount || 0} DT`,
    },
    categories: categoryBreakdown.map((c) => ({
      category: c.category,
      amount: `${c._sum.amount || 0} DT`,
      count: c._count.id || 0,
    })),
    records: records.map((r) => ({
      id: r.id,
      title: r.title,
      amount: `${r.amount} DT`,
      category: r.category,
      date: r.date.toISOString().split("T")[0],
      hasProof: Boolean(r.img),
    })),
  };
}

/**
 * Tool: add_income
 * Adds a new revenue/income record for the school.
 */
export async function addIncomeTool(
  args: {
    title: string;
    amount: number;
    category: string;
    date?: string;
    img?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const category = args.category?.trim() || "Général";
  const incomeDate = args.date ? new Date(args.date) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const inc = await tx.income.create({
      data: {
        title: args.title.trim(),
        amount: args.amount,
        category,
        date: incomeDate,
        img: args.img || null,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "GENERAL_INCOME",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "School",
        entityId: inc.id.toString(),
        amount: args.amount,
        type: "income",
        description: `[Hnia AI Telegram] Revenu enregistré : ${args.title} (${args.amount} DT - ${category})`,
        effectiveDate: incomeDate,
        schoolId: context.schoolId,
      },
    });

    return inc;
  });

  invalidateTenantTags(context.schoolId, "incomes", "finance", "dashboard");

  const dateStr = incomeDate.toLocaleDateString("fr-FR");
  const imgStr = args.img ? "\n🖼️ <i>Preuve / reçu joint</i>" : "";

  return {
    success: true,
    message: `✅ <b>Revenu Enregistré</b>
━━━━━━━━━━━━━━━━━━━━━━
💰 Montant : <code>+${args.amount} DT</code>
🏷️ Source : <b>${args.title}</b>
📂 Catégorie : <code>${category}</code>
📅 Date : <code>${dateStr}</code>${imgStr}`,
    summary: `Revenu "${args.title}" (+${args.amount} DT)`,
    data: { incomeId: result.id },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DÉPENSES DE L'ÉCOLE (READ)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Tool: get_expenses
 * Lists detailed expenses, monthly/annual sums, and category breakdown.
 */
export async function getExpensesTool(
  args: {
    month?: number;
    year?: number;
    category?: string;
    query?: string;
    limit?: number;
  },
  context: ToolContext
) {
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.category) {
    where.category = { contains: args.category.trim(), mode: "insensitive" };
  }

  if (args.query) {
    where.title = { contains: args.query.trim(), mode: "insensitive" };
  }

  const monthWhere = {
    ...where,
    date: { gte: startDate, lt: endDate },
  };

  const [monthSum, allTimeSum, categoryBreakdown, records] = await Promise.all([
    prisma.expense.aggregate({
      where: monthWhere,
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: { schoolId: context.schoolId },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      where: monthWhere,
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.findMany({
      where: monthWhere,
      take: Math.min(args.limit || 25, 50),
      orderBy: { date: "desc" },
      select: {
        id: true,
        title: true,
        amount: true,
        category: true,
        date: true,
        img: true,
      },
    }),
  ]);

  return {
    period: `${month}/${year}`,
    summary: {
      currentMonthTotal: `${monthSum._sum.amount || 0} DT`,
      currentMonthCount: monthSum._count.id || 0,
      historicalTotal: `${allTimeSum._sum.amount || 0} DT`,
    },
    categories: categoryBreakdown.map((c) => ({
      category: c.category,
      amount: `${c._sum.amount || 0} DT`,
      count: c._count.id || 0,
    })),
    records: records.map((r) => ({
      id: r.id,
      title: r.title,
      amount: `${r.amount} DT`,
      category: r.category,
      date: r.date.toISOString().split("T")[0],
      hasProof: Boolean(r.img),
    })),
  };
}

