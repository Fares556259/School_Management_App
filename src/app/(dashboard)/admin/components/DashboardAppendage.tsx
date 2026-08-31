"use server";

import React from 'react';
import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FiscalDistribution from "./FiscalDistribution";
import SmartFinancialInsights from "./SmartFinancialInsights";
import GrowthAnalyticsChart from "./GrowthAnalyticsChart";
import ActionCenter from "./ActionCenter";
import { translations, Locale } from "@/lib/translations";
import { getCachedTenantData } from "@/lib/cache";

interface DashboardAppendageProps {
  startDate: Date;
  endDate: Date;
  twelveMonthsAgo: Date;
  locale: Locale;
  currentIncome: number;
  currentExpense: number;
  prevIncome: number;
  schoolId: string;
}

export default async function DashboardAppendage({
  startDate,
  endDate,
  twelveMonthsAgo,
  locale,
  currentIncome,
  currentExpense,
  prevIncome,
  schoolId
}: DashboardAppendageProps) {
  const t = translations[locale];
  const now = new Date();
  const currentMonth = startDate.getMonth() + 1;
  const currentYear = startDate.getFullYear();

  // HEAVY DATA FETCHING CONSOLIDATION (Phase 6 Restoration)
  const safeFetch = async <T extends unknown>(promise: Promise<T>, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000))
    ]).catch((err) => {
      console.warn(`⏱️ [APPENDAGE_TIMEOUT] ${err.message === "TIMEOUT" ? "Query timed out" : "Query failed"}. Returning fallback.`);
      return fallback;
    });
  };

  // 1. MEGA-CONSOLIDATED TRENDS & BREAKDOWNS
  const getSecondaryStats = async () => {
    const [incCats, expCats, allIncomes, allExpenses] = await Promise.all([
      prisma.income.groupBy({
        by: ['category'],
        _sum: { amount: true },
        where: { schoolId, date: { gte: startDate, lt: endDate } }
      }),
      prisma.expense.groupBy({
        by: ['category'],
        _sum: { amount: true },
        where: { schoolId, date: { gte: startDate, lt: endDate } }
      }),
      prisma.income.findMany({
        where: { schoolId, date: { gte: twelveMonthsAgo } },
        select: { date: true, amount: true }
      }),
      prisma.expense.findMany({
        where: { schoolId, date: { gte: twelveMonthsAgo } },
        select: { date: true, amount: true }
      })
    ]);

    // Grouping by YYYY-MM
    const incomeTrendMap: Record<string, number> = {};
    const expenseTrendMap: Record<string, number> = {};

    const addTrend = (map: Record<string, number>, d: Date | null, amount: number) => {
      if (!d) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + amount;
    };

    allIncomes.forEach(i => addTrend(incomeTrendMap, i.date, i.amount));
    allExpenses.forEach(e => addTrend(expenseTrendMap, e.date, e.amount));

    return {
      income_categories: incCats.map(c => ({ category: c.category, total: c._sum.amount || 0 })),
      expense_categories: expCats.map(c => ({ category: c.category, total: c._sum.amount || 0 })),
      income_trend: Object.entries(incomeTrendMap).map(([k, v]) => ({ monthKey: k, total: v })),
      expense_trend: Object.entries(expenseTrendMap).map(([k, v]) => ({ monthKey: k, total: v }))
    };
  };

  const getUncollectedData = async () => {
    const [unpaidStudents, unpaidTeachers, unpaidStaff] = await Promise.all([
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, p.phone as "parentPhone", l."tuitionFee",
          pay.status as "paymentStatus", pay.amount as "paymentAmount", pay."deferredAmount"
        FROM "Student" s
        JOIN "Level" l ON s."levelId" = l.id
        JOIN "Parent" p ON s."parentId" = p.id
        LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
          AND pay.month = ${currentMonth} 
          AND pay.year = ${currentYear}
        WHERE s."schoolId" = ${schoolId}
          AND (pay.status IS NULL OR pay.status != 'PAID')
        LIMIT 100
      `,
      prisma.$queryRaw`
        SELECT 
          t.id, t.name, t.surname, t.phone, t.salary,
          pay.status as "paymentStatus", pay.amount as "paymentAmount", pay."deferredAmount"
        FROM "Teacher" t
        LEFT JOIN "Payment" pay ON t.id = pay."teacherId" 
          AND pay.month = ${currentMonth} 
          AND pay.year = ${currentYear}
        WHERE t."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        LIMIT 100
      `,
      prisma.$queryRaw`
        SELECT 
          s.id, s.name, s.surname, s.phone, s.salary,
          pay.status as "paymentStatus", pay.amount as "paymentAmount", pay."deferredAmount"
        FROM "Staff" s
        LEFT JOIN "Payment" pay ON s.id = pay."staffId" 
          AND pay.month = ${currentMonth} 
          AND pay.year = ${currentYear}
        WHERE s."schoolId" = ${schoolId} 
          AND (pay.status IS NULL OR pay.status != 'PAID')
        LIMIT 100
      `
    ]) as [any[], any[], any[]];

    return { unpaidStudents, unpaidTeachers, unpaidStaff };
  };

  const [secondaryStats, recentAuditLogs, uncollectedData] = await Promise.all([
    getCachedTenantData(schoolId, 'dashboard', ['secondaryStats', currentMonth, currentYear], () => 
      safeFetch(getSecondaryStats(), {
        income_categories: [], expense_categories: [], income_trend: [], expense_trend: []
      }), 600
    ),
    getCachedTenantData(schoolId, 'dashboard', ['recentAuditLogs'], () => 
      safeFetch(prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: 'desc' }, select: { action: true, description: true, performedBy: true, timestamp: true } }), []),
      60
    ),
    getCachedTenantData(schoolId, 'dashboard', ['uncollectedData', currentMonth, currentYear], () => 
      safeFetch(getUncollectedData(), { unpaidStudents: [], unpaidTeachers: [], unpaidStaff: [] }),
      600
    ),
  ]);

  // --- DATA PROCESSING ---

  const unpaidFees = uncollectedData.unpaidStudents.map(s => {
    let dueAmount = s.tuitionFee || 450;
    if (s.paymentStatus === "PARTIAL") {
      dueAmount = s.deferredAmount || (dueAmount - s.paymentAmount);
    } else if (s.paymentStatus === "PENDING") {
      dueAmount = s.paymentAmount || dueAmount;
    }

    return {
      id: s.id,
      name: `${s.name} ${s.surname}`,
      amount: dueAmount,
      type: 'student' as const,
      phone: s.parentPhone
    };
  });

  const unpaidTeachersMapped = uncollectedData.unpaidTeachers.map(t => {
    let dueAmount = t.salary || 3000;
    if (t.paymentStatus === "PARTIAL") {
      dueAmount = t.deferredAmount || (dueAmount - t.paymentAmount);
    } else if (t.paymentStatus === "PENDING") {
      dueAmount = t.paymentAmount || dueAmount;
    }
    return {
      id: t.id,
      name: `${t.name} ${t.surname}`,
      amount: dueAmount,
      type: 'teacher' as const,
      phone: t.phone
    };
  });

  const unpaidStaffMapped = uncollectedData.unpaidStaff.map(s => {
    let dueAmount = s.salary || 1500;
    if (s.paymentStatus === "PARTIAL") {
      dueAmount = s.deferredAmount || (dueAmount - s.paymentAmount);
    } else if (s.paymentStatus === "PENDING") {
      dueAmount = s.paymentAmount || dueAmount;
    }
    return {
      id: s.id,
      name: `${s.name} ${s.surname}`,
      amount: dueAmount,
      type: 'staff' as const,
      phone: s.phone
    };
  });

  const unpaidEmployees = [...unpaidTeachersMapped, ...unpaidStaffMapped];

  // Calculate trends
  const trendData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = t.months[d.getMonth()];
    
    const findMatch = (arr: any[]) => arr.find((x: any) => {
      if (!x.monthKey) return false;
      const parts = x.monthKey.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // 0-indexed
      return month === d.getMonth() && year === d.getFullYear();
    });

    const inc = findMatch(secondaryStats.income_trend || [])?.total || 0;
    const exp = findMatch(secondaryStats.expense_trend || [])?.total || 0;
    trendData.push({ month: monthName, income: inc, expense: exp });
  }

  const normalize = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n === 'salary' || n === 'salaries') return 'Salaries';
    if (n === 'fees' || n === 'tuition') return 'Tuition';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const incomeBreakdown = (secondaryStats.income_categories || []).map((cat: any) => ({ name: normalize(cat.category), value: cat.total || 0, type: 'income' as const }));
  const expenseBreakdown = (secondaryStats.expense_categories || []).map((cat: any) => ({ name: normalize(cat.category), value: cat.total || 0, type: 'expense' as const }));

  const fullBreakdown = [...incomeBreakdown, ...expenseBreakdown];

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
          month={t.months[now.getMonth()]}
          dailyData={[]}
          unpaidCount={unpaidFees.length}
        />
      </section>

      <section className="border-t border-slate-100 pt-8 mt-8">
        <ActionCenter 
          unpaidFees={unpaidFees}
          unpaidEmployees={unpaidEmployees}
          monthLabel={`${t.months[startDate.getMonth()]} ${startDate.getFullYear()}`}
          englishMonthYear={`${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`}
        />
      </section>
    </>
  );
}
