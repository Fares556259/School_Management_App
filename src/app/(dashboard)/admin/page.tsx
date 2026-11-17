import prisma from "@/lib/prisma";
import { studentTuitionSql } from '@/lib/serverTuition';
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";
import FinancialKpiSection from "./components/FinancialKpiSection";
import DateRangeFilter from "./components/DateRangeFilter";
import DashboardAppendage from "./components/DashboardAppendage";
import DashboardSkeleton from "./components/DashboardSkeleton";
import { cookies } from "next/headers";
import type { Locale } from "@/lib/translations";
import { schoolDate } from "@/lib/agent/dataAccuracy";
import { getSchoolId } from "@/lib/school";
import { getCachedTenantData } from "@/lib/cache";
import React, { Suspense } from "react";

// No force-dynamic — we rely on getCachedTenantData (write-through cache).
// Every mutation (incomes, expenses, salaries, students) calls invalidateTenantTags('dashboard')
// which instantly busts the cache so data is always fresh after any change.


const AdminPage = async (
  props: {
    searchParams?: Promise<{ [key: string]: string | undefined }>;
  }
) => {
  const searchParams = await props.searchParams;
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("NEXT_LOCALE")?.value || "en";
  const locale = (["en", "fr", "ar"].includes(rawLocale) ? rawLocale : "en") as Locale;
  const copy = {
    fr: { title: 'Vue d’ensemble' },
    en: { title: 'Overview' },
    ar: { title: 'نظرة عامة' },
  }[locale];

  const { 
    start: queryStart,
    end: queryEnd,
    pendingMonth: queryPendingMonth,
    pendingYear: queryPendingYear,
  } = searchParams || {};

  const schoolId = await getSchoolId();

  const now = new Date();
  const [targetYear, targetMonth] = schoolDate(now).split("-").map(Number);
  const parsedPendingMonth = Number(queryPendingMonth);
  const parsedPendingYear = Number(queryPendingYear);
  const pendingMonth = Number.isInteger(parsedPendingMonth) && parsedPendingMonth >= 1 && parsedPendingMonth <= 12
    ? parsedPendingMonth
    : targetMonth;
  const pendingYear = Number.isInteger(parsedPendingYear) && parsedPendingYear >= 2020 && parsedPendingYear <= 2100
    ? parsedPendingYear
    : targetYear;

  // DATE LOGIC
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  const isCustomRange = Boolean(queryStart && queryEnd &&
    Number.isFinite(Date.parse(queryStart)) && Number.isFinite(Date.parse(queryEnd)) &&
    Date.parse(queryStart) < Date.parse(queryEnd));

  if (isCustomRange && queryStart && queryEnd) {
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
        WITH monthly_tuition AS (
          SELECT
            GREATEST(0, ${studentTuitionSql(schoolId, targetMonth, targetYear)}) AS due,
            CASE WHEN pay.status IN ('PAID', 'PARTIAL')
              THEN GREATEST(0, COALESCE(pay.amount, 0)) ELSE 0 END AS paid
          FROM "Student" s
          LEFT JOIN "Level" l ON l.id = s."levelId" AND l."schoolId" = s."schoolId"
          LEFT JOIN "Payment" pay ON pay."studentId" = s.id
            AND pay."schoolId" = s."schoolId" AND LOWER(pay."userType") = 'student'
            AND pay.month = ${targetMonth} AND pay.year = ${targetYear}
          WHERE s."schoolId" = ${schoolId}
        )
        SELECT 
          (SELECT COUNT(*) FROM "Student" WHERE "schoolId" = ${schoolId})::int as student_count,
          (SELECT COUNT(*) FROM "Teacher" WHERE "schoolId" = ${schoolId})::int as teacher_count,
          (SELECT COUNT(*) FROM "Staff" WHERE "schoolId" = ${schoolId})::int as staff_count,
          (SELECT COUNT(*) FROM "Class" WHERE "schoolId" = ${schoolId})::int as class_count,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_expense_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_expense_general,
          
          (SELECT COALESCE(SUM(LEAST(due, paid)), 0) FROM monthly_tuition)::float AS monthly_collected_tuition,
          (SELECT COALESCE(SUM(due), 0) FROM monthly_tuition)::float AS monthly_expected_tuition
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
        collected_tuition: data.monthly_collected_tuition || 0,
        expected_tuition: data.monthly_expected_tuition || 0,
      };
    } catch (error) {
      console.error("❌ [DASHBOARD_FETCH_ERROR]:", error);
      throw error; 
    }
  };

  const cachedStats = await getCachedTenantData(
    schoolId,
    'dashboard',
    [startDate.toISOString(), endDate.toISOString(), `monthly-tuition-${targetYear}-${targetMonth}-v1`],
    () => getMegaStats(),
    120
  ).catch(() => null);

  const stats = cachedStats || (await getMegaStats().catch(() => ({
    student_count: 0,
    teacher_count: 0,
    staff_count: 0,
    class_count: 0,
    current_income_general: 0,
    current_expense_general: 0,
    prev_income_general: 0,
    prev_expense_general: 0,
    collected_tuition: 0,
    expected_tuition: 0,
  })));

  // CORE CALCULATIONS
  const currentIncome = (stats.current_income_general || 0);
  const currentExpense = (stats.current_expense_general || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (stats.prev_income_general || 0);
  const prevExpense = (stats.prev_expense_general || 0);
  const prevBalance = prevIncome - prevExpense;
  const recoveryPeriod = new Date(Date.UTC(targetYear, targetMonth - 1, 1)).toISOString();

  return (
    <div className="flex min-h-screen flex-col gap-6 rounded-2xl bg-slate-50/60 p-4 md:p-7">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{copy.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
           <DateRangeFilter activeStartDate={isCustomRange ? queryStart : undefined} activeEndDate={isCustomRange ? queryEnd : undefined} />
           <QuickActionBar />
        </div>
      </div>

      {/* 2. UNIFIED COMMAND CENTER (PRIMARY KPIs) */}
      <div className="flex flex-col gap-5">
        <FinancialKpiSection 
          currentIncome={currentIncome}
          prevIncome={prevIncome}
          currentExpense={currentExpense}
          prevExpense={prevExpense}
          currentBalance={currentBalance}
          prevBalance={prevBalance}
          collectedTuition={stats.collected_tuition}
          totalTuitionDue={stats.expected_tuition}
          recoveryPeriod={recoveryPeriod}
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
           pendingMonth={pendingMonth}
           pendingYear={pendingYear}
        />
      </Suspense>
    </div>
  );
};

export default AdminPage;
