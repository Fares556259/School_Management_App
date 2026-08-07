"use server";

import React from 'react';
import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FiscalDistribution from "./FiscalDistribution";
import SmartFinancialInsights from "./SmartFinancialInsights";
import GrowthAnalyticsChart from "./GrowthAnalyticsChart";
import ActionCenter from "./ActionCenter";
import { translations, Locale } from "@/lib/translations";

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
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 5000))
    ]).catch((err) => {
      console.warn(`⏱️ [APPENDAGE_TIMEOUT] ${err.message === "TIMEOUT" ? "Query timed out" : "Query failed"}. Returning fallback.`);
      return fallback;
    });
  };

  // 1. MEGA-CONSOLIDATED TRENDS & BREAKDOWNS
  const getSecondaryStats = async () => {
    const results: any = await prisma.$queryRaw`
      SELECT
        -- Category breakdowns
        (SELECT json_agg(t) FROM (
          SELECT category, SUM(amount)::float as total 
          FROM "Income" 
          WHERE date >= ${startDate} AND date < ${endDate} AND category != 'Tuition' AND "schoolId" = ${schoolId}
          GROUP BY category
        ) t) as income_categories,
        
        (SELECT json_agg(t) FROM (
          SELECT category, SUM(amount)::float as total 
          FROM "Expense" 
          WHERE date >= ${startDate} AND date < ${endDate} AND category != 'Salary' AND "schoolId" = ${schoolId}
          GROUP BY category
        ) t) as expense_categories,

        -- 12 Month Trends
        (SELECT json_agg(t) FROM (
          SELECT date_trunc('month', date) as month, SUM(amount)::float as total
          FROM "Income"
          WHERE date >= ${twelveMonthsAgo} AND "schoolId" = ${schoolId}
          GROUP BY 1 ORDER BY 1
        ) t) as income_trend,

        (SELECT json_agg(t) FROM (
          SELECT date_trunc('month', date) as month, SUM(amount)::float as total
          FROM "Expense"
          WHERE date >= ${twelveMonthsAgo} AND "schoolId" = ${schoolId}
          GROUP BY 1 ORDER BY 1
        ) t) as expense_trend
    `;
    return results[0];
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
    safeFetch(getSecondaryStats(), {
      income_categories: [], expense_categories: [], income_trend: [], expense_trend: []
    }),
    safeFetch(prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: 'desc' }, select: { action: true, description: true, performedBy: true, timestamp: true } }), []),
    safeFetch(getUncollectedData(), { unpaidStudents: [], unpaidTeachers: [], unpaidStaff: [] }),
  ]);

    return { unpaidStudents, unpaidTeachers, unpaidStaff };
  };

  const uncollectedLists = await safeFetch(getUncollectedData(), { unpaidStudents: [], unpaidTeachers: [], unpaidStaff: [] });

  // --- DATA PROCESSING ---

  const unpaidFees = uncollectedLists.unpaidStudents.map(s => {
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

  const unpaidTeachersMapped = uncollectedLists.unpaidTeachers.map(t => {
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

  const unpaidStaffMapped = uncollectedLists.unpaidStaff.map(s => {
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
    const inc = (secondaryStats.income_trend || []).find((x: any) => new Date(x.month).getMonth() === d.getMonth() && new Date(x.month).getFullYear() === d.getFullYear())?.total || 0;
    const exp = (secondaryStats.expense_trend || []).find((x: any) => new Date(x.month).getMonth() === d.getMonth() && new Date(x.month).getFullYear() === d.getFullYear())?.total || 0;
    trendData.push({ month: monthName, income: inc, expense: exp });
  }

  const normalize = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n === 'salary' || n === 'salaries') return 'Salaries';
    if (n === 'fees' || n === 'tuition') return 'Tuition';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const incomeBreakdown = [
    { name: 'Tuition', value: currentIncome - (secondaryStats.income_categories || []).reduce((a: any, b: any) => a + (b.total || 0), 0), type: 'income' as const },
    ...(secondaryStats.income_categories || []).map((cat: any) => ({ name: normalize(cat.category), value: cat.total || 0, type: 'income' as const }))
  ];

  const expenseBreakdown = [
    { name: 'Salaries', value: currentExpense - (secondaryStats.expense_categories || []).reduce((a: any, b: any) => a + (b.total || 0), 0), type: 'expense' as const },
    ...(secondaryStats.expense_categories || []).map((cat: any) => ({ name: normalize(cat.category), value: cat.total || 0, type: 'expense' as const }))
  ];

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
        />
      </section>
    </>
  );
}
