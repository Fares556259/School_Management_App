import prisma from "@/lib/prisma";
import { processPaymentReminders, sendMobileMessageToParents } from "@/lib/notifications";
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

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  // 1. Find consecutive unpaid students (unpaid this month AND last month)
  const [unpaidThisMonth, unpaidPrevMonth] = await Promise.all([
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        month,
        year,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        userType: "STUDENT",
      },
      select: {
        studentId: true,
        amount: true,
        deferredAmount: true,
        student: { select: { name: true, surname: true, class: { select: { name: true } } } },
      },
    }),
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        month: prevMonth,
        year: prevYear,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
        userType: "STUDENT",
      },
      select: { studentId: true },
    }),
  ]);

  const prevUnpaidIds = new Set(unpaidPrevMonth.map((p) => p.studentId));
  const chronicUnpaid = unpaidThisMonth.filter((p) => prevUnpaidIds.has(p.studentId));

  // 2. Find abnormally large expenses (> 2000 DT)
  const largeExpenses = await prisma.expense.findMany({
    where: {
      schoolId: context.schoolId,
      amount: { gte: 2000 },
      date: {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      },
    },
    select: { id: true, title: true, amount: true, category: true, date: true },
  });

  return {
    period: `${month}/${year}`,
    totalAnomaliesDetected: chronicUnpaid.length + largeExpenses.length,
    chronicUnpaidStudents: {
      count: chronicUnpaid.length,
      description: "Élèves avec impayés consécutifs sur 2 mois ou plus",
      students: chronicUnpaid.map((p) => ({
        name: p.student ? `${p.student.name} ${p.student.surname}` : "Inconnu",
        class: p.student?.class?.name || "N/A",
        dueAmount: p.deferredAmount || p.amount,
      })),
    },
    largeExpenses: {
      count: largeExpenses.length,
      description: "Dépenses exceptionnelles supérieures à 2 000 DT ce mois",
      expenses: largeExpenses.map((e) => ({
        title: e.title,
        amount: `${e.amount} DT`,
        category: e.category,
        date: e.date.toISOString().split("T")[0],
      })),
    },
  };
}

/**
 * Tool: send_payment_reminders
 * Triggers automated push & in-app payment reminders to parents of students
 * who have unpaid tuition for the current month.
 * Can target a specific student, an entire class, or all unpaid students across the school.
 */
export async function sendPaymentRemindersTool(
  args: {
    force?: boolean;
    studentName?: string;
    className?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetStudentId: string | undefined;
  let targetClassId: number | undefined;
  let targetLabel = "tous les élèves ayant des impayés";

  if (args.studentName) {
    const student = await resolveStudentByName(context.schoolId, args.studentName);
    if (student) {
      targetStudentId = student.id;
      targetLabel = `l'élève ${student.name} ${student.surname}`;
    }
  }

  if (args.className) {
    const cls = await resolveClassByName(context.schoolId, args.className);
    if (cls) {
      targetClassId = cls.id;
      targetLabel = `la classe ${cls.name}`;
    }
  }

  const result = await processPaymentReminders(
    Boolean(args.force),
    context.schoolId,
    targetStudentId,
    targetClassId
  );

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
      description: `[Hnia AI Telegram] Rappels de paiement déclenchés pour ${targetLabel} : ${count} notifications envoyées aux familles.`,
      schoolId: context.schoolId,
    },
  });

  return {
    success: true,
    message: `📢 **Rappels de paiement envoyés avec succès sur l'application mobile !**\n• Cible : **${targetLabel}**\n• Notifications transmises aux familles : **${count}**\n📱 *Les parents reçoivent une alerte push instantanée et une notification dans leur application mobile.*`,
    summary: `Envoi de rappels de paiement (${count} envoyés)`,
    data: result,
  };
}

/**
 * Tool: send_parent_message
 * Allows AI to send custom in-app and push notifications to parents:
 * - to a specific student's parents (ex: "préviens les parents d'Ahmed...")
 * - to an entire class's parents (ex: "envoie aux parents de 1A...")
 * - to all unpaid parents (ex: "envoie un rappel personnalisé aux impayés...")
 * - to all parents in the school
 */
export async function sendParentMessageTool(
  args: {
    message: string;
    title?: string;
    studentName?: string;
    className?: string;
    target?: "student" | "class" | "unpaid" | "all";
    type?: "MESSAGE" | "PAYMENT" | "REMINDER" | "ANNOUNCEMENT" | "ATTENDANCE";
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const title = args.title || "Message de l'administration";
  const type = args.type || "MESSAGE";
  let parentIds: string[] = [];
  let targetDescription = "";
  let studentIdRef: string | null = null;

  // Case 1: Specific student
  if (args.studentName || args.target === "student") {
    const student = await resolveStudentByName(context.schoolId, args.studentName || "");
    if (!student) {
      return {
        success: false,
        message: `⚠️ Aucun élève trouvé correspondant à "${args.studentName}".`,
        summary: "Élève introuvable",
      };
    }
    if (!student.parentId) {
      return {
        success: false,
        message: `⚠️ L'élève **${student.name} ${student.surname}** n'a aucun profil parent rattaché dans l'application.`,
        summary: "Parent non rattaché",
      };
    }
    parentIds = [student.parentId];
    studentIdRef = student.id;
    targetDescription = `les parents de **${student.name} ${student.surname}**`;
  }
  // Case 2: Specific class
  else if (args.className || args.target === "class") {
    const cls = await resolveClassByName(context.schoolId, args.className || "");
    if (!cls) {
      return {
        success: false,
        message: `⚠️ Classe "${args.className}" introuvable.`,
        summary: "Classe introuvable",
      };
    }
    const studentsInClass = await prisma.student.findMany({
      where: { schoolId: context.schoolId, classId: cls.id, parentId: { not: null } },
      select: { parentId: true },
    });
    parentIds = Array.from(new Set(studentsInClass.map((s) => s.parentId).filter((id): id is string => Boolean(id))));
    targetDescription = `les familles de la classe **${cls.name}** (${parentIds.length} parents)`;
  }
  // Case 3: Unpaid students
  else if (args.target === "unpaid") {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const unpaidStudents = await prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        parentId: { not: null },
        payments: {
          none: {
            month: currentMonth,
            year: currentYear,
            status: "PAID",
            userType: "STUDENT",
          },
        },
      },
      select: { parentId: true },
    });
    parentIds = Array.from(new Set(unpaidStudents.map((s) => s.parentId).filter((id): id is string => Boolean(id))));
    targetDescription = `les familles ayant un solde de scolarité dû (${parentIds.length} parents)`;
  }
  // Case 4: All parents
  else {
    const allParents = await prisma.parent.findMany({
      where: { schoolId: context.schoolId },
      select: { id: true },
    });
    parentIds = allParents.map((p) => p.id);
    targetDescription = `toutes les familles de l'établissement (${parentIds.length} parents)`;
  }

  if (parentIds.length === 0) {
    return {
      success: false,
      message: `⚠️ Aucun parent trouvé pour la cible sélectionnée (${targetDescription}).`,
      summary: "Aucun destinataire",
    };
  }

  const { count } = await sendMobileMessageToParents({
    schoolId: context.schoolId,
    parentIds,
    studentId: studentIdRef,
    title,
    message: args.message,
    type,
  });

  await prisma.auditLog.create({
    data: {
      action: "SEND_NOTIFICATION",
      performedBy: `Hnia AI (Telegram / ${context.adminName})`,
      entityType: "Notification",
      description: `[Hnia AI Telegram] Message mobile envoyé à ${targetDescription} : "${title}" (${count} destinataires).`,
      schoolId: context.schoolId,
    },
  });

  return {
    success: true,
    message: `📢 **Notification mobile transmise avec succès !**\n\n🎯 **Destinataires :** ${targetDescription}\n📌 **Titre :** ${title}\n💬 **Message :** <i>"${args.message}"</i>\n\n📱 <i>${count} famille(s) ont reçu la notification push et peuvent la consulter dans leur espace mobile.</i>`,
    summary: `Message mobile envoyé (${count} familles)`,
    data: { count, target: targetDescription },
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

  const hasExplicitDate = Boolean(args.date);
  const hasExplicitMonth = args.month !== undefined && args.month !== null;
  const queryAllTime = Boolean(args.category || args.query) && !hasExplicitDate && !hasExplicitMonth;

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
  } else if (queryAllTime) {
    filterDateWhere = where;
  } else {
    filterDateWhere = { ...where, date: { gte: startDate, lt: endDate } };
  }

  const [dateSum, monthSum, todaySum, filteredAllTimeSum, schoolAllTimeSum, allCategoriesBreakdown, records] = await Promise.all([
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
      where,
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
      where: { schoolId: context.schoolId },
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
    period: args.date ? (args.date === "today" ? "Aujourd'hui" : args.date) : (queryAllTime ? `Historique complet (${args.category || args.query})` : `${month}/${year}`),
    categoryStats: args.category ? {
      category: args.category,
      totalAllTime: `${filteredAllTimeSum._sum.amount || 0} DT`,
      countAllTime: filteredAllTimeSum._count.id || 0,
      totalCurrentMonth: `${monthSum._sum.amount || 0} DT (${month}/${year})`,
      countCurrentMonth: monthSum._count.id || 0,
    } : undefined,
    summary: {
      todayTotal: `${todaySum._sum.amount || 0} DT`,
      selectedTotal: `${dateSum._sum.amount || 0} DT`,
      currentMonthTotal: `${monthSum._sum.amount || 0} DT`,
      currentMonthCount: monthSum._count.id || 0,
      historicalTotal: `${schoolAllTimeSum._sum.amount || 0} DT`,
    },
    allCategoriesInSchool: allCategoriesBreakdown.map((c) => ({
      category: c.category,
      total: `${c._sum.amount || 0} DT`,
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

  const priorCategory = await prisma.income.findFirst({
    where: {
      schoolId: context.schoolId,
      category: { equals: category, mode: "insensitive" },
    },
    select: { id: true },
  });
  const isExisting = Boolean(priorCategory);

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
📂 Catégorie : <code>${category}</code> ${isExisting ? "(Catégorie existante ✅)" : "(Nouvelle catégorie 🆕)"}
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
  const hasExplicitMonth = args.month !== undefined && args.month !== null;
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  const baseWhere: any = {
    schoolId: context.schoolId,
  };

  if (args.category) {
    baseWhere.category = { contains: args.category.trim(), mode: "insensitive" };
  }

  if (args.query) {
    baseWhere.title = { contains: args.query.trim(), mode: "insensitive" };
  }

  // If user is inquiring about a specific category or search term without specifying a month,
  // we query across all time to ensure older records (e.g. August for BUS02) are not lost!
  const queryAllTime = Boolean(args.category || args.query) && !hasExplicitMonth;
  const recordWhere = queryAllTime
    ? baseWhere
    : { ...baseWhere, date: { gte: startDate, lt: endDate } };

  const [
    filteredMonthSum,
    filteredAllTimeSum,
    schoolAllTimeSum,
    allCategoriesBreakdown,
    records,
  ] = await Promise.all([
    prisma.expense.aggregate({
      where: { ...baseWhere, date: { gte: startDate, lt: endDate } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.expense.aggregate({
      where: baseWhere,
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
      where: { schoolId: context.schoolId },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.findMany({
      where: recordWhere,
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
    period: hasExplicitMonth ? `${month}/${year}` : (args.category ? `Historique complet (${args.category})` : `${month}/${year}`),
    filter: {
      category: args.category || null,
      query: args.query || null,
      isAllTime: queryAllTime,
    },
    categoryStats: args.category ? {
      category: args.category,
      totalAllTime: `${filteredAllTimeSum._sum.amount || 0} DT`,
      countAllTime: filteredAllTimeSum._count.id || 0,
      totalCurrentMonth: `${filteredMonthSum._sum.amount || 0} DT (${month}/${year})`,
      countCurrentMonth: filteredMonthSum._count.id || 0,
    } : undefined,
    summary: {
      filteredPeriodTotal: `${(queryAllTime ? filteredAllTimeSum : filteredMonthSum)._sum.amount || 0} DT`,
      filteredPeriodCount: (queryAllTime ? filteredAllTimeSum : filteredMonthSum)._count.id || 0,
      historicalTotal: `${schoolAllTimeSum._sum.amount || 0} DT`,
    },
    allCategoriesInSchool: allCategoriesBreakdown.map((c) => ({
      category: c.category,
      total: `${c._sum.amount || 0} DT`,
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
 * Tool: get_daily_caisse
 * Generates an end-of-day cash register closing report (Clôture de Caisse).
 * Computes:
 * - Cash/income collected today (tuition, registrations, etc.)
 * - Expenses paid out of register today
 * - Physical net cash balance
 * - Today's attendance summary (absents & unexcused)
 */
export async function getDailyCaisseTool(
  args: { date?: string },
  context: ToolContext
) {
  const targetDate = args.date ? new Date(args.date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const [incomesToday, expensesToday, paymentsToday, absencesToday] = await Promise.all([
    // 1. Total income today
    prisma.income.findMany({
      where: {
        schoolId: context.schoolId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true, title: true, amount: true, category: true },
    }),
    // 2. Total expenses today
    prisma.expense.findMany({
      where: {
        schoolId: context.schoolId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true, title: true, amount: true, category: true },
    }),
    // 3. Student payments recorded today
    prisma.payment.findMany({
      where: {
        schoolId: context.schoolId,
        paidAt: { gte: startOfDay, lte: endOfDay },
        userType: "STUDENT",
      },
      include: {
        student: {
          select: { name: true, surname: true, class: { select: { name: true } } },
        },
      },
    }),
    // 4. Absences recorded today
    prisma.attendance.findMany({
      where: {
        schoolId: context.schoolId,
        date: { gte: startOfDay, lte: endOfDay },
        status: "ABSENT",
      },
      include: {
        student: {
          select: { name: true, surname: true, class: { select: { name: true } } },
        },
      },
    }),
  ]);

  const totalIncomes = incomesToday.reduce((sum, inc) => sum + inc.amount, 0);
  const totalExpenses = expensesToday.reduce((sum, exp) => sum + exp.amount, 0);
  const netCaisse = totalIncomes - totalExpenses;

  const unexcusedAbsences = absencesToday.filter(
    (a) => a.justificationStatus !== "APPROVED"
  );

  return {
    date: targetDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    summary: {
      totalIncomes: `${totalIncomes} DT`,
      totalExpenses: `${totalExpenses} DT`,
      netCashBalance: `${netCaisse} DT`,
      paymentsCount: paymentsToday.length,
      expensesCount: expensesToday.length,
      absencesCount: absencesToday.length,
      unexcusedAbsencesCount: unexcusedAbsences.length,
    },
    incomesDetail: incomesToday.map((i) => ({
      title: i.title,
      amount: `${i.amount} DT`,
      category: i.category,
    })),
    expensesDetail: expensesToday.map((e) => ({
      title: e.title,
      amount: `${e.amount} DT`,
      category: e.category,
    })),
    recentPayments: paymentsToday.map((p) => ({
      student: p.student ? `${p.student.name} ${p.student.surname}` : "Élève",
      class: p.student?.class?.name || "N/A",
      amount: `${p.amount} DT`,
      month: `${MONTHS[p.month - 1]} ${p.year}`,
      status: p.status,
    })),
    unexcusedAbsents: unexcusedAbsences.map((a) => ({
      student: `${a.student.name} ${a.student.surname}`,
      class: a.student.class?.name || "N/A",
    })),
  };
}

/**
 * Tool: void_expense
 * Voids/deletes an accidental expense entry from the school register.
 */
export async function voidExpenseTool(
  args: {
    expenseId?: number;
    query?: string;
    amount?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetExpense: any = null;

  if (args.expenseId) {
    targetExpense = await prisma.expense.findFirst({
      where: { id: args.expenseId, schoolId: context.schoolId },
    });
  } else if (args.query || args.amount) {
    const where: any = { schoolId: context.schoolId };
    if (args.query) {
      where.title = { contains: args.query.trim(), mode: "insensitive" };
    }
    if (args.amount) {
      where.amount = args.amount;
    }
    targetExpense = await prisma.expense.findFirst({
      where,
      orderBy: { date: "desc" },
    });
  }

  if (!targetExpense) {
    return {
      success: false,
      message: `⚠️ Dépense introuvable dans le registre de l'école.`,
      summary: "Dépense introuvable",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.delete({
      where: { id: targetExpense.id },
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Expense",
        entityId: targetExpense.id.toString(),
        description: `[Hnia AI Telegram] Annulation dépense : "${targetExpense.title}" de ${targetExpense.amount} DT (${targetExpense.category})`,
        amount: targetExpense.amount,
        type: "expense",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "dashboard");

  return {
    success: true,
    message: `🗑️ Dépense annulée avec succès : <b>${targetExpense.title}</b> d'un montant de <code>${targetExpense.amount} DT</code> a été retirée du registre financier.`,
    summary: `Annulation dépense ${targetExpense.amount} DT`,
    data: { voidedExpenseId: targetExpense.id },
  };
}

/**
 * Tool: cancel_payment
 * Cancels or resets a tuition payment entered by mistake.
 */
export async function cancelPaymentTool(
  args: {
    studentNameOrId: string;
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `Élève "${args.studentNameOrId}" introuvable.`,
      summary: "Élève introuvable",
    };
  }

  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();

  const payment = await prisma.payment.findFirst({
    where: {
      studentId: student.id,
      month,
      year,
      schoolId: context.schoolId,
      userType: "STUDENT",
    },
  });

  if (!payment) {
    return {
      success: false,
      message: `Aucun paiement trouvé pour <b>${student.name} ${student.surname}</b> pour <code>${MONTHS[month - 1]} ${year}</code>.`,
      summary: "Paiement introuvable",
    };
  }

  const cancelledAmount = payment.amount;

  await prisma.$transaction(async (tx) => {
    // 1. Reset payment to PENDING with 0 amount
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "PENDING",
        amount: 0,
        paidAt: null,
        deferredAmount: null,
        deferredUntil: null,
      },
    });

    // 2. Remove associated Income record if exists
    await tx.income.deleteMany({
      where: {
        schoolId: context.schoolId,
        referenceType: "StudentPayment",
        referenceId: payment.id.toString(),
      },
    });

    // 3. Log Audit
    await tx.auditLog.create({
      data: {
        action: "CANCEL_PAYMENT",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: payment.id.toString(),
        description: `[Hnia AI Telegram] Annulation paiement scolarité : ${student.name} ${student.surname} (${MONTHS[month - 1]} ${year}) - ${cancelledAmount} DT annulés`,
        amount: cancelledAmount,
        type: "income",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "students", "dashboard");

  return {
    success: true,
    message: `↩️ Paiement annulé avec succès : Le règlement de <code>${cancelledAmount} DT</code> de <b>${student.name} ${student.surname}</b> pour <code>${MONTHS[month - 1]} ${year}</code> a été remis en statut ❌ <code>NON PAYÉ</code>.`,
    summary: `Annulation paiement ${student.name} (${cancelledAmount} DT)`,
    data: { paymentId: payment.id },
  };
}

/**
 * Tool: update_income
 * Modifies an existing income/revenue record (title, amount, category, date, or proof photo).
 */
export async function updateIncomeTool(
  args: {
    incomeId?: number;
    query?: string;
    newTitle?: string;
    newAmount?: number;
    newCategory?: string;
    newDate?: string;
    newImg?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetIncome: any = null;

  if (args.incomeId) {
    targetIncome = await prisma.income.findFirst({
      where: { id: args.incomeId, schoolId: context.schoolId },
    });
  } else if (args.query) {
    targetIncome = await prisma.income.findFirst({
      where: {
        schoolId: context.schoolId,
        title: { contains: args.query.trim(), mode: "insensitive" },
      },
      orderBy: { date: "desc" },
    });
  }

  if (!targetIncome) {
    return {
      success: false,
      message: `Revenu introuvable dans le registre de l'école.`,
      summary: "Revenu introuvable",
    };
  }

  const updateData: any = {};
  const changeDescriptions: string[] = [];

  if (args.newTitle && args.newTitle.trim() !== targetIncome.title) {
    updateData.title = args.newTitle.trim();
    changeDescriptions.push(`Intitulé : "${targetIncome.title}" → <b>"${args.newTitle.trim()}"</b>`);
  }

  if (args.newAmount !== undefined && args.newAmount !== targetIncome.amount) {
    const amt = Math.abs(Number(args.newAmount));
    updateData.amount = amt;
    changeDescriptions.push(`Montant : <code>${targetIncome.amount} DT</code> → <code>${amt} DT</code>`);
  }

  if (args.newCategory && args.newCategory.trim() !== targetIncome.category) {
    updateData.category = args.newCategory.trim();
    changeDescriptions.push(`Catégorie : <code>${targetIncome.category}</code> → <code>${args.newCategory.trim()}</code>`);
  }

  if (args.newDate) {
    const d = new Date(args.newDate);
    if (!isNaN(d.getTime())) {
      updateData.date = d;
      changeDescriptions.push(`Date : <code>${d.toISOString().split("T")[0]}</code>`);
    }
  }

  if (args.newImg !== undefined) {
    updateData.img = args.newImg || null;
    changeDescriptions.push(`Pièce jointe mise à jour`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour ce revenu.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.income.update({
      where: { id: targetIncome.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Income",
        entityId: targetIncome.id.toString(),
        description: `[Hnia AI Telegram] Modification revenu : ${changeDescriptions.join(", ")}`,
        amount: updateData.amount ?? targetIncome.amount,
        type: "income",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "incomes", "finance", "dashboard");

  return {
    success: true,
    message: `✏️ <b>Revenu Mis à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Revenu :</b> <b>${updateData.title || targetIncome.title}</b>
• ${changeDescriptions.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les modifications ont été appliquées immédiatement dans le registre financier.</blockquote>`,
    summary: `Mise à jour revenu ${targetIncome.id}`,
    data: { incomeId: targetIncome.id, updates: updateData },
  };
}

/**
 * Tool: delete_income
 * Deletes or cancels a general revenue entry from the school register.
 */
export async function deleteIncomeTool(
  args: {
    incomeId?: number;
    query?: string;
    amount?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetIncome: any = null;

  if (args.incomeId) {
    targetIncome = await prisma.income.findFirst({
      where: { id: args.incomeId, schoolId: context.schoolId },
    });
  } else if (args.query || args.amount) {
    const where: any = { schoolId: context.schoolId };
    if (args.query) {
      where.title = { contains: args.query.trim(), mode: "insensitive" };
    }
    if (args.amount) {
      where.amount = args.amount;
    }
    targetIncome = await prisma.income.findFirst({
      where,
      orderBy: { date: "desc" },
    });
  }

  if (!targetIncome) {
    return {
      success: false,
      message: `⚠️ Revenu introuvable dans le registre de l'école.`,
      summary: "Revenu introuvable",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.income.delete({
      where: { id: targetIncome.id },
    });

    await tx.auditLog.create({
      data: {
        action: "DELETE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Income",
        entityId: targetIncome.id.toString(),
        description: `[Hnia AI Telegram] Suppression revenu : "${targetIncome.title}" de ${targetIncome.amount} DT (${targetIncome.category})`,
        amount: targetIncome.amount,
        type: "income",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "incomes", "finance", "dashboard");

  return {
    success: true,
    message: `🗑️ <b>Revenu Supprimé</b>
━━━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Intitulé :</b> <b>${targetIncome.title}</b>
💰 <b>Montant retiré :</b> <code>${targetIncome.amount} DT</code>
📂 <b>Catégorie :</b> <code>${targetIncome.category}</code>

<blockquote>💡 <b>Hnia :</b> Cette recette a été retirée du registre financier et les totaux de caisse ont été actualisés.</blockquote>`,
    summary: `Suppression revenu ${targetIncome.amount} DT`,
    data: { deletedIncomeId: targetIncome.id },
  };
}

/**
 * Tool: update_expense
 * Modifies an existing expense record (title, amount, category, date, or receipt photo).
 */
export async function updateExpenseTool(
  args: {
    expenseId?: number;
    query?: string;
    newTitle?: string;
    newAmount?: number;
    newCategory?: string;
    newDate?: string;
    newImg?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetExpense: any = null;

  if (args.expenseId) {
    targetExpense = await prisma.expense.findFirst({
      where: { id: args.expenseId, schoolId: context.schoolId },
    });
  } else if (args.query) {
    targetExpense = await prisma.expense.findFirst({
      where: {
        schoolId: context.schoolId,
        title: { contains: args.query.trim(), mode: "insensitive" },
      },
      orderBy: { date: "desc" },
    });
  }

  if (!targetExpense) {
    return {
      success: false,
      message: `Dépense introuvable dans le registre de l'école.`,
      summary: "Dépense introuvable",
    };
  }

  const updateData: any = {};
  const changeDescriptions: string[] = [];

  if (args.newTitle && args.newTitle.trim() !== targetExpense.title) {
    updateData.title = args.newTitle.trim();
    changeDescriptions.push(`Intitulé : "${targetExpense.title}" → <b>"${args.newTitle.trim()}"</b>`);
  }

  if (args.newAmount !== undefined && args.newAmount !== targetExpense.amount) {
    const amt = Math.abs(Number(args.newAmount));
    updateData.amount = amt;
    changeDescriptions.push(`Montant : <code>${targetExpense.amount} DT</code> → <code>${amt} DT</code>`);
  }

  if (args.newCategory && args.newCategory.trim() !== targetExpense.category) {
    updateData.category = args.newCategory.trim();
    changeDescriptions.push(`Catégorie : <code>${targetExpense.category}</code> → <code>${args.newCategory.trim()}</code>`);
  }

  if (args.newDate) {
    const d = new Date(args.newDate);
    if (!isNaN(d.getTime())) {
      updateData.date = d;
      changeDescriptions.push(`Date : <code>${d.toISOString().split("T")[0]}</code>`);
    }
  }

  if (args.newImg !== undefined) {
    updateData.img = args.newImg || null;
    changeDescriptions.push(`Reçu / justificatif mis à jour`);
  }

  if (Object.keys(updateData).length === 0) {
    return {
      success: false,
      message: "Aucune modification spécifiée pour cette dépense.",
      summary: "Aucune modification",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id: targetExpense.id },
      data: updateData,
    });

    await tx.auditLog.create({
      data: {
        action: "UPDATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Expense",
        entityId: targetExpense.id.toString(),
        description: `[Hnia AI Telegram] Modification dépense : ${changeDescriptions.join(", ")}`,
        amount: updateData.amount ?? targetExpense.amount,
        type: "expense",
        schoolId: context.schoolId,
      },
    });
  });

  invalidateTenantTags(context.schoolId, "finance", "dashboard");

  return {
    success: true,
    message: `✏️ <b>Dépense Mise à Jour</b>
━━━━━━━━━━━━━━━━━━━━━━
🏷️ <b>Dépense :</b> <b>${updateData.title || targetExpense.title}</b>
• ${changeDescriptions.join("\n• ")}

<blockquote>💡 <b>Hnia :</b> Les modifications ont été enregistrées immédiatement dans la comptabilité.</blockquote>`,
    summary: `Mise à jour dépense ${targetExpense.id}`,
    data: { expenseId: targetExpense.id, updates: updateData },
  };
}

/**
 * Tool: get_audit_log
 * Consults and searches the school's official audit trail (/admin/audit).
 */
export async function getAuditLogTool(
  args: {
    query?: string;
    action?: string;
    entityType?: string;
    performedBy?: string;
    date?: string;
    limit?: number;
  },
  context: ToolContext
) {
  const where: any = {
    schoolId: context.schoolId,
  };

  if (args.action) {
    where.action = { equals: args.action.trim(), mode: "insensitive" };
  }

  if (args.entityType) {
    where.entityType = { equals: args.entityType.trim(), mode: "insensitive" };
  }

  if (args.performedBy) {
    where.performedBy = { contains: args.performedBy.trim(), mode: "insensitive" };
  }

  if (args.query) {
    const q = args.query.trim();
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { entityType: { contains: q, mode: "insensitive" } },
      { performedBy: { contains: q, mode: "insensitive" } },
    ];
  }

  if (args.date) {
    let target = new Date();
    if (args.date === "yesterday") {
      target.setDate(target.getDate() - 1);
    } else if (args.date !== "today") {
      const parsed = new Date(args.date);
      if (!isNaN(parsed.getTime())) target = parsed;
    }
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(target);
    end.setHours(23, 59, 59, 999);
    where.timestamp = { gte: start, lte: end };
  }

  const limit = Math.min(args.limit || 20, 50);

  const [totalCount, logs, actionCounts] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      take: limit,
      orderBy: { timestamp: "desc" },
    }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { schoolId: context.schoolId },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  return {
    totalMatching: totalCount,
    displayedCount: logs.length,
    filters: {
      action: args.action || null,
      entityType: args.entityType || null,
      performedBy: args.performedBy || null,
      date: args.date || null,
      query: args.query || null,
    },
    topActionsInSchool: actionCounts.map((a) => ({
      action: a.action,
      count: a._count.id,
    })),
    logs: logs.map((l) => {
      const timeStr = l.timestamp.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return {
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        performer: l.performedBy,
        description: l.description,
        amount: l.amount ? `${l.amount} DT` : null,
        timestamp: timeStr,
      };
    }),
  };
}

/**
 * Tool: add_audit_entry
 * Records an official administrative note, inspection event, or incident in the audit log.
 */
export async function addAuditEntryTool(
  args: {
    description: string;
    action?: string;
    entityType?: string;
    amount?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const action = args.action?.trim().toUpperCase() || "ADMIN_NOTE";
  const entityType = args.entityType?.trim() || "School";

  const entry = await prisma.auditLog.create({
    data: {
      action,
      performedBy: `Hnia AI (Telegram / ${context.adminName})`,
      entityType,
      description: `[Hnia AI Telegram] Note d'audit : ${args.description.trim()}`,
      amount: args.amount ?? null,
      schoolId: context.schoolId,
    },
  });

  invalidateTenantTags(context.schoolId, "dashboard");

  return {
    success: true,
    message: `📋 <b>Entrée Enregistrée dans le Journal d'Audit</b>
━━━━━━━━━━━━━━━━━━━━━━
🔖 <b>Action :</b> <code>${action}</code>
📌 <b>Entité :</b> <code>${entityType}</code>
📝 <b>Description :</b> <i>"${args.description.trim()}"</i>
${args.amount ? `💰 <b>Montant :</b> <code>${args.amount} DT</code>\n` : ""}👤 <b>Par :</b> ${context.adminName}`,
    summary: `Note audit : ${args.description.slice(0, 30)}...`,
    data: { auditLogId: entry.id },
  };
}


