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
import GrowthAnalyticsChart from "./components/GrowthAnalyticsChart";
import MonthYearFilter from "./components/MonthYearFilter"; // We will create this
import SnapAssistant from "./components/SnapAssistant";
// import { checkModels } from "./actions/aiActions";

export const dynamic = "force-dynamic";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const { 
    timeFilter = "thisMonth", 
    month: queryMonth, 
    year: queryYear 
  } = searchParams || {};

  const now = new Date();
  
  // 0. DATE LOGIC REFINEMENT
  let startDate: Date;
  let endDate: Date;
  let prevStartDate: Date;
  let prevEndDate: Date;

  if (queryMonth && queryYear) {
    // Specific Month/Year selected
    const m = parseInt(queryMonth);
    const y = parseInt(queryYear);
    startDate = new Date(y, m, 1);
    endDate = new Date(y, m + 1, 1);
    
    // Comparison period is the PREVIOUS month
    prevStartDate = new Date(y, m - 1, 1);
    prevEndDate = new Date(y, m, 1);
  } else if (timeFilter === "lastMonth") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  } else if (timeFilter === "last3Months") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Up to end of this month
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 6, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else {
    // Default: thisMonth
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    prevEndDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // 1. DATA FETCHING (Using dynamic date ranges)
  const [
    studentCount,
    teacherCount,
    staffCount,
    classCount,
    // Current Period Aggregations
    incomeThisPeriod,
    expenseThisPeriod,
    incomeCategoriesThisPeriod,
    expenseCategoriesThisPeriod,
    studentPaymentsThisPeriod,
    salaryPaymentsThisPeriod,
    // Previous Period Trends
    incomePrevPeriod,
    expensePrevPeriod,
    studentPaymentsPrevPeriod,
    salaryPaymentsPrevPeriod,
    // Action Center (Unpaids)
    unpaidPayments,
    // Historical Trends (6 Months) - Static for context
    histIncome,
    histExpense,
    histStudPayments,
    histSalPayments,
    // AI ENRICHMENT DATA
    recentPaidPayments,
    recentGeneralExpenses,
    recentGeneralIncomes,
    schoolClasses,
    yearPaymentStatus,
    yearIncomeByCategory,
    yearExpenseByCategory,
    recentAuditLogs,
    allTeachers,
    allStaffMemberData,
    allPaymentsThisYear,
    allStudents,
    // TOTAL INTELLIGENCE (NEW)
    allGrades,
    allNotices,
    allLessons,
    allSubjects,
    teacherTimetables,
    maleStudents,
    femaleStudents
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.staff.count(),
    prisma.class.count(),
    // Current Period Aggregations
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } } }),
    prisma.income.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } }
    }),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } }
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: startDate, lt: endDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: startDate, lt: endDate } } 
    }),
    // Previous Period Trends
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: prevEndDate }, NOT: { category: "Tuition" } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: prevStartDate, lt: prevEndDate }, NOT: { category: "Salary" } } }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: prevStartDate, lt: prevEndDate } } 
    }),
    prisma.payment.aggregate({ 
      _sum: { amount: true }, 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: prevStartDate, lt: prevEndDate } } 
    }),
    // Action Center Fetching (Always current logical context)
    prisma.payment.findMany({
      where: { 
        status: "PENDING",
        month: startDate.getMonth() + 1,
        year: startDate.getFullYear()
      },
      include: {
        student: { select: { id: true, name: true, surname: true, parent: { select: { phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, phone: true } },
        staff: { select: { id: true, name: true, surname: true, phone: true } },
      }
    }),
    // Historical Trends (12 Months)
    prisma.income.findMany({ where: { date: { gte: twelveMonthsAgo }, NOT: { category: "Tuition" } }, select: { date: true, amount: true } }),
    prisma.expense.findMany({ where: { date: { gte: twelveMonthsAgo }, NOT: { category: "Salary" } }, select: { date: true, amount: true } }),
    prisma.payment.findMany({ 
      where: { status: "PAID", userType: "STUDENT", paidAt: { gte: twelveMonthsAgo } }, 
      select: { paidAt: true, amount: true } 
    }),
    prisma.payment.findMany({ 
      where: { status: "PAID", userType: { in: ["TEACHER", "STAFF"] }, paidAt: { gte: twelveMonthsAgo } }, 
      select: { paidAt: true, amount: true } 
    }),
    // AI ENRICHMENT DATA FETCH
    prisma.payment.findMany({ 
      take: 15, 
      orderBy: { paidAt: 'desc' }, 
      where: { status: 'PAID' }, 
      include: { 
        student: { select: { name: true, surname: true } }, 
        teacher: { select: { name: true, surname: true } }, 
        staff: { select: { name: true, surname: true } } 
      } 
    }),
    prisma.expense.findMany({ take: 15, orderBy: { date: 'desc' }, select: { title: true, amount: true, date: true, category: true } }),
    prisma.income.findMany({ take: 15, orderBy: { date: 'desc' }, select: { title: true, amount: true, date: true, category: true } }),
    prisma.class.findMany({ select: { id: true, name: true, _count: { select: { students: true } } } }),
    // FULL YEAR FINANCIAL INTELLIGENCE
    prisma.payment.groupBy({
      by: ['month', 'status', 'userType'],
      _sum: { amount: true },
      _count: { _all: true },
      where: { year: now.getFullYear() }
    }),
    prisma.income.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: new Date(now.getFullYear(), 0, 1) } }
    }),
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: new Date(now.getFullYear(), 0, 1) } }
    }),
    prisma.auditLog.findMany({ take: 20, orderBy: { timestamp: 'desc' } }),
    // FULL PERSONNEL STATUS
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true } }),
    prisma.staff.findMany({ select: { id: true, name: true, surname: true } }),
    prisma.payment.findMany({ 
      where: { 
        year: now.getFullYear(),
        userType: { in: ["TEACHER", "STAFF"] }
      },
      select: { month: true, status: true, userType: true, teacherId: true, staffId: true }
    }),
    // FULL STUDENT LEDGER FOR AI
    prisma.student.findMany({
      select: {
        id: true,
        name: true,
        surname: true,
        payments: {
          where: { year: now.getFullYear() },
          select: { status: true, month: true }
        },
        parent: {
          select: { name: true, surname: true, phone: true }
        }
      }
    }),
    // TOTAL INTELLIGENCE FETCH
    prisma.grade.findMany({
      select: { score: true, student: { select: { classId: true } }, subjectId: true }
    }),
    prisma.notice.findMany({ take: 10, orderBy: { date: 'desc' } }),
    prisma.lesson.findMany({
      select: { classId: true, teacherId: true, subjectId: true, day: true }
    }),
    prisma.subject.findMany({ select: { id: true, name: true } }),
    prisma.timetableSlot.findMany({
      select: { teacherId: true, classId: true, day: true, slotNumber: true }
    }),
    prisma.student.count({ where: { sex: "MALE" } }),
    prisma.student.count({ where: { sex: "FEMALE" } })
  ]);

  // Map Personnel Payments for AI
  const personnelMap = [...allTeachers, ...allStaffMemberData].map(p => {
    const history = allPaymentsThisYear.filter(pay => pay.teacherId === p.id || pay.staffId === p.id);
    return {
      name: `${p.name} ${p.surname}`,
      id: p.id,
      paid: history.filter(h => h.status === 'PAID').map(h => MONTHS[h.month - 1]),
      pending: history.filter(h => h.status === 'PENDING').map(h => MONTHS[h.month - 1])
    };
  });

  // Map Student Ledger for AI (Compressed)
  const studentLedger = allStudents.map(s => ({
    n: `${s.name} ${s.surname}`,
    pn: `${s.parent.name} ${s.parent.surname}`,
    ph: s.parent.phone,
    paid: s.payments.filter(p => p.status === 'PAID').map(p => MONTHS[p.month - 1]),
    pend: s.payments.filter(p => p.status === 'PENDING').map(p => MONTHS[p.month - 1])
  }));

  // Map Academic Intelligence
  const classAverages = schoolClasses.map(c => {
    const classGrades = allGrades.filter(g => g.student.classId === c.id);
    const avg = classGrades.length ? classGrades.reduce((acc, curr) => acc + curr.score, 0) / classGrades.length : 0;
    
    // Breakdown by subject
    const subjectAvgs = allSubjects.map(sub => {
      const subGrades = classGrades.filter(g => g.subjectId === sub.id);
      return {
        subject: sub.name,
        avg: subGrades.length ? subGrades.reduce((acc, curr) => acc + curr.score, 0) / subGrades.length : 0
      };
    }).filter(s => s.avg > 0);

    return { className: c.name, average: avg.toFixed(1), subjects: subjectAvgs };
  });

  // Map Operational Intelligence (Workload)
  const teacherWorkload = allTeachers.map(t => ({
    name: `${t.name} ${t.surname}`,
    lessons: allLessons.filter(l => l.teacherId === t.id).length,
    slots: teacherTimetables.filter(slot => slot.teacherId === t.id).length
  }));

  // 2. AGGREGATES & CALCULATIONS
  const currentIncome = (incomeThisPeriod._sum.amount || 0) + (studentPaymentsThisPeriod._sum.amount || 0);
  const currentExpense = (expenseThisPeriod._sum.amount || 0) + (salaryPaymentsThisPeriod._sum.amount || 0);
  const currentBalance = currentIncome - currentExpense;

  const prevIncome = (incomePrevPeriod._sum.amount || 0) + (studentPaymentsPrevPeriod._sum.amount || 0);
  const prevExpense = (expensePrevPeriod._sum.amount || 0) + (salaryPaymentsPrevPeriod._sum.amount || 0);
  const prevBalance = prevIncome - prevExpense;

  // Process Historical Data (Last 12 Months)
  const trendData = [];
  for (let i = 11; i >= 0; i--) {
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

  // Category Normalization
  const normalize = (name: string) => {
    const n = name.trim().toLowerCase();
    if (n === 'salary') return 'Salaries';
    if (n === 'salaries') return 'Salaries';
    if (n === 'fees') return 'Tuition';
    if (n === 'tuition') return 'Tuition';
    if (n === 'donation') return 'Donations';
    if (n === 'donations') return 'Donations';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };

  const incomeBreakdown = [
    { name: 'Tuition', value: studentPaymentsThisPeriod._sum.amount || 0, type: 'income' as const },
    ...incomeCategoriesThisPeriod.map(cat => ({
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
    { name: 'Salaries', value: salaryPaymentsThisPeriod._sum.amount || 0, type: 'expense' as const },
    ...expenseCategoriesThisPeriod.map(cat => ({
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

  const dashboardContext = {
    month: MONTHS[startDate.getMonth()],
    year: startDate.getFullYear(),
    metrics: {
      income: currentIncome,
      expense: currentExpense,
      balance: currentBalance,
      unpaid: unpaidAmount
    },
    census: {
      students: studentCount,
      teachers: teacherCount,
      staff: staffCount,
      classes: classCount,
      classDetails: schoolClasses.map(c => ({ name: c.name, students: c._count.students }))
    },
    topExpenses: expenseBreakdown.slice(0, 5),
    financials: {
      currentPeriod: {
        income: currentIncome,
        expense: currentExpense,
        categories: fullBreakdown
      },
      yearlyAggregates: {
        incomeByCategory: yearIncomeByCategory,
        expenseByCategory: yearExpenseByCategory,
        paymentStatusByMonth: yearPaymentStatus
      },
      recentActivity: {
        payments: recentPaidPayments.map(p => ({
          amount: p.amount,
          date: p.paidAt,
          type: p.userType,
          name: p.student ? `${p.student.name} ${p.student.surname}` : (p.teacher || p.staff)?.name
        })),
        auditTrail: recentAuditLogs.map(log => ({
          action: log.action,
          desc: log.description,
          user: log.performedBy,
          time: log.timestamp
        }))
      },
      personnelPaymentStatus: personnelMap,
      studentLedger: studentLedger,
      unpaidSummary: unpaidFees.slice(0, 10),
      // NEW TREND INTELLIGENCE
      historicalTrends: trendData,
      // NEW INTELLIGENCE LAYERS
      academics: {
        classAverages: classAverages,
        overallAvg: allGrades.length ? (allGrades.reduce((acc, curr) => acc + curr.score, 0) / allGrades.length).toFixed(1) : 0
      },
      operations: {
        teacherWorkloads: teacherWorkload,
        totalLessons: allLessons.length,
        notices: allNotices.map(n => ({ title: n.title, message: n.message, date: n.date }))
      },
      demographics: {
        male: maleStudents,
        female: femaleStudents,
        total: studentCount
      }
    }
  };

  // Process Daily Data for insights
  const dailyMap: Record<string, { income: number; expense: number }> = {};
  histIncome.filter(x => x.date >= startDate && x.date < endDate).forEach(x => {
    const day = x.date.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].income += x.amount;
  });
  histExpense.filter(x => x.date >= startDate && x.date < endDate).forEach(x => {
    const day = x.date.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].expense += x.amount;
  });
  histStudPayments.filter(x => x.paidAt! >= startDate && x.paidAt! < endDate).forEach(x => {
    const day = x.paidAt!.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].income += x.amount;
  });
  histSalPayments.filter(x => x.paidAt! >= startDate && x.paidAt! < endDate).forEach(x => {
    const day = x.paidAt!.toISOString().split('T')[0];
    if (!dailyMap[day]) dailyMap[day] = { income: 0, expense: 0 };
    dailyMap[day].expense += x.amount;
  });

  const dailyInsightsData = Object.entries(dailyMap).map(([date, vals]) => ({
    date,
    ...vals
  })).sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="p-6 flex flex-col gap-8 bg-[#F7F8FA] min-h-screen dashboard-chrome">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Command Center</h1>
          <p className="text-slate-400 text-sm font-medium mt-1">Real-time school financial & operational oversight</p>
        </div>
        <div className="flex items-center gap-4">
           <MonthYearFilter activeMonth={queryMonth} activeYear={queryYear} />
           <QuickActionBar />
        </div>
      </div>

      {/* 2. KPI SECTION */}
      <FinancialKpiSection 
        currentIncome={currentIncome}
        prevIncome={prevIncome}
        currentExpense={currentExpense}
        prevExpense={prevExpense}
        currentBalance={currentBalance}
        prevBalance={prevBalance}
        isCustomRange={!!(queryMonth && queryYear)}
      />

      {/* 3. MAIN DASHBOARD GRID (CHARTS & INSIGHTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT COLUMN - High-Fidelity Charts */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col min-h-[350px]">
             <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Fiscal Overview</h2>
                <FiscalTimeFilter activeFilter={timeFilter} />
             </div>
              <FiscalBarChart 
                incomeData={incomeBreakdown}
                expenseData={expenseBreakdown}
             />
          </div>
          
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm">
             <div className="flex items-center justify-between mb-2">
                <div>
                  <h2 className="text-xl font-bold text-slate-800 tracking-tight">Growth Analytics & AI Projection</h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">12-month historical performance + 3-month AI predictive forecasting</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Expense</span>
                  </div>
                </div>
             </div>
             <GrowthAnalyticsChart data={trendData} />
          </div>
        </div>

        {/* RIGHT COLUMN - Insights & Reports */}
        <div className="lg:col-span-4 flex flex-col gap-8">
          <SmartFinancialInsights 
            income={currentIncome}
            expense={currentExpense}
            breakdown={fullBreakdown}
            prevIncome={prevIncome}
            month={MONTHS[startDate.getMonth()]}
            dailyData={dailyInsightsData}
          />

          <FinancialQuickReport 
            income={currentIncome}
            expense={currentExpense}
            unpaid={unpaidAmount}
            month={MONTHS[startDate.getMonth()] + " " + startDate.getFullYear()}
          />
        </div>
      </div>

      {/* 4. BALANCED LOWER GRID (SIDE-BY-SIDE BREAKDOWN & SNAPSHOT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8">
          <FinancialBreakdown data={fullBreakdown} />
        </div>
        <div className="lg:col-span-4 flex flex-col">
          <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm grow">
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

      {/* 5. ACTION CENTER (UNPAID LEDGER) */}
      <section className="border-t border-slate-100 pt-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-lg">🚨</span>
          <div>
            <h2 className="text-xl font-black text-slate-800 tracking-tight">Critical Actions</h2>
            <p className="text-sm text-slate-400 font-medium">Unpaid ledger — requires immediate attention</p>
          </div>
        </div>
        <ActionCenter 
          unpaidEmployees={unpaidEmployees} 
          unpaidFees={unpaidFees} 
          monthLabel={MONTHS[startDate.getMonth()]}
        />
      </section>

      {/* 6. AI ASSISTANT */}
      <SnapAssistant context={dashboardContext} />
    </div>
  );
};

export default AdminPage;
