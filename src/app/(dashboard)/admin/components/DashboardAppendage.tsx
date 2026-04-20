"use server";

import React, { Suspense } from 'react';
import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FiscalDistribution from "./FiscalDistribution";
import SmartFinancialInsights from "./SmartFinancialInsights";
import GrowthAnalyticsChart from "./GrowthAnalyticsChart";
import FiscalBarChart from "./FiscalBarChart";
import FinancialBreakdown from "./FinancialBreakdown";
import { translations, Locale } from "@/lib/translations";

interface DashboardAppendageProps {
  startDate: Date;
  endDate: Date;
  twelveMonthsAgo: Date;
  locale: Locale;
  currentIncome: number;
  currentExpense: number;
  prevIncome: number;
}

export default async function DashboardAppendage({
  startDate,
  endDate,
  twelveMonthsAgo,
  locale,
  currentIncome,
  currentExpense,
  prevIncome
}: DashboardAppendageProps) {
  const t = translations[locale];
  const now = new Date();

  // BATCH 6: Visual Context & History (Offloaded to Suspense boundary)
  const [
    recentPaidPayments, 
    recentGeneralExpenses, 
    recentGeneralIncomes, 
    recentAuditLogs, 
    allNotices, 
    histIncome, 
    histExpense,
    incomeCategoriesThisPeriod,
    expenseCategoriesThisPeriod,
    studentPaymentsStats,
    salaryPaymentsStats
  ] = await Promise.all([
    prisma.payment.findMany({ 
      take: 20, // Reduced from 500 for massive stabilization
      orderBy: { paidAt: 'desc' }, 
      where: { status: 'PAID' }, 
      include: { student: { select: { id: true, name: true, surname: true } }, teacher: { select: { id: true, name: true, surname: true } }, staff: { select: { id: true, name: true, surname: true } } } 
    }),
    prisma.expense.findMany({ take: 8, orderBy: { date: 'desc' }, select: { title: true, amount: true, date: true, category: true } }),
    prisma.income.findMany({ take: 8, orderBy: { date: 'desc' }, select: { title: true, amount: true, date: true, category: true } }),
    prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: 'desc' }, select: { action: true, description: true, performedBy: true, timestamp: true } }),
    prisma.notice.findMany({ take: 5, orderBy: { date: 'desc' }, select: { title: true, message: true, date: true } }),
    prisma.income.groupBy({
      by: ['date'], _sum: { amount: true },
      where: { date: { gte: twelveMonthsAgo } }
    }),
    prisma.expense.groupBy({
      by: ['date'], _sum: { amount: true },
      where: { date: { gte: twelveMonthsAgo } }
    }),
    // Re-fetching specific categories for the breakdown to avoid passing massive objects
    prisma.income.groupBy({
      by: ['category'], _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } }
    }),
    prisma.expense.groupBy({
      by: ['category'], _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } }
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: "STUDENT", paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.findMany({
      where: { status: "PENDING" }, 
      include: {
        student: { select: { id: true, name: true, surname: true, parent: { select: { phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, phone: true } },
        staff: { select: { id: true, name: true, surname: true, phone: true } },
      },
      take: 100 // Reduced from 500 for massive stabilization
    }),
    prisma.student.findMany({ 
      select: { 
        id: true, name: true, surname: true, 
        parent: { select: { phone: true } },
        level: { select: { tuitionFee: true } }
      } 
    }),
    prisma.payment.findMany({
      where: { month: startDate.getMonth() + 1, year: startDate.getFullYear(), userType: "STUDENT" },
      select: { studentId: true, status: true, amount: true }
    })
  ]);

  // UNPAID PROCESSING
  const studentsWithPaidStatus = new Set(
    currentMonthStudentPayments
      .filter(p => p.status === "PAID" || p.status === "PARTIAL")
      .map(p => p.studentId)
  );

  const pendingStudentPaymentsMap = new Map(
    currentMonthStudentPayments
      .filter(p => p.status === "PENDING")
      .map(p => [p.studentId, p.amount])
  );

  const unpaidFees = allStudents
    .filter(s => !studentsWithPaidStatus.has(s.id))
    .map(s => ({
      name: `${s.name} ${s.surname}`,
      studentId: s.id,
      amount: pendingStudentPaymentsMap.get(s.id) || (s.level?.tuitionFee ?? 450), 
      month: startDate.getMonth() + 1,
      year: startDate.getFullYear(),
      type: "STUDENT",
      status: "Pending"
    }));

  const unpaidEmployees = unpaidPayments.filter(p => ["TEACHER", "STAFF"].includes(p.userType)).map(p => {
    const entity = p.teacher || p.staff;
    return {
      name: entity ? `${entity.name} ${entity.surname}` : "Unknown",
      staffId: p.staffId,
      teacherId: p.teacherId,
      amount: p.amount,
      month: p.month,
      year: p.year,
      type: p.userType,
      status: "Pending"
    };
  });

  const fullUncollected = [...unpaidFees, ...unpaidEmployees];

  // Calculations extracted from AdminPage
  const trendData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = MONTHS[d.getMonth()];
    const monthlyIncome = histIncome
      .filter(x => x.date.getMonth() === d.getMonth() && x.date.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + (curr._sum.amount || 0), 0);
    const monthlyExpense = histExpense
      .filter(x => x.date.getMonth() === d.getMonth() && x.date.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + (curr._sum.amount || 0), 0);
    trendData.push({ month: monthName, income: monthlyIncome, expense: monthlyExpense });
  }

  const normalize = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n === 'salary' || n === 'salaries') return 'Salaries';
    if (n === 'fees' || n === 'tuition') return 'Tuition';
    if (n === 'donation' || n === 'donations') return 'Donations';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const incomeBreakdown = [
    { name: 'Tuition', value: studentPaymentsStats._sum.amount || 0, type: 'income' as const },
    ...incomeCategoriesThisPeriod.map(cat => ({ name: normalize(cat.category), value: cat._sum.amount || 0, type: 'income' as const }))
  ].reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.name);
    if (existing) existing.value += curr.value; else acc.push(curr);
    return acc;
  }, [] as any[]);

  const expenseBreakdown = [
    { name: 'Salaries', value: salaryPaymentsStats._sum.amount || 0, type: 'expense' as const },
    ...expenseCategoriesThisPeriod.map(cat => ({ name: normalize(cat.category), value: cat._sum.amount || 0, type: 'expense' as const }))
  ].reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.name);
    if (existing) existing.value += curr.value; else acc.push(curr);
    return acc;
  }, [] as any[]);

  const fullBreakdown = [...incomeBreakdown, ...expenseBreakdown];

  const dailyMap: Record<string, { income: number; expense: number }> = {};
  histIncome.forEach(x => {
    const day = x.date.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].income += (x._sum.amount || 0);
  });
  histExpense.forEach(x => {
    const day = x.date.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].expense += (x._sum.amount || 0);
  });

  const dailyInsightsData = Object.entries(dailyMap).map(([date, vals]) => ({
    date,
    ...vals
  })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <section className="mt-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-[480px] flex flex-col overflow-hidden">
           <div className="flex items-center justify-between mb-8 flex-shrink-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-none">{t.adminDashboard.growthAnalytics}</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">{t.adminDashboard.growthAnalyticsDesc}</p>
              </div>
           </div>
           <div className="flex-1 min-h-0 relative">
             <GrowthAnalyticsChart data={trendData} />
           </div>
        </div>
      </section>

      <section className="mt-8">
        <FiscalDistribution 
          incomeData={incomeBreakdown}
          expenseData={expenseBreakdown}
          fullBreakdown={fullBreakdown}
          timeFilter="thisMonth" 
        />
      </section>

      <section className="mt-8">
        <SmartFinancialInsights 
          income={currentIncome}
          expense={currentExpense}
          breakdown={fullBreakdown}
          prevIncome={prevIncome}
          month={MONTHS[startDate.getMonth()]}
          dailyData={dailyInsightsData.slice(-14)}
        />
      </section>

      {/* 6. ACTION CENTER (UNPAID LEDGER) */}
      <section className="border-t border-slate-100 pt-8 mt-8">
        <ActionCenter 
          uncollected={fullUncollected}
          studentCensus={allStudents.map(s => ({ id: s.id, name: `${s.name} ${s.surname}` }))}
        />
      </section>

      {/* 7. NOTICE BOARD */}
      <section className="mt-8">
        <NoticeBoard notices={allNotices} />
      </section>
    </>
  );
}
