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
import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
    fr: { title: 'Vue d’ensemble', attention: 'À traiter', unpaid: 'Scolarité restant à encaisser', parents: 'Demandes de parents à examiner', payroll: 'Rémunérations à vérifier' },
    en: { title: 'Overview', attention: 'Needs attention', unpaid: 'Tuition still due', parents: 'Parent requests to review', payroll: 'Payroll to review' },
    ar: { title: 'نظرة عامة', attention: 'المهام المعلقة', unpaid: 'معاليم الدراسة المتبقية', parents: 'طلبات الأولياء للمراجعة', payroll: 'الأجور للمراجعة' },
  }[locale];

  const { 
    start: queryStart,
    end: queryEnd,
    pendingMonth: queryPendingMonth,
    pendingYear: queryPendingYear,
  } = searchParams || {};

  const schoolId = await getSchoolId();

  const now = new Date();
  const parsedPendingMonth = Number(queryPendingMonth);
  const parsedPendingYear = Number(queryPendingYear);
  const pendingMonth = Number.isInteger(parsedPendingMonth) && parsedPendingMonth >= 1 && parsedPendingMonth <= 12
    ? parsedPendingMonth
    : now.getMonth() + 1;
  const pendingYear = Number.isInteger(parsedPendingYear) && parsedPendingYear >= 2020 && parsedPendingYear <= 2100
    ? parsedPendingYear
    : now.getFullYear();

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


  // Robust month & year extraction using midpoint to eliminate UTC midnight timezone shifts:
  const midDate = new Date((startDate.getTime() + endDate.getTime()) / 2);
  const targetMonth = isCustomRange ? midDate.getUTCMonth() + 1 : now.getMonth() + 1;
  const targetYear = isCustomRange ? midDate.getUTCFullYear() : now.getFullYear();

  // 1. DATA FETCHING (CONSOLIDATED MEGA-QUERY FOR 90% LATENCY REDUCTION)
  const getMegaStats = async () => {
    try {
      const rawRes = await prisma.$queryRaw`
        SELECT 
          (SELECT COUNT(*) FROM "Student" WHERE "schoolId" = ${schoolId})::int as student_count,
          (SELECT COUNT(*) FROM "Teacher" WHERE "schoolId" = ${schoolId})::int as teacher_count,
          (SELECT COUNT(*) FROM "Staff" WHERE "schoolId" = ${schoolId})::int as staff_count,
          (SELECT COUNT(*) FROM "Class" WHERE "schoolId" = ${schoolId})::int as class_count,
          (SELECT COUNT(*) FROM "ParentAccessRequest" WHERE "schoolId" = ${schoolId} AND status = 'PENDING')::int as parent_requests,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${startDate} AND date < ${endDate})::float as current_expense_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Income" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_income_general,
          (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "schoolId" = ${schoolId} AND date >= ${prevStartDate} AND date < ${prevEndDate})::float as prev_expense_general,
          
          -- Monthly student tuition metrics (for filtered month):
          (
            SELECT COALESCE(SUM(amount), 0) 
            FROM "Payment" 
            WHERE "schoolId" = ${schoolId} 
              AND LOWER("userType") = 'student' 
              AND (status = 'PAID' OR status = 'PARTIAL')
              AND month = ${targetMonth}
              AND year = ${targetYear}
          )::float as monthly_collected_tuition,
          (
            SELECT COALESCE(SUM(${studentTuitionSql(schoolId, targetMonth, targetYear)}), 0)
            FROM "Student" s 
            LEFT JOIN "Level" l ON s."levelId" = l.id 
            WHERE s."schoolId" = ${schoolId}
          )::float as monthly_expected_tuition,

          -- All-time student tuition metrics (for all-time overview):
          (
            SELECT COALESCE(SUM(amount), 0)
            FROM "Payment"
            WHERE "schoolId" = ${schoolId}
              AND LOWER("userType") = 'student'
              AND (status = 'PAID' OR status = 'PARTIAL')
          )::float as all_time_collected_tuition,
          (
            SELECT COALESCE(SUM(
              CASE 
                WHEN pay.status = 'PARTIAL' THEN GREATEST(0, ${studentTuitionSql(schoolId, now.getMonth() + 1, now.getFullYear())} - pay.amount)
                WHEN pay.status = 'PENDING' THEN ${studentTuitionSql(schoolId, now.getMonth() + 1, now.getFullYear())}
                ELSE ${studentTuitionSql(schoolId, now.getMonth() + 1, now.getFullYear())}
              END
            ), 0)
            FROM "Student" s
            LEFT JOIN "Level" l ON s."levelId" = l.id
            LEFT JOIN "Payment" pay ON s.id = pay."studentId" 
              AND pay.month = ${now.getMonth() + 1}
              AND pay.year = ${now.getFullYear()}
            WHERE s."schoolId" = ${schoolId}
              AND (pay.status IS NULL OR pay.status != 'PAID')
          )::float as current_unpaid_tuition
      `;

      const data = (rawRes as any)[0];

      let collectedTuition = 0;
      let expectedTuition = 0;

      if (isCustomRange) {
        // Specific period (e.g. September): show that month's exact collected vs expected
        collectedTuition = data.monthly_collected_tuition || 0;
        expectedTuition = (data.monthly_expected_tuition > 0)
          ? Math.max(data.monthly_expected_tuition, collectedTuition)
          : collectedTuition;
      } else {
        // All-Time mode: show all-time collected tuition vs all-time tuition due
        collectedTuition = data.all_time_collected_tuition || 0;
        expectedTuition = collectedTuition + (data.current_unpaid_tuition || 0);
      }

      return {
        student_count: data.student_count || 0,
        teacher_count: data.teacher_count || 0,
        staff_count: data.staff_count || 0,
        class_count: data.class_count || 0,
        parent_requests: data.parent_requests || 0,
        current_unpaid_tuition: data.current_unpaid_tuition || 0,
        current_income_general: data.current_income_general || 0,
        current_expense_general: data.current_expense_general || 0,
        prev_income_general: data.prev_income_general || 0,
        prev_expense_general: data.prev_expense_general || 0,
        collected_tuition: collectedTuition,
        expected_tuition: expectedTuition,
      };
    } catch (error) {
      console.error("❌ [DASHBOARD_FETCH_ERROR]:", error);
      throw error; 
    }
  };

  const cachedStats = await getCachedTenantData(
    schoolId,
    'dashboard',
    [startDate.toISOString(), endDate.toISOString(), isCustomRange ? `period-${targetMonth}-${targetYear}-v5` : 'all-time-v5'],
    () => getMegaStats(),
    120
  ).catch(() => null);

  const stats = cachedStats || (await getMegaStats().catch(() => ({
    student_count: 0,
    teacher_count: 0,
    staff_count: 0,
    class_count: 0,
    parent_requests: null,
    current_unpaid_tuition: null,
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
  const formatAmount = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
  const attention = [
    { label: copy.unpaid, href: { pathname: '/admin', query: { ...searchParams, pendingMonth: now.getMonth() + 1, pendingYear: now.getFullYear() }, hash: 'pending-finance' }, detail: stats.current_unpaid_tuition === null ? '—' : `${formatAmount.format(stats.current_unpaid_tuition)} TND`, period: monthLabel.format(now) },
    { label: copy.parents, href: '/admin/parent-requests', detail: stats.parent_requests === null ? '—' : formatAmount.format(stats.parent_requests) },
    { label: copy.payroll, href: '#pending-finance', detail: monthLabel.format(new Date(pendingYear, pendingMonth - 1, 1)) },
  ];

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
          revenueGap={0}
          isCustomRange={isCustomRange}
        />

        <section aria-labelledby="dashboard-attention" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <h2 id="dashboard-attention" className="px-4 py-3 text-sm font-semibold text-slate-900">{copy.attention}</h2>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {attention.map(item => (
              <li key={item.label}>
                <Link href={item.href} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm hover:bg-slate-50 focus-visible:bg-slate-100">
                  <span className="flex-1 font-medium text-slate-800">{item.label}{item.period ? <span className="block text-xs font-normal text-slate-500">{item.period}</span> : null}</span>
                  <span className="font-semibold tabular-nums text-slate-700">{item.detail}</span>
                  <ChevronRight size={16} aria-hidden="true" className="text-blue-700 rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        </section>

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
