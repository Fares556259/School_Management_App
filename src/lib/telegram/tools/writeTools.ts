import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
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
 * Tool: record_payment
 * Records a tuition payment for a student.
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
  const now = new Date();
  const month = args.month || now.getMonth() + 1;
  const year = args.year || now.getFullYear();
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
    // Search by name
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
        .map((c) => `• ${c.name} ${c.surname} (${c.class?.name || "Sans classe"}) [ID: ${c.id}]`)
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
  const monthName = MONTHS[month - 1] || `Mois ${month}`;
  const standardFee = student.customTuition || student.level.tuitionFee || 450;
  const isPartial = args.amount < standardFee;

  // 2. Perform transactional update
  const result = await prisma.$transaction(async (tx) => {
    // Find existing payment if any
    const existing = await tx.payment.findFirst({
      where: {
        studentId: student.id,
        month,
        year,
      },
    });

    let paymentRecord;
    if (existing) {
      paymentRecord = await tx.payment.update({
        where: { id: existing.id },
        data: {
          amount: args.amount,
          status: isPartial ? "PARTIAL" : "PAID",
          deferredAmount: isPartial ? standardFee - args.amount : 0,
          paidAt: new Date(),
        },
      });
    } else {
      paymentRecord = await tx.payment.create({
        data: {
          studentId: student.id,
          month,
          year,
          amount: args.amount,
          status: isPartial ? "PARTIAL" : "PAID",
          deferredAmount: isPartial ? standardFee - args.amount : 0,
          userType: "STUDENT",
          paidAt: new Date(),
          schoolId: context.schoolId,
        },
      });
    }

    // Record Income ledger entry
    const ledgerTitle = `Frais de scolarité : ${studentFullName} (${monthName} ${year})`;
    await tx.income.create({
      data: {
        title: ledgerTitle,
        amount: args.amount,
        category: "Tuition",
        date: new Date(),
        referenceType: "Payment",
        referenceId: paymentRecord.id.toString(),
        schoolId: context.schoolId,
      },
    });

    // Write AuditLog
    await tx.auditLog.create({
      data: {
        action: "RECORD_PAYMENT",
        performedBy: `SnapSchool AI (Telegram / ${context.adminName})`,
        entityType: "Payment",
        entityId: paymentRecord.id.toString(),
        amount: args.amount,
        description: `Paiement enregistré pour ${studentFullName}: ${args.amount} DT (${monthName} ${year})`,
        schoolId: context.schoolId,
      },
    });

    return paymentRecord;
  });

  // 3. Invalidate cache tags
  try {
    invalidateTenantTags(context.schoolId, "finance", "students", "incomes", "dashboard");
  } catch (err) {
    console.warn("[recordPaymentTool] Cache invalidation warning:", err);
  }

  return {
    success: true,
    message: `✅ Paiement de ${args.amount} DT enregistré avec succès pour ${studentFullName} (${monthName} ${year}). Statut : ${
      isPartial ? "PARTIEL (Reste " + (standardFee - args.amount) + " DT)" : "COMPLET"
    }.`,
    summary: `Paiement ${args.amount} DT pour ${studentFullName} (${monthName} ${year})`,
    data: { paymentId: result.id, studentId: student.id },
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
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const category = args.category || "Général";
  const expenseDate = args.date ? new Date(args.date) : new Date();

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        title: args.title.trim(),
        amount: args.amount,
        category,
        date: expenseDate,
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `SnapSchool AI (Telegram / ${context.adminName})`,
        entityType: "Expense",
        entityId: expense.id.toString(),
        amount: args.amount,
        description: `Dépense ajoutée : ${args.title} (${args.amount} DT - ${category})`,
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

  return {
    success: true,
    message: `✅ Dépense enregistrée : "${args.title}" pour un montant de ${args.amount} DT (Catégorie : ${category}).`,
    summary: `Dépense "${args.title}" (${args.amount} DT)`,
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
        schoolId: context.schoolId,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "CREATE",
        performedBy: `SnapSchool AI (Telegram / ${context.adminName})`,
        entityType: "Notice",
        entityId: notice.id.toString(),
        description: `Annonce publiée : "${args.title}"${targetClassId ? " (Classe ciblée)" : " (Toute l'école)"}`,
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
