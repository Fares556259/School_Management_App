import CountChart from "@/components/CountChart";
import FinanceChart from "@/components/FinanceChart";
import UserCard from "@/components/UserCard";
import prisma from "@/lib/prisma";
import Link from "next/link";
import CollectionGauge from "./CollectionGauge";
import PaymentHeatmap from "./PaymentHeatmap";
import PeriodFilter from "./PeriodFilter";
import ExportButton from "./ExportPDFButton";
import QuickPayButton from "./finance/QuickPayButton";
import { MONTHS } from "@/lib/dateUtils";
import AddFinanceEntryModal from "../list/incomes/AddIncomeModal";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  console.log("=== ADMIN PAGE ACTIVELY SERVED AND RENDERED ===");
  const now = new Date();
  
  // URL PARAMS
  const { period, type } = searchParams || {};

  // Compute date ranges based on period parameter
  let dateWhere: any = {};
  if (period === "Last 3 Months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    dateWhere = { date: { gte: start } };
  } else if (period === "Last 6 Months") {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    dateWhere = { date: { gte: start } };
  } else if (period === "This Year") {
    const start = new Date(now.getFullYear(), 0, 1);
    dateWhere = { date: { gte: start } };
  } else if (period === "All Time") {
    dateWhere = {};
  } else {
    // Default to This Month
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    dateWhere = { date: { gte: start } };
  }

  // Generate current month identifier for the unpaids lists
  const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // PARALLEL QUERIES
  const [
    studentCount,
    teacherCount,
    parentCount,
    staffCount,
    studentBoysCount,
    studentGirlsCount,
    filteredIncomeAgg,
    filteredExpenseAgg,
    allPaymentsInRange,
    filteredIncomes,
    filteredExpenses,
    recentAudit,
    allStudents,
    allTeachers,
    allStaff
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.parent.count(),
    prisma.staff.count(),
    prisma.student.count({ where: { sex: "MALE" } }),
    prisma.student.count({ where: { sex: "FEMALE" } }),
    prisma.income.aggregate({ _sum: { amount: true }, where: { ...dateWhere, NOT: { category: "TUITION" } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { ...dateWhere, NOT: { category: "SALARY" } } }),
    prisma.payment.findMany({
      include: {
        student: { select: { id: true, name: true, surname: true, grade: { select: { level: true } }, parent: { select: { name: true, phone: true } } } },
        teacher: { select: { id: true, name: true, surname: true, salary: true } },
        staff: { select: { id: true, name: true, surname: true, salary: true } },
      }
    }),
    type !== "expense"
      ? prisma.income.findMany({
          where: { ...dateWhere, NOT: { category: "TUITION" } },
          select: { id: true, amount: true, title: true, category: true, date: true },
          orderBy: { date: "desc" }
        })
      : Promise.resolve([]),
    type !== "income"
      ? prisma.expense.findMany({
          where: { ...dateWhere, NOT: { category: "SALARY" } },
          select: { id: true, amount: true, title: true, category: true, date: true },
          orderBy: { date: "desc" }
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({ orderBy: { timestamp: "desc" }, take: 5 }),
    prisma.student.findMany({ select: { id: true, name: true, surname: true, grade: { select: { level: true } }, parent: { select: { name: true, phone: true } } } }),
    prisma.teacher.findMany({ select: { id: true, name: true, surname: true, salary: true } }),
    prisma.staff.findMany({ select: { id: true, name: true, surname: true, salary: true } }),
  ]);

  const [mName, yStr] = currentMonthKey.split(" ");
  const currentMonthIdx = MONTHS.indexOf(mName);
  const currentYearVal = parseInt(yStr);

  let studentsPaidCount = 0;
  let teachersPaidCount = 0;
  let staffPaidCount = 0;
  
  let tuitionPaidAmount = 0;
  let salariesPaidAmount = 0;

  const unpaidStudentsList: any[] = [];
  const unpaidTeachersList: any[] = [];
  const unpaidStaffList: any[] = [];

  const studentPayments = allPaymentsInRange.filter((p: any) => p.userType === "STUDENT");
  const teacherPayments = allPaymentsInRange.filter((p: any) => p.userType === "TEACHER");
  const staffPayments = allPaymentsInRange.filter((p: any) => p.userType === "STAFF");

  allPaymentsInRange.forEach((p: any) => {
    const isViewedMonth = p.month === currentMonthIdx && p.year === currentYearVal;
    
    if (p.status === "PAID") {
      if (p.userType === "STUDENT") {
        studentsPaidCount++;
        tuitionPaidAmount += p.amount;
      } else if (p.userType === "TEACHER") {
        teachersPaidCount++;
        salariesPaidAmount += p.amount;
      } else {
        staffPaidCount++;
        salariesPaidAmount += p.amount;
      }
    } else if (isViewedMonth) {
      if (p.userType === "STUDENT" && p.student) unpaidStudentsList.push(p.student);
      else if (p.userType === "TEACHER" && p.teacher) unpaidTeachersList.push(p.teacher);
      else if (p.userType === "STAFF" && p.staff) unpaidStaffList.push(p.staff);
    }
  });

  const studentTotalExpected = studentPayments.length;
  const teacherTotalExpected = teacherPayments.length;
  const staffTotalExpected = staffPayments.length;

  const totalMissedPaymentsInRange = 
    (studentTotalExpected - studentsPaidCount) + 
    (teacherTotalExpected - teachersPaidCount) + 
    (staffTotalExpected - staffPaidCount);

  const totalIncome = (filteredIncomeAgg._sum.amount ?? 0) + tuitionPaidAmount;
  const totalExpense = (filteredExpenseAgg._sum.amount ?? 0) + salariesPaidAmount;
  const netBalance = totalIncome - totalExpense;

  const studentsPaid = studentsPaidCount;
  const studentTotal = studentTotalExpected || 1;
  const teachersPaid = teachersPaidCount;
  const teacherTotal = (teacherTotalExpected + staffTotalExpected) || 1; 

  const heatmapMap: Record<string, { count: number; amount: number }> = {};
  [...filteredIncomes, ...filteredExpenses].forEach((d: any) => {
    const dateStr = d.date.toISOString().split("T")[0];
    if (!heatmapMap[dateStr]) heatmapMap[dateStr] = { count: 0, amount: 0 };
    heatmapMap[dateStr].count += 1;
    heatmapMap[dateStr].amount += d.amount || 0;
  });

  allPaymentsInRange.forEach((p: any) => {
    if (p.status === "PAID" && p.paidAt) {
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

  const paymentRateList = ((studentsPaid + teachersPaid) / (studentTotal + teacherTotal)) * 100;
  const collectionRate = isNaN(paymentRateList) ? 0 : paymentRateList;

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* ROW 1: USER CARDS */}
      <div className="flex gap-4 justify-between flex-wrap">
        <UserCard type="student" count={studentCount} />
        <UserCard type="teacher" count={teacherCount} />
        <UserCard type="parent" count={parentCount} />
        <UserCard type="staff" count={staffCount} />
      </div>

      {/* ROW 2: GENERAL FINANCE AGGREGATES */}
      <div className="flex gap-4 w-full h-auto flex-wrap">
        <div className="flex-1 min-w-[300px] bg-emerald-500 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-100 flex justify-between">
            <span className="bg-emerald-600/50 px-2 py-1 rounded-md">{period || "ALL TIME"}</span>
            <span className="text-xl">📈</span>
          </p>
          <p className="text-xl font-bold text-white mt-1 opacity-80">Income</p>
          <h1 className="text-4xl font-black text-white mt-2">${(totalIncome / 1000).toFixed(1)}K</h1>
        </div>

        <div className="flex-1 min-w-[300px] bg-rose-600 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-200 flex justify-between">
            <span className="bg-rose-700/50 px-2 py-1 rounded-md">{period || "ALL TIME"}</span>
            <span className="text-xl">📉</span>
          </p>
          <p className="text-xl font-bold text-white mt-1 opacity-80">Expenses</p>
          <h1 className="text-4xl font-black text-white mt-2">${(totalExpense / 1000).toFixed(1)}K</h1>
        </div>

        <div className="flex-1 min-w-[300px] bg-amber-500 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-100 flex justify-between">
            <span className="bg-amber-600/50 px-2 py-1 rounded-md">{period || "ALL TIME"}</span>
            <span className="text-xl">⚠</span>
          </p>
          <p className="text-xl font-bold text-amber-50 mt-1 opacity-80">Net Balance</p>
          <h1 className="text-4xl font-black text-white mt-2">${(netBalance / 1000).toFixed(1)}K</h1>
        </div>

        <div className="flex-1 min-w-[300px] bg-violet-600 rounded-2xl p-6 shadow-sm relative overflow-hidden group hover:scale-[1.01] transition-transform">
          <p className="text-xs font-bold uppercase tracking-wider text-violet-200 flex justify-between">
            <span className="bg-violet-700/50 px-2 py-1 rounded-md">ALL TIME</span>
            <span className="text-xl opacity-90">🔔</span>
          </p>
          <p className="text-xl font-bold text-violet-100 mt-1 opacity-80">Unpaid</p>
          <h1 className="text-4xl font-black text-white mt-2">{totalMissedPaymentsInRange}</h1>
        </div>
      </div>

      {/* ROW 3: INSIGHTS NAVBAR */}
      <div className="flex items-center gap-4 bg-slate-50 border border-slate-100 p-2 rounded-xl sticky top-0 z-10 w-full flex-wrap justify-between shadow-sm my-2">
        <div className="flex items-center gap-4 px-4">
          <h2 className="text-xl font-black text-slate-800">Financial Insights</h2>
          <PeriodFilter />
        </div>
      </div>

      {/* ROW 4: CHARTS */}
      <div className="flex gap-4 flex-col lg:flex-row h-auto">
        <div className="w-full lg:w-1/3">
          <CollectionGauge rate={collectionRate} month={currentMonthKey} />
        </div>
        <div className="w-full lg:w-1/3 bg-white p-4 rounded-2xl shadow-sm h-full max-h-[450px]">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Student Distribution</h2>
          <div className="h-[90%] w-full">
            <CountChart />
          </div>
        </div>
        <div className="w-full lg:w-1/3 min-h-[450px]">
          <PaymentHeatmap data={heatmapData} />
        </div>
      </div>

      <div className="w-full h-auto bg-white p-6 rounded-2xl shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-800">Financial Overview</h2>
        </div>
        <div className="h-[400px]">
          <FinanceChart />
        </div>
      </div>

      {/* ROW 5: UNPAID LISTS */}
      <div className="flex gap-6 flex-col xl:flex-row mt-6">
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-rose-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4">⚠ Unpaid Teachers ({currentMonthKey})</h2>
          {unpaidTeachersList.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ All teachers paid this month!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {unpaidTeachersList.map((t) => (
                <div key={t.id} className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-sm font-medium text-slate-700">{t.name} {t.surname}</span>
                  <QuickPayButton id={t.id} name={`${t.name} ${t.surname}`} amount={t.salary} monthYear={currentMonthKey} type="teacher" />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-amber-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4">⚠ Unpaid Students ({currentMonthKey})</h2>
          {unpaidStudentsList.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ All students paid this month!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {unpaidStudentsList.map((s) => {
                const tuitionAmount = 80 + s.grade.level * 20;
                return (
                  <div key={s.id} className="flex justify-between items-center border-b border-slate-50 pb-2">
                    <span className="text-sm font-medium text-slate-700">{s.name} {s.surname}</span>
                    <QuickPayButton id={s.id} name={`${s.name} ${s.surname}`} amount={tuitionAmount} monthYear={currentMonthKey} type="student" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-orange-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4">⚠ Unpaid Staff ({currentMonthKey})</h2>
          {unpaidStaffList.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ All staff paid this month!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {unpaidStaffList.map((s) => (
                <div key={s.id} className="flex justify-between items-center border-b border-slate-50 pb-2">
                  <span className="text-sm font-medium text-slate-700">{s.name} {s.surname}</span>
                  <QuickPayButton id={s.id} name={`${s.name} ${s.surname}`} amount={s.salary} monthYear={currentMonthKey} type="staff" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default AdminPage;
