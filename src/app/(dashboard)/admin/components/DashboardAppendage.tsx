"use server";

import React from 'react';
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
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
    const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    const isAllTime = durationDays > 365 || startDate.getFullYear() <= 2024;
    const useDays = durationDays <= 60 && !isAllTime;
    const formatStr = useDays ? 'YYYY-MM-DD' : 'YYYY-MM';

    const trendStartDate = isAllTime ? new Date(now.getFullYear(), 0, 1) : startDate;
    const trendEndDate = isAllTime ? new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999) : endDate;

    const [incCats, expCats, rawIncomes, rawExpenses] = await Promise.all([
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
      prisma.$queryRaw`
        SELECT to_char(date, ${Prisma.raw(`'${formatStr}'`)}) as "monthKey", SUM(amount) as total
        FROM "Income"
        WHERE "schoolId" = ${schoolId} AND date >= ${trendStartDate} AND date <= ${trendEndDate}
        GROUP BY 1
      `,
      prisma.$queryRaw`
        SELECT to_char(date, ${Prisma.raw(`'${formatStr}'`)}) as "monthKey", SUM(amount) as total
        FROM "Expense"
        WHERE "schoolId" = ${schoolId} AND date >= ${trendStartDate} AND date <= ${trendEndDate}
        GROUP BY 1
      `
    ]);

    const incomeTrendMap: Record<string, number> = {};
    const expenseTrendMap: Record<string, number> = {};

    (rawIncomes as any[]).forEach(i => {
      incomeTrendMap[i.monthkey || i.monthKey] = Number(i.total);
    });
    (rawExpenses as any[]).forEach(e => {
      expenseTrendMap[e.monthkey || e.monthKey] = Number(e.total);
    });

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
    getCachedTenantData(schoolId, 'dashboard', ['secondaryStats', startDate.toISOString(), endDate.toISOString()], () => 
      safeFetch(getSecondaryStats(), {
        income_categories: [], expense_categories: [], income_trend: [], expense_trend: []
      }), 600
    ),
    getCachedTenantData(schoolId, 'dashboard', ['recentAuditLogs'], () => 
      safeFetch(prisma.auditLog.findMany({ take: 10, orderBy: { timestamp: 'desc' }, select: { action: true, description: true, performedBy: true, timestamp: true } }), []),
      60
    ),
    getCachedTenantData(schoolId, 'dashboard', ['uncollectedData', startDate.toISOString(), endDate.toISOString()], () => 
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
  const durationDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const isAllTime = durationDays > 365 || startDate.getFullYear() <= 2024;
  const useDays = durationDays <= 60 && !isAllTime;

  const shortMonths = locale === 'fr' 
    ? ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]
    : locale === 'en'
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان", "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  if (isAllTime) {
    const currentYear = now.getFullYear();
    for (let m = 0; m < 12; m++) {
      const monthNum = m + 1;
      const monthKey = `${currentYear}-${String(monthNum).padStart(2, '0')}`;
      const label = `${shortMonths[m]} ${currentYear}`;
      
      const inc = (secondaryStats.income_trend || []).find((x: any) => x.monthKey === monthKey)?.total || 0;
      const exp = (secondaryStats.expense_trend || []).find((x: any) => x.monthKey === monthKey)?.total || 0;
      trendData.push({ month: label, income: inc, expense: exp });
    }
  } else if (useDays) {
    // Generate daily points
    for (let d = new Date(startDate); d < endDate; d.setDate(d.getDate() + 1)) {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const date = d.getDate();
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      const label = `${date} ${shortMonths[d.getMonth()]}`;
      
      const inc = (secondaryStats.income_trend || []).find((x: any) => x.monthKey === dateKey)?.total || 0;
      const exp = (secondaryStats.expense_trend || []).find((x: any) => x.monthKey === dateKey)?.total || 0;
      trendData.push({ month: label, income: inc, expense: exp });
    }
  } else {
    // Generate monthly points
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
    if (endDate.getDate() > 1) {
      endMonth.setMonth(endMonth.getMonth() + 1);
    }
    
    while (current < endMonth) {
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const monthKey = `${year}-${String(month).padStart(2, '0')}`;
      const label = `${shortMonths[current.getMonth()]} ${year}`;
      
      const inc = (secondaryStats.income_trend || []).find((x: any) => x.monthKey === monthKey)?.total || 0;
      const exp = (secondaryStats.expense_trend || []).find((x: any) => x.monthKey === monthKey)?.total || 0;
      trendData.push({ month: label, income: inc, expense: exp });
      
      current.setMonth(current.getMonth() + 1);
    }
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
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
          <GrowthAnalyticsChart 
            data={trendData} 
            currentIncome={currentIncome} 
            currentExpense={currentExpense} 
            is12Months={isAllTime}
          />
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
