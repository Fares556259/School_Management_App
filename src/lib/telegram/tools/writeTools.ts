import prisma from "@/lib/prisma";
import { MONTHS, formatMonthFrench } from "@/lib/dateUtils";
import { invalidateTenantTags } from "@/lib/cache";
import { createAnnouncementNotifications } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { resolveStudentByName, resolveParentByName } from "./entityResolvers";

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
  // 1. Locate the student
  const student = await resolveStudentByName(context.schoolId, args.studentNameOrId);
  if (!student) {
    return {
      success: false,
      message: `Aucun élève trouvé avec le nom "${args.studentNameOrId}". Veuillez vérifier l'orthographe.`,
      summary: `Élève non trouvé: ${args.studentNameOrId}`,
    };
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
  const cleanAmount = Math.abs(Number(args.amount) || 0);
  const expenseDate = args.date ? new Date(args.date) : new Date();

  const priorCategory = await prisma.expense.findFirst({
    where: {
      schoolId: context.schoolId,
      category: { equals: category, mode: "insensitive" },
    },
    select: { id: true },
  });
  const isExisting = Boolean(priorCategory);

  const result = await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        title: args.title.trim(),
        amount: cleanAmount,
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
        amount: cleanAmount,
        description: `[Hnia AI Telegram] Dépense ajoutée : ${args.title} (${cleanAmount} DT - ${category})`,
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
💰 Montant : <code>${cleanAmount} DT</code>
🏷️ Intitulé : <b>${args.title.trim()}</b>
📂 Catégorie : <code>${category}</code> ${isExisting ? "(Catégorie existante ✅)" : "(Nouvelle catégorie 🆕)"}
📅 Date : <code>${dateStr}</code>${imgStr}`,
    summary: `Dépense "${args.title}" (${cleanAmount} DT)`,
    data: { expenseId: result.id },
  };
}

export interface ParentChildAllocation {
  studentId: string;
  studentName: string;
  className: string;
  amount: number;
  totalDebt: number;
  remainingAfter: number;
  isFullyCleared: boolean;
}

/**
 * Calculates how a parent payment is divided between children with unpaid debts.
 */
export async function calculateParentPaymentDistribution(
  parentId: string,
  totalAmount: number,
  schoolId: string,
  targetMonth?: number,
  targetYear?: number,
  explicitDistribution?: Array<{ studentNameOrId: string; amount: number }>
): Promise<{
  allocations: ParentChildAllocation[];
  unallocatedAmount: number;
  totalDebtAcrossChildren: number;
} | null> {
  const parent = await prisma.parent.findFirst({
    where: { id: parentId, schoolId },
    include: {
      students: {
        include: { class: true, level: true },
      },
    },
  });

  if (!parent || !parent.students || parent.students.length === 0) return null;

  const now = new Date();
  const m = targetMonth || now.getMonth() + 1;
  const y = targetYear || now.getFullYear();

  // If explicit distribution is given by the user
  if (explicitDistribution && explicitDistribution.length > 0) {
    const allocations: ParentChildAllocation[] = [];
    let allocatedTotal = 0;
    for (const item of explicitDistribution) {
      const student = parent.students.find(
        (s) =>
          s.id === item.studentNameOrId ||
          s.name.toLowerCase().includes(item.studentNameOrId.toLowerCase()) ||
          s.surname.toLowerCase().includes(item.studentNameOrId.toLowerCase())
      );
      if (!student) continue;

      const testAlloc = await calculateStudentPaymentAllocation(student.id, 99999, schoolId, m, y);
      const studentDebt = testAlloc?.paymentsToProcess.reduce((sum, p) => sum + p.newMoneyCollected, 0) || 0;
      const amt = Number(item.amount) || 0;
      allocatedTotal += amt;

      allocations.push({
        studentId: student.id,
        studentName: `${student.name} ${student.surname}`,
        className: student.class?.name || "Sans classe",
        amount: amt,
        totalDebt: studentDebt,
        remainingAfter: Math.max(0, studentDebt - amt),
        isFullyCleared: amt >= studentDebt && studentDebt > 0,
      });
    }

    return {
      allocations,
      unallocatedAmount: Math.max(0, totalAmount - allocatedTotal),
      totalDebtAcrossChildren: allocations.reduce((s, a) => s + a.totalDebt, 0),
    };
  }

  // Automatic smart distribution:
  // 1. Calculate each child's outstanding debt
  const studentDebtList: Array<{
    student: any;
    debt: number;
  }> = [];

  let totalDebtAcrossChildren = 0;

  for (const s of parent.students) {
    const testAlloc = await calculateStudentPaymentAllocation(s.id, 99999, schoolId, m, y);
    const childDebt = testAlloc?.paymentsToProcess.reduce((sum, p) => sum + p.newMoneyCollected, 0) || 0;
    if (childDebt > 0) {
      studentDebtList.push({ student: s, debt: childDebt });
      totalDebtAcrossChildren += childDebt;
    }
  }

  // If no children have debts
  if (studentDebtList.length === 0) {
    return {
      allocations: [],
      unallocatedAmount: totalAmount,
      totalDebtAcrossChildren: 0,
    };
  }

  // Distribute totalAmount across unpaid children
  let moneyLeft = totalAmount;
  const allocations: ParentChildAllocation[] = [];

  for (const item of studentDebtList) {
    if (moneyLeft <= 0) break;
    const share = Math.min(item.debt, moneyLeft);
    moneyLeft -= share;

    allocations.push({
      studentId: item.student.id,
      studentName: `${item.student.name} ${item.student.surname}`,
      className: item.student.class?.name || "Sans classe",
      amount: share,
      totalDebt: item.debt,
      remainingAfter: Math.max(0, item.debt - share),
      isFullyCleared: share >= item.debt,
    });
  }

  // If excess money remains after settling all debts, allocate excess to last child
  if (moneyLeft > 0 && allocations.length > 0) {
    const last = allocations[allocations.length - 1];
    last.amount += moneyLeft;
    moneyLeft = 0;
  }

  return {
    allocations,
    unallocatedAmount: moneyLeft,
    totalDebtAcrossChildren,
  };
}

/**
 * Tool: record_parent_payment
 * Records a combined parent payment distributed across their children.
 */
export async function recordParentPaymentTool(
  args: {
    parentNameOrId: string;
    amount: number;
    month?: number;
    year?: number;
    distribution?: Array<{ studentNameOrId: string; amount: number }>;
  },
  context: ToolContext
): Promise<WriteToolResult> {
  const parent = await resolveParentByName(context.schoolId, args.parentNameOrId);
  if (!parent) {
    return {
      success: false,
      message: `Aucun parent trouvé avec le nom ou téléphone "${args.parentNameOrId}". Veuillez vérifier l'orthographe.`,
      summary: `Parent non trouvé: ${args.parentNameOrId}`,
    };
  }

  const now = new Date();
  const targetMonth = args.month || now.getMonth() + 1;
  const targetYear = args.year || now.getFullYear();

  const dist = await calculateParentPaymentDistribution(
    parent.id,
    args.amount,
    context.schoolId,
    targetMonth,
    targetYear,
    args.distribution
  );

  if (!dist || dist.allocations.length === 0) {
    return {
      success: false,
      message: `Tous les enfants de **${parent.name} ${parent.surname}** semblent déjà en règle sans impayé.`,
      summary: `Aucun impayé trouvé pour ce parent`,
    };
  }

  const processedStudents: string[] = [];

  await prisma.$transaction(
    async (tx) => {
      for (const alloc of dist.allocations) {
        if (alloc.amount <= 0) continue;

        const allocation = await calculateStudentPaymentAllocation(
          alloc.studentId,
          alloc.amount,
          context.schoolId,
          targetMonth,
          targetYear
        );

        if (!allocation || allocation.paymentsToProcess.length === 0) continue;

        const { paymentsToProcess } = allocation;
        const upsertedPayments: any[] = [];
        let totalNewMoneyCollected = 0;

        for (const pmt of paymentsToProcess) {
          totalNewMoneyCollected += pmt.newMoneyCollected;

          const p = await tx.payment.upsert({
            where: {
              studentId_month_year: {
                studentId: alloc.studentId,
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
              studentId: alloc.studentId,
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

          if (!pmt.isPartial && pmt.previousAmount > 0) {
            await tx.expense.deleteMany({
              where: {
                category: "Deferred Revenue Gap",
                title: { contains: `${alloc.studentName} (${pmt.monthYear})` },
                schoolId: context.schoolId,
              },
            });
          }
        }

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
              title: `Tuition: ${alloc.studentName} (${titleRef})`,
              amount: totalNewMoneyCollected,
              date: new Date(),
              category: bulkCategory,
              referenceType: "StudentPayment",
              referenceId: upsertedPayments[0].id.toString(),
              schoolId: context.schoolId,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            action: "RECORD_PAYMENT",
            performedBy: `Hnia AI (Telegram / ${context.adminName})`,
            entityType: "Payment",
            entityId: upsertedPayments[0]?.id.toString() || alloc.studentId,
            amount: totalNewMoneyCollected,
            description: `[Hnia AI Telegram] Règlement parental (${parent.name} ${parent.surname}) pour ${alloc.studentName}: ${alloc.amount} DT`,
            schoolId: context.schoolId,
          },
        });

        processedStudents.push(alloc.studentName);
      }
    },
    { timeout: 20000 }
  );

  invalidateTenantTags(context.schoolId, "finance", "students", "parents", "dashboard");

  const detailLines = dist.allocations.map((a) => {
    const badge = a.isFullyCleared ? "✅ SOLDÉ" : `⏳ Reliquat : ${a.remainingAfter} DT`;
    return `• <b>${a.studentName}</b> (<code>${a.className}</code>) : <code>+${a.amount} DT</code> (${badge})`;
  });

  return {
    success: true,
    message: `💳 <b>Règlement Parental Enregistré avec Succès</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Parent :</b> <b>${parent.name} ${parent.surname}</b>
💰 <b>Total encaissé :</b> <code>${args.amount} DT</code>

📋 <b>Ventilation appliquée :</b>
${detailLines.join("\n")}

<blockquote>💡 <b>Hnia :</b> Les scolarités ont été mises à jour et les reçus de caisse générés.</blockquote>`,
    summary: `Règlement parental ${parent.name} (${args.amount} DT pour ${processedStudents.join(", ")})`,
    data: { parentId: parent.id, amount: args.amount, allocations: dist.allocations },
  };
}

export { postAnnouncementTool } from "./announcementTools";

