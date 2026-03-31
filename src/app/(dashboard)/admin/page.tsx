import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FinanceChart from "@/components/FinanceChart";
import PaymentHeatmap from "./PaymentHeatmap";
import { calculateTrend } from "@/lib/trendUtils";

// New Components
import KpiStrip from "./components/KpiStrip";
import ActionCenter from "./components/ActionCenter";
import RecentTransactions from "./components/RecentTransactions";
import SmartInsights from "./components/SmartInsights";
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";
import FinanceFilters from "./components/FinanceFilters";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const { category, type, q } = searchParams || {};
  const { chartFilter } = searchParams || {};

  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Build where clauses for filtered transactions (Ledger view)
  const incomeWhere: any = {};
  const expenseWhere: any = {};
  if (q) {
    incomeWhere.title = { contains: q, mode: "insensitive" };
    expenseWhere.title = { contains: q, mode: "insensitive" };
  }
  if (category) {
    incomeWhere.category = category;
    expenseWhere.category = category;
  }

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
    studentPaymentsThisMonth,
    salaryPaymentsThisMonth,
    // Last Month Trends
    incomeLastMonth,
    expenseLastMonth,
    studentPaymentsLastMonth,
    salaryPaymentsLastMonth,
    // Transactions Feed
    recentIncomes,
    recentExpenses,
    recentPaidPayments,
    // Action Center (Unpaids)
    unpaidPayments,
    // Heatmap
    allPayments
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    // Current Period Aggregations
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayThisMonth } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayThisMonth } } }),
    // Student Payments (Income)
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: firstDayThisMonth } } 
    }),
    // Salary Payments (Expense)
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: firstDayThisMonth } } 
    }),
    // Last Month Trends
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    // Last Month Student Payments
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: firstDayLastMonth, lt: firstDayThisMonth } } 
    }),
    // Last Month Salary Payments
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: firstDayLastMonth, lt: firstDayThisMonth } } 
    }),
    // Transactions Feed
    // Transactions Ledger (Filtered)
    type !== "expense" 
      ? prisma.income.findMany({ where: incomeWhere, take: 10, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    type !== "income"
      ? prisma.expense.findMany({ where: expenseWhere, take: 10, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    prisma.payment.findMany({ 
      where: { status: "PAID" }, 
      take: 10, 
      orderBy: { paidAt: "desc" },
      include: { student: true, teacher: true, staff: true }
    }),
    // Action Center Fetching
    prisma.payment.findMany({
      where: { 
        status: "PENDING",
        month: now.getMonth(),
        year: now.getFullYear()
      },
      include: {
        student: { select: { id: true, name: true, surname: true, parent: { select: { phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, phone: true } },
        staff: { select: { id: true, name: true, surname: true, phone: true } },
      }
    }),
    // Heatmap data
    prisma.payment.findMany({ where: { status: "PAID" } })
  ]);

  // 2. AGGREGATES & CALCULATIONS
  const totalIncomeThisMonth = (incomeThisMonth._sum.amount || 0) + (studentPaymentsThisMonth._sum.amount || 0);
  const totalIncomeLastMonth = (incomeLastMonth._sum.amount || 0) + (studentPaymentsLastMonth._sum.amount || 0);
  const totalExpenseThisMonth = (expenseThisMonth._sum.amount || 0) + (salaryPaymentsThisMonth._sum.amount || 0);
  const totalExpenseLastMonth = (expenseLastMonth._sum.amount || 0) + (salaryPaymentsLastMonth._sum.amount || 0);

  // New Trend Logic
  const incomeTrend = calculateTrend(totalIncomeThisMonth, totalIncomeLastMonth);
  const expenseTrend = calculateTrend(totalExpenseThisMonth, totalExpenseLastMonth);
  const balanceTrend = calculateTrend(totalIncomeThisMonth - totalExpenseThisMonth, totalIncomeLastMonth - totalExpenseLastMonth);

  // Unpaid Processing
  const unpaidAmount = unpaidPayments.reduce((acc, p) => acc + p.amount, 0);
  const unpaidSet = new Set(unpaidPayments.map(p => p.studentId || p.teacherId || p.staffId));
  const unpaidCount = unpaidSet.size;

  const unpaidStudents = unpaidPayments.filter(p => p.userType === "STUDENT" && p.student).map(p => ({
    id: p.student!.id,
    name: `${p.student!.name} ${p.student!.surname}`,
    amount: p.amount,
    type: 'student' as const,
    phone: p.student!.parent?.phone || undefined
  }));

  const unpaidTeachers = unpaidPayments.filter(p => p.userType === "TEACHER" && p.teacher).map(p => ({
    id: p.teacher!.id,
    name: `${p.teacher!.name} ${p.teacher!.surname}`,
    amount: p.amount,
    type: 'teacher' as const,
    phone: p.teacher!.phone || undefined
  }));

  const unpaidStaff = unpaidPayments.filter(p => p.userType === "STAFF" && p.staff).map(p => ({
    id: p.staff!.id,
    name: `${p.staff!.name} ${p.staff!.surname}`,
    amount: p.amount,
    type: 'staff' as const,
    phone: p.staff!.phone || undefined
  }));

  // Unified Transaction Mapping (Ledger View)
  const transactions = [
    ...recentIncomes.map(i => ({ type: 'income' as const, title: i.title, amount: i.amount, date: i.date, source: i.category })),
    ...recentExpenses.map(e => ({ type: 'expense' as const, title: e.title, amount: e.amount, date: e.date, source: e.category })),
    ...recentPaidPayments.map(p => ({ 
      type: (p.userType === "STUDENT" ? 'income' : 'expense') as 'income' | 'expense', 
      title: `${p.userType === "STUDENT" ? 'Tuition Fee' : 'Salary Payout'}: ${p.student?.name || p.teacher?.name || p.staff?.name}`, 
      amount: p.amount, 
      date: p.paidAt!, 
      source: p.userType 
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 20);

  // Insights Logic (Real Data)
  const insights = [
    `Balance ${balanceTrend >= 0 ? 'increased' : 'decreased'} by ${Math.abs(balanceTrend).toFixed(1)}% vs last month.`,
    expenseTrend > 20 ? `⚠️ High Spending Alert: Expenses up by ${expenseTrend.toFixed(1)}%.` : "Spending velocity is stable.",
    unpaidCount > 0 ? `📌 ${unpaidCount} entities have pending payments ($${unpaidAmount.toLocaleString()}).` : "Zero pending payments this week."
  ];

  // Heatmap Mapping
  const heatmapMap: Record<string, { count: number; amount: number }> = {};
  allPayments.forEach((p) => {
    if (p.paidAt) {
      const dateStr = p.paidAt.toISOString().split("T")[0];
      if (!heatmapMap[dateStr]) heatmapMap[dateStr] = { count: 0, amount: 0 };
      heatmapMap[dateStr].count += 1;
      heatmapMap[dateStr].amount += p.amount;
    }
  });
  const heatmapData = Object.entries(heatmapMap).map(([date, val]) => ({
    date,
    count: val.count,
    amount: val.amount,
  }));

  return (
    <div className="p-6 flex flex-col gap-8 bg-[#F7F8FA] min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight italic">Command Center</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Real-time school financial & operational oversight</p>
        </div>
        <div className="flex items-center gap-3">
           <QuickActionBar />
        </div>
      </div>

      <FinanceFilters currentFilters={{ category, type, q }} data={transactions} />

      {/* 1. KPI STRIP */}
      <KpiStrip 
        totalBalance={totalIncomeThisMonth - totalExpenseThisMonth}
        thisMonthIncome={totalIncomeThisMonth}
        thisMonthExpense={totalExpenseThisMonth}
        unpaidAmount={unpaidAmount}
        unpaidCount={unpaidCount}
        balanceTrend={balanceTrend}
        incomeTrend={incomeTrend}
        expenseTrend={expenseTrend}
      />

      {/* 3 & 4. CHARTS & FEED */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN: CHARTS */}
        <div className="flex-1 flex flex-col gap-8">
           <div className="min-h-[450px] flex flex-col">
              <FinanceChart filter={searchParams?.chartFilter} />
           </div>
           <div className="min-h-[350px] flex flex-col">
              <PaymentHeatmap data={heatmapData} />
           </div>
        </div>

        {/* RIGHT COLUMN: TRANSACTIONS & INSIGHTS */}
        <div className="w-full lg:w-[450px] flex flex-col gap-8">
          <SmartInsights insights={insights} />
          <div className="flex-1 min-h-[600px]">
             <RecentTransactions transactions={transactions} />
          </div>
        </div>
      </div>

      {/* 4. OPERATIONS SNAPSHOT */}
      <section className="mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-800 tracking-tight">Operational Snapshot</h2>
        </div>
        <OperationsSnapshot 
          students={studentCount}
          teachers={teacherCount}
          staff={staffCount}
          classes={classCount}
        />
      </section>

      {/* 5. ACTION CENTER (RELOCATED TO BOTTOM) */}
      <section className="mt-8 border-t border-slate-100 pt-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl">🚨</span>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight italic uppercase">Critical Actions: Full Unpaid Ledger</h2>
        </div>
        <ActionCenter 
          unpaidStudents={unpaidStudents} 
          unpaidTeachers={unpaidTeachers} 
          unpaidStaff={unpaidStaff} 
        />
      </section>
    </div>
  );
};

export default AdminPage;
