import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import KpiStrip from "./components/KpiStrip";
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";
import FinancialKpiSection from "./components/FinancialKpiSection";
import DateRangeFilter from "./components/DateRangeFilter";
import SnapAssistant from "./components/SnapAssistant";
import PrintReportAction from "./components/PrintReportAction";
import DashboardAppendage from "./components/DashboardAppendage";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import React, { Suspense } from "react";

// No force-dynamic — we rely on getCachedTenantData (write-through cache).
// Every mutation (incomes, expenses, salaries, students) calls invalidateTenantTags('dashboard')
// which instantly busts the cache so data is always fresh after any change.


const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const cookieStore = cookies();
  const locale = (cookieStore.get("NEXT_LOCALE")?.value as Locale) || "en";
  const t = translations[locale];

  const { 
    start: queryStart,
    end: queryEnd,
  } = searchParams || {};

  const schoolId = await getSchoolId();

  const now = new Date();
  
  // DATE LOGIC
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (queryStart && queryEnd) {
    startDate = new Date(queryStart);
    endDate = new Date(queryEnd);
    
    const duration = endDate.getTime() - startDate.getTime();
    prevEndDate = new Date(startDate.getTime());
    prevStartDate = new Date(startDate.getTime() - duration);
  } else {
    // Show data of ALL TIME when no date filter is applied
    // We start from a reasonable historical date (e.g. 2023) up to the end of the current year.
    startDate = new Date(2023, 0, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59); // End of current month
    
    const duration = endDate.getTime() - startDate.getTime();
    prevEndDate = new Date(startDate.getTime());
    prevStartDate = new Date(startDate.getTime() - duration);
  }

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // 1. DATA FETCHING (CONSOLIDATED MEGA-QUERY FOR 90% LATENCY REDUCTION)
  const getMegaStats = async () => {
    try {
      const rawRes = await prisma.$queryRaw`
        SELECT 
          (SELECT COUNT(*) FROM "Student" WHERE "schoolId" = ${schoolId})::int as student_count,
          (SELECT COUNT(*) FROM "Teacher" WHERE "schoolId" = ${schoolId})::int as teacher_count,
          (SELECT COUNT(*) FROM "Staff" WHERE "schoolId" = ${schoolId})::int as staff_count,
          (SELECT COUNT(*) FROM "Class" WHERE "schoolId" = ${schoolId})::int as class_count,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_expense_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_expense_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Payment" WHERE "schoolId" = ${schoolId} AND LOWER("userType") = 'student' AND (status = 'PAID' OR status = 'PARTIAL'))::float as collected_tuition,
          (SELECT COALESCE(SUM(amount + COALESCE("deferredAmount", 0)), 0) FROM "Payment" WHERE "schoolId" = ${schoolId} AND LOWER("userType") = 'student')::float as billed_tuition,
          (SELECT COALESCE(SUM(COALESCE(s."customTuition", l."tuitionFee", 0)), 0) FROM "Student" s LEFT JOIN "Level" l ON s."levelId" = l.id WHERE s."schoolId" = ${schoolId})::float as expected_monthly_tuition,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN pay.status = 'PARTIAL' THEN COALESCE(pay."deferredAmount", GREATEST(0, COALESCE(s."customTuition", l."tuitionFee", 450) - pay.amount))
                WHEN pay.status = 'PENDING' THEN COALESCE(pay.amount, COALESCE(s."customTuition", l."tuitionFee", 450))
                ELSE COALESCE(s."customTuition", l."tuitionFee", 450)
              END
            ), 0)
            FROM "Student" s
            LEFT JOIN "Level" l ON s."levelId" = l.id
            LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
              AND pay.month = ${now.getMonth() + 1}
              AND pay.year = ${now.getFullYear()}
            WHERE s."schoolId" = ${schoolId}
              AND (pay.status IS NULL OR pay.status != 'PAID')
          )::float as uncollected_tuition
      `;

      const data = (rawRes as any)[0];
      return {
        student_count: data.student_count || 0,
        teacher_count: data.teacher_count || 0,
        staff_count: data.staff_count || 0,
        class_count: data.class_count || 0,
        current_income_general: data.current_income_general || 0,
        current_expense_general: data.current_expense_general || 0,
        prev_income_general: data.prev_income_general || 0,
        prev_expense_general: data.prev_expense_general || 0,
        collected_tuition: data.collected_tuition || 0,
        billed_tuition: data.billed_tuition || 0,
        expected_monthly_tuition: data.expected_monthly_tuition || 0,
        uncollected_tuition: data.uncollected_tuition || 0,
      };
    } catch (error) {
      console.error("❌ [DASHBOARD_FETCH_ERROR]:", error);
      throw error; 
    }
  };

  const stats = await getCachedTenantData(
    schoolId,
    'dashboard',
    [startDate.toISOString(), endDate.toISOString(), 'v2'],
    () => getMegaStats(),
    120
  );

  // CORE CALCULATIONS
  const currentIncome = (stats.current_income_general || 0);
  const currentExpense = (stats.current_expense_general || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (stats.prev_income_general || 0);
  const prevExpense = (stats.prev_expense_general || 0);
  const prevBalance = prevIncome - prevExpense;

  // 3. ENRICH CONTEXT FOR AI ASSISTANT (CONSOLIDATED CORE ONLY)
  const dashboardContext = {
     financials: {
       income: currentIncome,
       expense: currentExpense,
       balance: currentBalance,
       prevBalance,
       month: t.months[startDate.getMonth()],
       year: startDate.getFullYear()
     }
     // Note: Detailed census and unpaid lists moved to lazy-load inside SnapAssistant
  };

  return (
    <div className="p-6 md:p-8 flex flex-col gap-8 bg-[#ffffff] min-h-screen">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">{t.adminDashboard.commandCenter}</h1>
          <p className="text-[#333840] text-[14px] font-normal max-w-[600px] leading-[1.25] mt-2">{t.adminDashboard.commandCenterDesc}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
           <PrintReportAction month={`${t.months[startDate.getMonth()]} ${startDate.getFullYear()}`} />
           <div className="h-10 w-[1px] bg-slate-200 hidden md:block mx-2" />
           <DateRangeFilter activeStartDate={queryStart} activeEndDate={queryEnd} />
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
          collectedTuition={stats.collected_tuition}
          totalTuitionDue={stats.billed_tuition > 0 ? stats.billed_tuition : stats.expected_monthly_tuition}
          uncollectedTuition={stats.uncollected_tuition}
          revenueGap={0}
          isCustomRange={!!(queryStart && queryEnd)}
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
           schoolId={schoolId}
        />
      </Suspense>

      <SnapAssistant context={dashboardContext} />
    </div>
  );
};

export default AdminPage;
