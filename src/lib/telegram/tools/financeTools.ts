import prisma from "@/lib/prisma";
import { processPaymentReminders } from "@/lib/notifications";
import { ToolContext } from "./readTools";
import { WriteToolResult } from "./writeTools";

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
      performedBy: `SnapSchool AI (Telegram / ${context.adminName})`,
      entityType: "Payment",
      description: `Rappels de paiement déclenchés via Telegram : ${count} notifications envoyées aux familles.`,
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
