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
import { getSchoolId } from "@/lib/school";
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

  const schoolId = await getSchoolId();

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

  // 1. DATA FETCHING (CONSOLIDATED MEGA-QUERY FOR 90% LATENCY REDUCTION)
  console.log(`🚀 [DASHBOARD] Fetching for School: ${schoolId}`);

  const getMegaStats = async () => {
    try {
      const [
        student_count,
        teacher_count,
        staff_count,
        class_count,
        currentIncomes,
        currentExpenses,
        currentStudentPayments,
        currentPersonnelPayments,
        prevIncomes,
        prevExpenses,
        prevStudentPayments,
        prevPersonnelPayments
      ] = await Promise.all([
        prisma.student.count({ where: { schoolId } }),
        prisma.teacher.count({ where: { schoolId } }),
        prisma.staff.count({ where: { schoolId } }),
        prisma.class.count({ where: { schoolId } }),
        
        // Financials - Current
        prisma.income.aggregate({
          where: { schoolId, date: { gte: startDate, lt: endDate }, category: { not: 'Tuition' } },
          _sum: { amount: true }
        }),
        prisma.expense.aggregate({
          where: { schoolId, date: { gte: startDate, lt: endDate }, category: { not: 'Salary' } },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { schoolId, status: 'PAID', userType: 'STUDENT', paidAt: { gte: startDate, lt: endDate } },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { schoolId, status: 'PAID', userType: { in: ['TEACHER', 'STAFF'] }, paidAt: { gte: startDate, lt: endDate } },
          _sum: { amount: true }
        }),

        // Financials - Previous
        prisma.income.aggregate({
          where: { schoolId, date: { gte: prevStartDate, lt: prevEndDate }, category: { not: 'Tuition' } },
          _sum: { amount: true }
        }),
        prisma.expense.aggregate({
          where: { schoolId, date: { gte: prevStartDate, lt: prevEndDate }, category: { not: 'Salary' } },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { schoolId, status: 'PAID', userType: 'STUDENT', paidAt: { gte: prevStartDate, lt: prevEndDate } },
          _sum: { amount: true }
        }),
        prisma.payment.aggregate({
          where: { schoolId, status: 'PAID', userType: { in: ['TEACHER', 'STAFF'] }, paidAt: { gte: prevStartDate, lt: prevEndDate } },
          _sum: { amount: true }
        })
      ]);

      return {
        student_count,
        teacher_count,
        staff_count,
        class_count,
        current_income_general: currentIncomes._sum.amount || 0,
        current_expense_general: currentExpenses._sum.amount || 0,
        current_income_tuition: currentStudentPayments._sum.amount || 0,
        current_expense_salary: currentPersonnelPayments._sum.amount || 0,
        prev_income_general: prevIncomes._sum.amount || 0,
        prev_expense_general: prevExpenses._sum.amount || 0,
        prev_income_tuition: prevStudentPayments._sum.amount || 0,
        prev_expense_salary: prevPersonnelPayments._sum.amount || 0
      };
    } catch (error) {
      console.error("❌ [DASHBOARD_FETCH_ERROR]:", error);
      throw error; 
    }
  };

  const stats = await getMegaStats();

  // CORE CALCULATIONS
  const currentIncome = (stats.current_income_general || 0) + (stats.current_income_tuition || 0);
  const currentExpense = (stats.current_expense_general || 0) + (stats.current_expense_salary || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (stats.prev_income_general || 0) + (stats.prev_income_tuition || 0);
  const prevExpense = (stats.prev_expense_general || 0) + (stats.prev_expense_salary || 0);
  const prevBalance = prevIncome - prevExpense;

  // 3. ENRICH CONTEXT FOR AI ASSISTANT (CONSOLIDATED CORE ONLY)
  const dashboardContext = {
     financials: {
       income: currentIncome,
       expense: currentExpense,
       balance: currentBalance,
       prevBalance,
       month: MONTHS[startDate.getMonth()],
       year: startDate.getFullYear()
     }
     // Note: Detailed census and unpaid lists moved to lazy-load inside SnapAssistant
  };

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
          revenueGap={0}
          isCustomRange={!!(queryMonth && queryYear)}
        />

        <OperationsSnapshot 
            students={stats.student_count}
            teachers={stats.teacher_count}
            staff={stats.staff_count}
            classes={stats.class_count}
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

      <SnapAssistant context={dashboardContext} />
    </div>
  );
};

export default AdminPage;
