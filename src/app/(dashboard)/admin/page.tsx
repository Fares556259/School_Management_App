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

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const now = new Date();
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // 1. DATA FETCHING
  const [
    // Operational Counts
    studentCount,
    teacherCount,
    staffCount,
    classCount,
    // Financial Metrics (This Month)
    incomeThisMonth,
    expenseThisMonth,
    paymentsThisMonth,
    // Trends (Last Month Comparisons)
    incomeLastMonth,
    expenseLastMonth,
    paymentsLastMonth,
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
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", paidAt: { gte: firstDayThisMonth } } }),
    // Last Month Trends
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { status: "PAID", paidAt: { gte: firstDayLastMonth, lt: firstDayThisMonth } } }),
    // Transactions Feed
    prisma.income.findMany({ take: 5, orderBy: { date: "desc" } }),
    prisma.expense.findMany({ take: 5, orderBy: { date: "desc" } }),
    prisma.payment.findMany({ 
      where: { status: "PAID" }, 
      take: 5, 
      orderBy: { paidAt: "desc" },
      include: { student: true, teacher: true, staff: true }
    }),
    // Action Center Fetching
    prisma.payment.findMany({
      where: { status: "PENDING" },
      include: {
        student: { select: { id: true, name: true, surname: true, parent: { select: { phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, salary: true } },
        staff: { select: { id: true, name: true, surname: true, salary: true } },
      }
    }),
    // Heatmap data
    prisma.payment.findMany({ where: { status: "PAID" } })
  ]);

  // 2. AGGREGATES & CALCULATIONS
  const totalIncomeThisMonth = (incomeThisMonth._sum.amount || 0) + (paymentsThisMonth._sum.amount || 0);
  const totalIncomeLastMonth = (incomeLastMonth._sum.amount || 0) + (paymentsLastMonth._sum.amount || 0);
  const totalExpenseThisMonth = (expenseThisMonth._sum.amount || 0);
  const totalExpenseLastMonth = (expenseLastMonth._sum.amount || 0);

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
  }));

  const unpaidStaff = unpaidPayments.filter(p => p.userType === "STAFF" && p.staff).map(p => ({
    id: p.staff!.id,
    name: `${p.staff!.name} ${p.staff!.surname}`,
    amount: p.amount,
    type: 'staff' as const,
  }));

  // Unified Transaction Mapping
  const transactions = [
    ...recentIncomes.map(i => ({ type: 'income' as const, title: i.title, amount: i.amount, date: i.date, source: i.category })),
    ...recentExpenses.map(e => ({ type: 'expense' as const, title: e.title, amount: e.amount, date: e.date, source: e.category })),
    ...recentPaidPayments.map(p => ({ 
      type: 'income' as const, 
      title: `Payment: ${p.student?.name || p.teacher?.name || p.staff?.name}`, 
      amount: p.amount, 
      date: p.paidAt!, 
      source: p.userType 
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 10);

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
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Command Center</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Real-time school financial & operational oversight</p>
        </div>
        <QuickActionBar />
      </div>

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

      {/* 2. ACTION CENTER */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🚨</span>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Critical Actions</h2>
        </div>
        <ActionCenter 
          unpaidStudents={unpaidStudents} 
          unpaidTeachers={unpaidTeachers} 
          unpaidStaff={unpaidStaff} 
        />
      </section>

      {/* 3 & 4. CHARTS & FEED */}
      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT COLUMN: CHARTS */}
        <div className="flex-1 flex flex-col gap-8">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-slate-800">Financial Performance</h3>
            </div>
            <div className="h-[400px]">
              <FinanceChart filter={searchParams?.chartFilter} />
            </div>
          </div>
          <div className="h-[300px]">
             <PaymentHeatmap data={heatmapData} />
          </div>
        </div>

        {/* RIGHT COLUMN: TRANSACTIONS & INSIGHTS */}
        <div className="w-full lg:w-[400px] flex flex-col gap-8">
          <SmartInsights insights={insights} />
          <div className="flex-1 min-h-[500px]">
             <RecentTransactions transactions={transactions} />
          </div>
        </div>
      </div>

      {/* 5. OPERATIONS SNAPSHOT */}
      <section className="mt-4">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Operational Snapshot</h2>
        </div>
        <OperationsSnapshot 
          students={studentCount}
          teachers={teacherCount}
          staff={staffCount}
          classes={classCount}
        />
      </section>
    </div>
  );
};

export default AdminPage;
