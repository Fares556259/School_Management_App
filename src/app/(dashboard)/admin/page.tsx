import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import KpiStrip from "./components/KpiStrip";
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";
import FinancialKpiSection from "./components/FinancialKpiSection";
import MonthYearFilter from "./components/MonthYearFilter";
import SnapAssistant from "./components/SnapAssistant";
import PrintReportAction from "./components/PrintReportAction";
import DashboardAppendage from "./components/DashboardAppendage";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import React, { Suspense } from "react";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const cookieStore = cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "en";
  const t = translations[locale];

  const { 
    timeFilter = "thisMonth", 
    month: queryMonth, 
    year: queryYear 
  } = searchParams || {};

  const now = new Date();
  
  // DATE LOGIC
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (queryMonth && queryYear) {
    const m = parseInt(queryMonth);
    const y = parseInt(queryYear);
    startDate = new Date(y, m, 1);
    endDate = new Date(y, m + 1, 1);
    prevStartDate = new Date(y, m - 1, 1);
    prevEndDate = new Date(y, m, 1);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // 1. DATA FETCHING (CONSOLIDATED & PROGRESSIVE)
  console.log("🚀 [DASHBOARD] Rendering Progressive Admin Dashboard...");

  // BATCH 1 & 2 (CORE METRICS ONLY)
  const [
    studentCount, teacherCount, staffCount, classCount,
    incomeStats, expenseStats,
    incomePrevPeriod, expensePrevPeriod,
    studentPaymentsStats, salaryPaymentsStats,
    studentPaymentsPrevPeriod, salaryPaymentsPrevPeriod
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    prisma.income.aggregate({ 
      _sum: { amount: true }, 
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } } 
    }),
    prisma.expense.aggregate({ 
      _sum: { amount: true }, 
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } } 
    }),
    prisma.income.aggregate({ 
      _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: prevEndDate }, NOT: { category: "Tuition" } } 
    }),
    prisma.expense.aggregate({ 
      _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: prevEndDate }, NOT: { category: "Salary" } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: "STUDENT", paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: "STUDENT", paidAt: { gte: prevStartDate, lt: prevEndDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: prevStartDate, lt: prevEndDate } } 
    }),
  ]);

  // CORE CALCULATIONS
  const currentIncome = (incomeStats._sum.amount || 0) + (studentPaymentsStats._sum.amount || 0);
  const currentExpense = (expenseStats._sum.amount || 0) + (salaryPaymentsStats._sum.amount || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (incomePrevPeriod._sum.amount || 0) + (studentPaymentsPrevPeriod._sum.amount || 0);
  const prevExpense = (expensePrevPeriod._sum.amount || 0) + (salaryPaymentsPrevPeriod._sum.amount || 0);
  const prevBalance = prevIncome - prevExpense;

  return (
    <div className="p-6 flex flex-col gap-6 bg-[#F7F8FA] min-h-screen">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">{t.adminDashboard.commandCenter}</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">{t.adminDashboard.commandCenterDesc}</p>
        </div>
        <div className="flex items-center gap-4">
           <PrintReportAction month={`${MONTHS[startDate.getMonth()]} ${startDate.getFullYear()}`} />
           <div className="h-10 w-[1px] bg-slate-200 hidden md:block mx-2" />
           <MonthYearFilter activeMonth={queryMonth} activeYear={queryYear} />
           <QuickActionBar />
        </div>
      </div>

      {/* 2. UNIFIED COMMAND CENTER (PRIMARY KPIs) */}
      <div className="flex flex-col">
        <FinancialKpiSection 
          currentIncome={currentIncome}
          prevIncome={prevIncome}
          currentExpense={currentExpense}
          prevExpense={prevExpense}
          currentBalance={currentBalance}
          prevBalance={prevBalance}
          revenueGap={0} // Computed in appendage if needed
          isCustomRange={!!(queryMonth && queryYear)}
        />

        <OperationsSnapshot 
            students={studentCount}
            teachers={teacherCount}
            staff={staffCount}
            classes={classCount}
        />
      </div>

      {/* 3. PROGRESSIVE LOADING SECTION */}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardAppendage 
           startDate={startDate}
           endDate={endDate}
           twelveMonthsAgo={twelveMonthsAgo}
           locale={locale}
           currentIncome={currentIncome}
           currentExpense={currentExpense}
           prevIncome={prevIncome}
        />
      </Suspense>

      <SnapAssistant />
    </div>
  );
};

export default AdminPage;
