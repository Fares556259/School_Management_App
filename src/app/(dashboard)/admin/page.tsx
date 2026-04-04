import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FinanceChart from "@/components/FinanceChart";
import { calculateTrend } from "@/lib/trendUtils";

// New Components
import KpiStrip from "./components/KpiStrip";
import ActionCenter from "./components/ActionCenter";
import FinancialQuickReport from "./components/FinancialQuickReport";
import NoticeBoard from "./components/NoticeBoard";
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";

// Redesign Components
import FinancialKpiSection from "./components/FinancialKpiSection";
import FiscalBarChart from "./components/FiscalBarChart";
import FinancialBreakdown from "./components/FinancialBreakdown";
import SmartFinancialInsights from "./components/SmartFinancialInsights";
import FiscalTimeFilter from "./components/FiscalTimeFilter";
import CashFlowTrend from "./components/CashFlowTrend";
import ActivityFeed from "./components/ActivityFeed";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const { chartFilter, timeFilter = "thisMonth" } = searchParams || {};

  const now = new Date();
  
  // Define Time Ranges
  let startDate: Date;
  let prevStartDate: Date;

  if (timeFilter === "lastMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  } else if (timeFilter === "last3Months") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  } else {
    // Default: thisMonth
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // 1. DATA FETCHING
  const [
    // Operational Counts
    studentCount,
    teacherCount,
    staffCount,
    classCount,
    // Current Period Aggregations
    incomeThisMonth,
    expenseThisMonth,
    incomeCategoriesThisMonth,
    expenseCategoriesThisMonth,
    studentPaymentsThisMonth,
    salaryPaymentsThisMonth,
    // Previous Period Trends
    incomeLastMonth,
    expenseLastMonth,
    studentPaymentsLastMonth,
    salaryPaymentsLastMonth,
    // Action Center (Unpaids)
    unpaidPayments,
    // Historical Trends (6 Months)
    histIncome,
    histExpense,
    histStudPayments,
    histSalPayments,
    // Recent Activity (Audit Logs)
    recentAuditLogs
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    // Current Period Aggregations
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate } } }),
    prisma.income.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate } }
    }),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate } }
    }),
    // Student Payments (Income)
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: startDate } } 
    }),
    // Salary Payments (Expense)
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: startDate } } 
    }),
    // Previous Period Trends
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: startDate } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: startDate } } }),
    // Previous Period Student Payments
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: prevStartDate, lt: startDate } } 
    }),
    // Previous Period Salary Payments
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: prevStartDate, lt: startDate } } 
    }),
    // Action Center Fetching
    prisma.payment.findMany({
      where: { 
        status: "PENDING",
        month: now.getMonth() + 1,
        year: now.getFullYear()
      },
      include: {
        student: { select: { id: true, name: true, surname: true, parent: { select: { phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, phone: true } },
        staff: { select: { id: true, name: true, surname: true, phone: true } },
      }
    }),
    // Historical Trends
    prisma.income.findMany({ where: { date: { gte: sixMonthsAgo } }, select: { date: true, amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: sixMonthsAgo } }, select: { date: true, amount: true } }),
    prisma.payment.findMany({ 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: sixMonthsAgo } }, 
      select: { paidAt: true, amount: true } 
    }),
    prisma.payment.findMany({ 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: sixMonthsAgo } }, 
      select: { paidAt: true, amount: true } 
    }),
    // Recent Audit Logs
    prisma.auditLog.findMany({
      take: 10,
      orderBy: { timestamp: "desc" }
    })
  ]);

  // 2. AGGREGATES & CALCULATIONS
  const currentIncome = (incomeThisMonth._sum.amount || 0) + (studentPaymentsThisMonth._sum.amount || 0);
  const currentExpense = (expenseThisMonth._sum.amount || 0) + (salaryPaymentsThisMonth._sum.amount || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (incomeLastMonth._sum.amount || 0) + (studentPaymentsLastMonth._sum.amount || 0);
  const prevExpense = (expenseLastMonth._sum.amount || 0) + (salaryPaymentsLastMonth._sum.amount || 0);
  const prevBalance = prevIncome - prevExpense;

  // Process Historical Data
  const trendData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = MONTHS[d.getMonth()];
    
    const monthlyIncome = histIncome.filter(x => x.date.getMonth() === d.getMonth() && x.date.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + curr.amount, 0) +
      histStudPayments.filter(x => x.paidAt!.getMonth() === d.getMonth() && x.paidAt!.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + curr.amount, 0);

    const monthlyExpense = histExpense.filter(x => x.date.getMonth() === d.getMonth() && x.date.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + curr.amount, 0) +
      histSalPayments.filter(x => x.paidAt!.getMonth() === d.getMonth() && x.paidAt!.getFullYear() === d.getFullYear())
      .reduce((acc, curr) => acc + curr.amount, 0);

    trendData.push({
      month: monthName,
      income: monthlyIncome,
      expense: monthlyExpense
    });
  }

  // Category Normalization (Merging Salary/Salaries etc)
  const normalize = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n === 'salary') return 'Salaries';
    if (n === 'salaries') return 'Salaries';
    if (n === 'fees') return 'Tuition';
    if (n === 'tuition') return 'Tuition';
    if (n === 'donation') return 'Donations';
    if (n === 'donations') return 'Donations';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase(); // Default capitalization
  };

  const incomeBreakdown = [
    { name: 'Tuition', value: studentPaymentsThisMonth._sum.amount || 0, type: 'income' as const },
    ...incomeCategoriesThisMonth.map(cat => ({
      name: normalize(cat.category),
      value: cat._sum.amount || 0,
      type: 'income' as const
    }))
  ].reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.name);
    if (existing) existing.value += curr.value;
    else acc.push(curr);
    return acc;
  }, [] as { name: string, value: number, type: 'income' | 'expense' }[]);

  const expenseBreakdown = [
    { name: 'Salaries', value: salaryPaymentsThisMonth._sum.amount || 0, type: 'expense' as const },
    ...expenseCategoriesThisMonth.map(cat => ({
      name: normalize(cat.category),
      value: cat._sum.amount || 0,
      type: 'expense' as const
    }))
  ].reduce((acc, curr) => {
    const existing = acc.find(x => x.name === curr.name);
    if (existing) existing.value += curr.value;
    else acc.push(curr);
    return acc;
  }, [] as { name: string, value: number, type: 'income' | 'expense' }[]);

  const fullBreakdown = [...incomeBreakdown, ...expenseBreakdown];

  // Unpaid Processing
  const unpaidAmount = unpaidPayments.reduce((acc, p) => acc + p.amount, 0);
  const unpaidCount = new Set(unpaidPayments.map(p => p.studentId || p.teacherId || p.staffId)).size;

  const unpaidFees = unpaidPayments.filter(p => p.userType === "STUDENT" && p.student).map(p => ({
    id: p.student!.id,
    name: `${p.student!.name} ${p.student!.surname}`,
    amount: p.amount,
    type: 'student' as const,
    phone: p.student!.parent?.phone || undefined
  }));

  const unpaidEmployees = unpaidPayments.filter(p => ["TEACHER", "STAFF"].includes(p.userType) && (p.teacher || p.staff)).map(p => {
    const entity = p.teacher || p.staff;
    return {
      id: entity!.id,
      name: `${entity!.name} ${entity!.surname}`,
      amount: p.amount,
      type: p.userType.toLowerCase() as 'teacher' | 'staff',
      phone: (p.teacher?.phone || p.staff?.phone) || undefined
    };
  });

  return (
    <div className="p-6 flex flex-col gap-8 bg-[#F7F8FA] min-h-screen dashboard-chrome">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight italic">Command Center</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Real-time school financial & operational oversight</p>
        </div>
        <div className="flex items-center gap-3">
           <QuickActionBar />
        </div>
      </div>

      {/* 1. KPI SECTION */}
      <FinancialKpiSection 
        currentIncome={currentIncome}
        prevIncome={prevIncome}
        currentExpense={currentExpense}
        prevExpense={prevExpense}
        currentBalance={currentBalance}
        prevBalance={prevBalance}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col min-h-[300px]">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Fiscal Overview</h2>
                <FiscalTimeFilter activeFilter={timeFilter} />
             </div>
             <FiscalBarChart 
                incomeData={incomeBreakdown}
                expenseData={expenseBreakdown}
             />
          </div>
          
          <CashFlowTrend data={trendData} />

          <FinancialBreakdown data={fullBreakdown} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <SmartFinancialInsights 
            income={currentIncome}
            expense={currentExpense}
            breakdown={fullBreakdown}
            prevIncome={prevIncome}
          />

          <FinancialQuickReport 
            income={currentIncome}
            expense={currentExpense}
            unpaid={unpaidAmount}
            month={MONTHS[now.getMonth()]}
          />

          <ActivityFeed logs={recentAuditLogs as any} />

          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
             <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4 uppercase opacity-50">Operational Snapshot</h2>
             <OperationsSnapshot 
                students={studentCount}
                teachers={teacherCount}
                staff={staffCount}
                classes={classCount}
             />
          </div>
        </div>
      </div>

      {/* 5. ACTION CENTER */}
      <section className="mt-8 border-t border-slate-200 pt-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">🚨</span>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Critical Actions: Unpaid Ledger</h1>
        </div>
        <ActionCenter 
          unpaidEmployees={unpaidEmployees} 
          unpaidFees={unpaidFees} 
          monthLabel={MONTHS[now.getMonth()]}
        />
      </section>
    </div>
  );
};

export default AdminPage;
