"use server";

import prisma from "@/lib/prisma";

export async function getDashboardExtraData(params: {
  startDate: Date;
  endDate: Date;
  twelveMonthsAgo: Date;
}) {
  const { startDate, endDate, twelveMonthsAgo } = params;
  const now = new Date();

  // This action handles the "heavy" non-vital queries for the dashboard
  // to allow the core KPIs to render instantly.
  
  const [
    recentPaidPayments, 
    recentGeneralExpenses, 
    recentGeneralIncomes, 
    schoolClasses, 
    recentAuditLogs, 
    allNotices, 
    histIncome, 
    histExpense,
  ] = await Promise.all([
    prisma.payment.findMany({ 
      take: 20, // Reduced from 500 for better performance
      orderBy: { paidAt: 'desc' }, 
      where: { status: 'PAID' }, 
      include: { 
        student: { select: { id: true, name: true, surname: true } }, 
        teacher: { select: { id: true, name: true, surname: true } }, 
        staff: { select: { id: true, name: true, surname: true } } 
      } 
    }),
    prisma.expense.findMany({ 
      take: 8, 
      orderBy: { date: 'desc' }, 
      select: { title: true, amount: true, date: true, category: true } 
    }),
    prisma.income.findMany({ 
      take: 8, 
      orderBy: { date: 'desc' }, 
      select: { title: true, amount: true, date: true, category: true } 
    }),
    prisma.class.findMany({ 
      select: { id: true, name: true, _count: { select: { students: true } } } 
    }),
    prisma.auditLog.findMany({ 
      take: 10, 
      orderBy: { timestamp: 'desc' }, 
      select: { action: true, description: true, performedBy: true, timestamp: true } 
    }),
    prisma.notice.findMany({ 
      take: 5, 
      orderBy: { date: 'desc' }, 
      select: { title: true, message: true, date: true } 
    }),
    prisma.income.groupBy({
      by: ['date'], _sum: { amount: true },
      where: { date: { gte: twelveMonthsAgo } }
    }),
    prisma.expense.groupBy({
      by: ['date'], _sum: { amount: true },
      where: { date: { gte: twelveMonthsAgo } }
    }),
  ]);

  return {
    recentPaidPayments,
    recentGeneralExpenses,
    recentGeneralIncomes,
    schoolClasses,
    recentAuditLogs,
    allNotices,
    histIncome,
    histExpense,
  };
}
