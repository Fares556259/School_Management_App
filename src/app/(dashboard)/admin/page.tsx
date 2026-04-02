import prisma from "@/lib/prisma";
import { MONTHS } from "@/lib/dateUtils";
import FinanceChart from "@/components/FinanceChart";
import { calculateTrend } from "@/lib/trendUtils";

// New Components
import KpiStrip from "./components/KpiStrip";
import ActionCenter from "./components/ActionCenter";
import RecentTransactions from "./components/RecentTransactions";
import SmartInsights from "./components/SmartInsights";
import OperationsSnapshot from "./components/OperationsSnapshot";
import QuickActionBar from "./components/QuickActionBar";
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
  
  if (q && q.trim() !== "") {
    incomeWhere.title = { contains: q, mode: "insensitive" };
    expenseWhere.title = { contains: q, mode: "insensitive" };
  }
  
  if (category && category.trim() !== "") {
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
    // Transactions Feed (from Audit Logs)
    recentFinancialLogs,
    // Action Center (Unpaids)
    unpaidPayments
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
    // Transactions Feed (Unified Audit Log)
    prisma.auditLog.findMany({
      where: {
        action: { in: ["RECEIVE_TUITION", "PAY_SALARY", "GENERAL_INCOME", "GENERAL_EXPENSE"] },
        ...(q ? { description: { contains: q, mode: "insensitive" } } : {})
      },
      take: 30,
      orderBy: { timestamp: "desc" }
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
    })
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

  // Grouped Unpaid Processing
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

  // 3. MAP AUDIT LOGS TO TRANSACTIONS
  const actionTitles: Record<string, string> = {
    RECEIVE_TUITION: "Tuition Collection",
    PAY_SALARY: "Salary Payout",
    GENERAL_INCOME: "Other Income",
    GENERAL_EXPENSE: "School Expense"
  };

  const transactions = recentFinancialLogs.map(log => ({
    type: (log.type === 'income' ? 'income' : 'expense') as 'income' | 'expense',
    title: actionTitles[log.action] || log.action,
    amount: log.amount || 0,
    date: log.timestamp, // Audit log timestamp (when admin did it)
    effectiveDate: log.effectiveDate || log.timestamp, // Transaction date
    source: log.entityType
  }));

  // Smart insights logic is now handled dynamically by the SmartInsights Client Component
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN: PRIMARY DATA */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white p-2 rounded-[32px] border border-slate-100 shadow-sm flex flex-col min-h-[450px]">
             <div className="px-6 pt-4">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Financial Performance</h2>
             </div>
             <FinanceChart filter={searchParams?.chartFilter} />
          </div>
          
          <div className="flex flex-col min-h-[600px]">
             <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800 tracking-tight">Recent Activity Ledger</h2>
             </div>
             <RecentTransactions transactions={transactions} />
          </div>
        </div>

        {/* RIGHT COLUMN: SECONDARY DATA & UTILITIES */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <div className="flex-1 flex flex-col min-h-[400px]">
            <SmartInsights 
              payload={{
                totalBalance: totalIncomeThisMonth - totalExpenseThisMonth,
                thisMonthIncome: totalIncomeThisMonth,
                thisMonthExpense: totalExpenseThisMonth,
                unpaidAmount,
                unpaidCount
              }} 
            />
          </div>

          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
             <h2 className="text-sm font-bold text-slate-800 tracking-tight mb-4 uppercase opacity-50">School Snapshot</h2>
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
          monthLabel={currentMonthKey}
        />
      </section>
    </div>
  );
};

export default AdminPage;
