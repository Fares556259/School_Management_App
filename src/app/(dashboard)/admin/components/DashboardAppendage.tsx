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

  const secondaryStats = await safeFetch(getSecondaryStats(), {
    income_categories: [], expense_categories: [], income_trend: [], expense_trend: []
  });

  // 2. RECENT ACTIVITY BATCH
  const [recentAuditLogs] = await Promise.all([
    safeFetch(prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: 'desc' }, select: { action: true, description: true, performedBy: true, timestamp: true } }), []),
  ]);

  // 3. UNCOLLECTED FEES RESTORATION (FIND STUDENTS WITH NO PAID PAYMENT)
  const getUncollectedData = async () => {
    // We want students who DON'T have a 'PAID' record for this month
    const unpaidStudents: any[] = await prisma.$queryRaw`
      SELECT 
        s.id, s.name, s.surname, p.phone as "parentPhone", l."tuitionFee",
        pay.status as "paymentStatus", pay.amount as "paymentAmount", pay."deferredAmount"
      FROM "Student" s
      JOIN "Level" l ON s."levelId" = l.id
      JOIN "Parent" p ON s."parentId" = p.id
      LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
        AND pay.month = ${currentMonth} 
        AND pay.year = ${currentYear}
      WHERE (pay.status IS NULL OR pay.status != 'PAID')
      LIMIT 100
    `;

    // Also get unpaid employees (TEACHER/STAFF)
    const unpaidEmp = await prisma.payment.findMany({
      where: { 
        status: { in: ["PENDING", "PARTIAL"] },
        userType: { in: ["TEACHER", "STAFF"] }
      },
      include: {
        teacher: { select: { id: true, name: true, surname: true, phone: true } },
        staff: { select: { id: true, name: true, surname: true, phone: true } },
      },
      take: 50
    });

    return { unpaidStudents, unpaidEmp };
  };

  const uncollectedLists = await safeFetch(getUncollectedData(), { unpaidStudents: [], unpaidEmp: [] });

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

  const unpaidEmployees = uncollectedLists.unpaidEmp.map(p => {
    const entity = p.teacher || p.staff;
    return {
      id: p.teacherId || p.staffId || "unknown",
      name: entity ? `${entity.name} ${entity.surname}` : "Unknown",
      amount: p.status === "PARTIAL" ? (p.deferredAmount || p.amount) : p.amount,
      type: (p.userType.toLowerCase() === 'teacher' ? 'teacher' : 'staff') as 'teacher' | 'staff',
    };
  });

  // Calculate trends
  const trendData = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = MONTHS[d.getMonth()];
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
          month={MONTHS[now.getMonth()]}
          dailyData={[]}
          unpaidCount={unpaidFees.length}
        />
      </section>

      <section className="border-t border-slate-100 pt-8 mt-8">
        <ActionCenter 
          unpaidFees={unpaidFees}
          unpaidEmployees={unpaidEmployees}
          monthLabel={`${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`}
        />
      </section>
    </>
  );
}
