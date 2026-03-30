import CountChart from "@/components/CountChart";
import FinanceChart from "@/components/FinanceChart";
import UserCard from "@/components/UserCard";
import prisma from "@/lib/prisma";
import Link from "next/link";

const AdminPage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    studentCount,
    teacherCount,
    parentCount,
    staffCount,
    incomeThisMonth,
    expenseThisMonth,
    unpaidTeachers,
    unpaidStudents,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.teacher.count(),
    prisma.parent.count(),
    prisma.staff.count(),
    prisma.income.aggregate({ _sum: { amount: true }, where: { date: { gte: startOfMonth } } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: startOfMonth } } }),
    prisma.teacher.count({ where: { isPaid: false } }),
    prisma.student.count({ where: { isPaid: false } }),
  ]);

  const totalIncome = incomeThisMonth._sum.amount ?? 0;
  const totalExpense = expenseThisMonth._sum.amount ?? 0;

  const statCards = [
    { label: "Income This Month", value: `$${totalIncome.toLocaleString()}`, color: "bg-indigo-500", text: "text-indigo-100" },
    { label: "Expenses This Month", value: `$${totalExpense.toLocaleString()}`, color: "bg-rose-500", text: "text-rose-100" },
    { label: "Unpaid Teachers", value: unpaidTeachers.toString(), color: "bg-amber-500", text: "text-amber-100" },
    { label: "Unpaid Students", value: unpaidStudents.toString(), color: "bg-purple-500", text: "text-purple-100" },
  ];

  return (
    <div className="p-4 flex gap-4 flex-col lg:flex-row">
      {/* LEFT */}
      <div className="w-full lg:w-2/3 flex flex-col gap-8">
        {/* USER CARDS */}
        <div className="flex gap-4 justify-between flex-wrap">
          <UserCard type="student" count={studentCount} />
          <UserCard type="teacher" count={teacherCount} />
          <UserCard type="parent" count={parentCount} />
          <UserCard type="staff" count={staffCount} />
        </div>

        {/* MONTHLY STATS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-700">Monthly Finance Summary</h2>
            <Link href="/admin/finance" className="text-sm text-indigo-500 hover:underline font-medium">
              View Details →
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {statCards.map((s) => (
              <div key={s.label} className={`${s.color} rounded-2xl p-4 shadow-sm`}>
                <p className={`text-xs font-semibold uppercase tracking-wider ${s.text}`}>{s.label}</p>
                <p className="text-2xl font-bold text-white mt-2">{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CHARTS */}
        <div className="flex gap-4 flex-col lg:flex-row">
          <div className="w-full lg:w-1/3 h-[450px]">
            <CountChart />
          </div>
          <div className="w-full lg:w-2/3 h-[450px]">
            {/* Finance chart below */}
          </div>
        </div>
        {/* BOTTOM CHART */}
        <div className="w-full h-[500px]">
          <FinanceChart />
        </div>
      </div>
      {/* RIGHT */}
      <div className="w-full lg:w-1/3 flex flex-col gap-8">
        {/* Quick links */}
        <div className="glass-card p-6 rounded-3xl">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Quick Links</h2>
          <div className="flex flex-col gap-3">
            <Link href="/list/teachers" className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-sm font-medium text-slate-600 hover:text-indigo-600">
              👩‍🏫 Manage Teachers
            </Link>
            <Link href="/list/students" className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-sm font-medium text-slate-600 hover:text-indigo-600">
              🎓 Manage Students
            </Link>
            <Link href="/list/staff" className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-sm font-medium text-slate-600 hover:text-indigo-600">
              🏢 Manage Staff
            </Link>
            <Link href="/admin/finance" className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-sm font-medium text-slate-600 hover:text-indigo-600">
              💰 Finance Dashboard
            </Link>
            <Link href="/admin/audit" className="p-3 rounded-xl bg-slate-50 hover:bg-indigo-50 transition-colors text-sm font-medium text-slate-600 hover:text-indigo-600">
              📋 Audit Log
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
