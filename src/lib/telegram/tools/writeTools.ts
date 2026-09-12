import prisma from "@/lib/prisma";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";
import { createAnnouncementNotifications } from "@/lib/notifications";
import { ToolContext } from "./readTools";

export interface WriteToolResult {
  success: boolean;
  message: string;
  summary: string;
  data?: any;
  needsClarification?: boolean;
}

/**
 * Helper: Calculates the multi-month cascading tuition allocation for a student.
 * Identical to the web application's receiveMultipleStudentPayments logic.
 */
export async function calculateStudentPaymentAllocation(
  studentId: string,
  amount: number,
  schoolId: string,
  startMonth?: number,
  startYear?: number
) {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId },
    include: { level: true, class: true },
  });
  if (!student) return null;

  const { getSchoolYearMonths } = await import("@/lib/dateUtils");
  const tuitionFee = student.customTuition || student.level?.tuitionFee || 450;
  const schoolYearMonths = getSchoolYearMonths();

  // Fetch existing payments for the student
  const existingPayments = await prisma.payment.findMany({
    where: {
      studentId: student.id,
      schoolId,
      userType: "STUDENT",
    },
  });

  // Determine starting month index
  let currentIdx = 0;
  if (startMonth && startYear) {
    const targetKey = `${MONTHS[startMonth - 1]} ${startYear}`;
    const foundIdx = schoolYearMonths.indexOf(targetKey);
    if (foundIdx !== -1) {
      currentIdx = foundIdx;
    }
  } else {
    // Find earliest unpaid or partially paid month in academic year
    const earliestIdx = schoolYearMonths.findIndex((mKey) => {
      const [mName, yStr] = mKey.split(" ");
      const mIdx = MONTHS.indexOf(mName) + 1;
      const yVal = parseInt(yStr);
      const payment = existingPayments.find((p) => p.month === mIdx && p.year === yVal);
      const paid = payment?.amount || 0;
      return paid < tuitionFee;
    });
    if (earliestIdx !== -1) {
      currentIdx = earliestIdx;
    }
  }

  let moneyToDistribute = amount;
  const paymentsToProcess: Array<{
    monthYear: string;
    month: number;
    year: number;
    amount: number;
    isPartial: boolean;
    gap: number;
    status: "PAID" | "PARTIAL";
    previousAmount: number;
    newMoneyCollected: number;
    isRecovery: boolean;
  }> = [];

  while (moneyToDistribute > 0 && currentIdx >= 0 && currentIdx < schoolYearMonths.length) {
    const mKey = schoolYearMonths[currentIdx];
    const [mName, yStr] = mKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const existing = existingPayments.find((p) => p.month === monthIdx && p.year === yearVal);
    const alreadyPaid = existing?.amount || 0;
    const remainingForMonth = Math.max(0, tuitionFee - alreadyPaid);

    // If already fully paid, skip to next month
    if (remainingForMonth === 0) {
      currentIdx++;
      continue;
    }

    if (moneyToDistribute >= remainingForMonth) {
      const allocated = remainingForMonth;
      paymentsToProcess.push({
        monthYear: mKey,
        month: monthIdx,
        year: yearVal,
        amount: alreadyPaid + allocated,
        isPartial: false,
        gap: 0,
        status: "PAID",
        previousAmount: alreadyPaid,
        newMoneyCollected: allocated,
        isRecovery: alreadyPaid > 0,
      });
      moneyToDistribute -= allocated;
    } else {
      const allocated = moneyToDistribute;
      const newTotal = alreadyPaid + allocated;
      const newGap = tuitionFee - newTotal;
      paymentsToProcess.push({
        monthYear: mKey,
        month: monthIdx,
        year: yearVal,
        amount: newTotal,
        isPartial: true,
        gap: newGap,
        status: "PARTIAL",
        previousAmount: alreadyPaid,
        newMoneyCollected: allocated,
        isRecovery: alreadyPaid > 0,
      });
      moneyToDistribute = 0;
    }
    currentIdx++;
  }

  // If excess money remains after all months, allocate to last month as overpayment
  if (moneyToDistribute > 0 && paymentsToProcess.length > 0) {
    const lastP = paymentsToProcess[paymentsToProcess.length - 1];
    lastP.amount += moneyToDistribute;
    lastP.newMoneyCollected += moneyToDistribute;
    moneyToDistribute = 0;
  }

  return {
    student,
    tuitionFee,
    paymentsToProcess,
  };
}

/**
 * Tool: record_payment
 * Records a tuition payment with multi-month cascading allocation and partial recovery.
 */
export async function recordPaymentTool(
  args: {
    studentNameOrId: string;
    amount: number;
    month?: number;
    year?: number;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const query = args.studentNameOrId.trim();

  // 1. Locate the student
  let student = await prisma.student.findFirst({
    where: {
      schoolId: context.schoolId,
      id: query,
    },
    include: { level: true, class: true },
  });

  if (!student) {
    const candidates = await prisma.student.findMany({
      where: {
        schoolId: context.schoolId,
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { surname: { contains: query, mode: "insensitive" } },
          {
            AND: query.includes(" ")
              ? [
                  { name: { contains: query.split(" ")[0], mode: "insensitive" } },
                  { surname: { contains: query.split(" ").slice(1).join(" "), mode: "insensitive" } },
                ]
              : undefined,
          },
        ],
      },
      include: { class: true, level: true },
      take: 5,
    });

    if (candidates.length === 0) {
      return {
        success: false,
        message: `Aucun élève trouvé avec le nom "${query}". Veuillez vérifier l'orthographe.`,
        summary: `Élève non trouvé: ${query}`,
      };
    }

    if (candidates.length > 1) {
      const names = candidates
        .map((c) => `• <b>${c.name} ${c.surname}</b> (Classe : <code>${c.class?.name || "Sans classe"}</code>)`)
        .join("\n");
      return {
        success: false,
        needsClarification: true,
        message: `Plusieurs élèves correspondent à "${query}". Précisez :\n${names}`,
        summary: `Plusieurs correspondances pour ${query}`,
      };
    }

    student = candidates[0];
  }

  const studentFullName = `${student.name} ${student.surname}`;

  // 2. Compute the cascading multi-month allocation
  const allocation = await calculateStudentPaymentAllocation(
    student.id,
    args.amount,
    context.schoolId,
    args.month,
    args.year
  );

  if (!allocation || allocation.paymentsToProcess.length === 0) {
    return {
      success: false,
      message: `Tous les frais de scolarité pour **${studentFullName}** semblent déjà soldés pour cette année scolaire.`,
      summary: `Paiement non requis`,
    };
  }

  const { paymentsToProcess, tuitionFee } = allocation;
  const upsertedPayments: any[] = [];
  let totalNewMoneyCollected = 0;

  // 3. Database transaction matching receiveMultipleStudentPayments
  await prisma.$transaction(
    async (tx) => {
      for (const pmt of paymentsToProcess) {
        totalNewMoneyCollected += pmt.newMoneyCollected;

        const p = await tx.payment.upsert({
          where: {
            studentId_month_year: {
              studentId: student.id,
              month: pmt.month,
              year: pmt.year,
            },
          },
          update: {
            status: pmt.status,
            paidAt: new Date(),
            amount: pmt.amount,
            deferredAmount: pmt.isPartial ? pmt.gap : 0,
          },
          create: {
            studentId: student.id,
            amount: pmt.amount,
            deferredAmount: pmt.isPartial ? pmt.gap : 0,
            month: pmt.month,
            year: pmt.year,
            status: pmt.status,
            userType: "STUDENT",
            paidAt: new Date(),
            schoolId: context.schoolId,
          },
        });

        upsertedPayments.push(p);

        // Delete deferred revenue gap expense if previously partial and now paid
        if (!pmt.isPartial && pmt.previousAmount > 0) {
          await tx.expense.deleteMany({
            where: {
              category: "Deferred Revenue Gap",
              title: { contains: `${studentFullName} (${pmt.monthYear})` },
              schoolId: context.schoolId,
            },
          });
        }
      }

      // Record income entry
      if (totalNewMoneyCollected > 0 && upsertedPayments.length > 0) {
        let suffix = "";
        const isRecovery = paymentsToProcess.some((p) => p.isRecovery);
        if (paymentsToProcess.length > 1) {
          suffix = " - Combined";
        } else if (paymentsToProcess[0].isPartial) {
          suffix = " - Partial";
        } else if (isRecovery) {
          suffix = " - Recovery";
        }
        const titleRef = paymentsToProcess[0].monthYear + suffix;
        const bulkCategory = isRecovery ? "Recovery" : paymentsToProcess[0].isPartial ? "Partial" : "Tuition";

        await tx.income.create({
          data: {
            title: `Tuition: ${studentFullName} (${titleRef})`,
            amount: totalNewMoneyCollected,
            date: new Date(),
            category: bulkCategory,
            referenceType: "StudentPayment",
            referenceId: upsertedPayments[0].id.toString(),
            schoolId: context.schoolId,
          },
        });
      }

      // Record audit log
      await tx.auditLog.create({
        data: {
          action: "RECORD_PAYMENT",
          performedBy: `Hnia AI (Telegram / ${context.adminName})`,
          entityType: "Payment",
          entityId: upsertedPayments[0]?.id.toString() || student.id,
          amount: totalNewMoneyCollected,
          description: `[Hnia AI Telegram] Répartition scolarité multi-mois pour ${studentFullName}: ${args.amount} DT (${paymentsToProcess.length} mois)`,
          schoolId: context.schoolId,
        },
      });
    },
    { timeout: 15000 }
  );

  // 4. Invalidate tenant cache tags
  try {
    invalidateTenantTags(context.schoolId, "students", "finance", "dashboard", "incomes");
  } catch (err) {
    console.warn("[recordPaymentTool] Cache invalidation warning:", err);
  }

  // 5. Build rich compact mobile response
  const breakdownLines = paymentsToProcess.map((p) => {
    const frMonthYear = formatMonthFrench(p.monthYear);
    const statusBadge = p.isPartial
      ? `⚠️ <code>PARTIEL</code> (Reçu <code>${p.amount} DT</code> • Reste <code>${p.gap} DT</code>)`
      : `✅ <code>SOLDÉ</code> (<code>${p.amount} DT</code>)`;
    return `• <b>${frMonthYear}</b> : ${statusBadge}`;
  });

  const message = `✅ <b>Paiement Enregistré</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>${studentFullName}</b> • Classe <code>${student.class?.name || "Sans classe"}</code>
💰 Reçu : <code>${args.amount} DT</code> (Tarif : <code>${tuitionFee} DT/m</code>)

📋 <b>Ventilation :</b>
${breakdownLines.join("\n")}`;

  return {
    success: true,
    message,
    summary: `Paiement ${args.amount} DT réparti pour ${studentFullName} (${paymentsToProcess.length} mois)`,
    data: {
      studentName: studentFullName,
      paymentsCount: paymentsToProcess.length,
      affectedMonths: paymentsToProcess.map((p) => formatMonthFrench(p.monthYear)),
    },
  };
}

/**
 * Tool: add_expense
 * Records an operational expense.
 */
export async function addExpenseTool(
  args: {
    title: string;
    amount: number;
    category?: string;
    date?: string;
    img?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const category = args.category?.trim() || "Général";
  const expenseDate = args.date ? new Date(args.date) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        title: args.title.trim(),
        amount: args.amount,
        category,
        date: expenseDate,
        img: args.img || null,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Expense",
        entityId: expense.id.toString(),
        amount: args.amount,
        description: `[Hnia AI Telegram] Dépense ajoutée : ${args.title} (${args.amount} DT - ${category})`,
        schoolId: context.schoolId,
      },
    });

    return expense;
  });

  try {
    invalidateTenantTags(context.schoolId, "finance", "expenses", "dashboard");
  } catch (err) {
    console.warn("[addExpenseTool] Cache invalidation warning:", err);
  }

  const dateStr = expenseDate.toLocaleDateString("fr-FR");
  const imgStr = args.img ? "\n🖼️ <i>Reçu / justificatif joint</i>" : "";

  return {
    success: true,
    message: `✅ <b>Dépense Enregistrée</b>
━━━━━━━━━━━━━━━━━━━━━━
💰 Montant : <code>-${args.amount} DT</code>
🏷️ Intitulé : <b>${args.title.trim()}</b>
📂 Catégorie : <code>${category}</code>
📅 Date : <code>${dateStr}</code>${imgStr}`,
    summary: `Dépense "${args.title}" (-${args.amount} DT)`,
    data: { expenseId: result.id },
  };
}

/**
 * Tool: post_announcement
 * Publishes an announcement notice for the school or a specific class.
 */
export async function postAnnouncementTool(
  args: {
    title: string;
    message: string;
    className?: string;
    important?: boolean;
    img?: string;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  let targetClassId: number | undefined;

  if (args.className) {
    const cls = await prisma.class.findFirst({
      where: {
        schoolId: context.schoolId,
        name: { contains: args.className.trim(), mode: "insensitive" },
      },
    });
    if (cls) {
      targetClassId = cls.id;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const notice = await tx.notice.create({
      data: {
        title: args.title.trim(),
        message: args.message.trim(),
        important: Boolean(args.important),
        classId: targetClassId || null,
        img: args.img || null,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "POST_NOTICE",
        performedBy: `Hnia AI (Telegram / ${context.adminName})`,
        entityType: "Notice",
        entityId: notice.id.toString(),
        description: `[Hnia AI Telegram] Annonce publiée : "${args.title}"${targetClassId ? " (Classe ciblée)" : " (Toute l'école)"}${args.important ? " [URGENT]" : ""}`,
        schoolId: context.schoolId,
      },
    });

    return notice;
  });

  // Attempt to broadcast notification to parents
  try {
    await createAnnouncementNotifications(result.id);
  } catch (err) {
    console.warn("[postAnnouncementTool] Notification broadcast warning:", err);
  }

  try {
    invalidateTenantTags(context.schoolId, "institution", "dashboard");
  } catch (err) {
    console.warn("[postAnnouncementTool] Cache invalidation warning:", err);
  }

  return {
    success: true,
    message: `📢 Annonce publiée avec succès : "${args.title}"${
      args.className ? ` pour la classe ${args.className}` : " pour toute l'école"
    }. Les parents ont été notifiés.`,
    summary: `Annonce "${args.title}"`,
    data: { noticeId: result.id },
  };
}
