import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import FinanceChart from "./FinanceChart";
import AddFinanceEntryModal from "./AddFinanceEntryModal";
import ExportButton from "@/components/ExportButton";
import { MONTHS } from "@/lib/dateUtils";

function groupByMonth(records: { date: Date; amount: number }[]) {
  const map: Record<string, number> = {};
  for (const r of records) {
    const key = r.date.toLocaleString("en-US", { month: "short", year: "numeric" });
    map[key] = (map[key] || 0) + r.amount;
  }
  return map;
}

function getLast6Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setMonth(d.getMonth() - 5);
  for (let i = 0; i < 6; i++) {
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const FinancePage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const role = await getRole();
  if (role !== "admin") redirect(`/${role || "sign-in"}`);

  const { category, type, q } = searchParams;
  const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  const incomeWhere: Record<string, any> = {};
  const expenseWhere: Record<string, any> = {};

  if (q) {
    incomeWhere.title = { contains: q, mode: "insensitive" };
    expenseWhere.title = { contains: q, mode: "insensitive" };
  }
  if (category) {
    incomeWhere.category = category;
    expenseWhere.category = category;
  }

  const [
    allIncomes, allExpenses, filteredIncomes, filteredExpenses, allTeachers, allStudents,
  ] = await Promise.all([
    prisma.income.findMany({ orderBy: { date: "desc" } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
    type !== "expense"
      ? prisma.income.findMany({ where: incomeWhere, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    type !== "income"
      ? prisma.expense.findMany({ where: expenseWhere, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    prisma.teacher.findMany({
      select: { id: true, name: true, surname: true, salary: true, payments: { where: { month: MONTHS.indexOf(MONTHS[new Date().getMonth()]), year: new Date().getFullYear() } } },
    }),
    prisma.student.findMany({
      include: { grades: true, payments: { where: { month: MONTHS.indexOf(MONTHS[new Date().getMonth()]), year: new Date().getFullYear() } } },
    }),
  ]);

  const unpaidTeachers = allTeachers.filter((t: any) => !t.payments.some((p: any) => p.status === "PAID"));
  const unpaidStudents = allStudents.filter((s: any) => !s.payments.some((p: any) => p.status === "PAID"));

  const totalIncome = allIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = allExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const incomeByMonth = groupByMonth(allIncomes);
  const expenseByMonth = groupByMonth(allExpenses);
  const last6 = getLast6Months();
  const chartData = last6.map((m) => ({
    month: m,
    income: incomeByMonth[m] || 0,
    expense: expenseByMonth[m] || 0,
  }));

  const incomeRows = filteredIncomes.map((i) => ({
    Title: i.title, Amount: i.amount, Category: i.category, Date: i.date.toLocaleDateString(),
  }));
  const expenseRows = filteredExpenses.map((e) => ({
    Title: e.title, Amount: e.amount, Category: e.category, Date: e.date.toLocaleDateString(),
  }));

  const kpiCards = [
    {
      label: "Total Income",
      value: `$${totalIncome.toLocaleString()}`,
      sub: `${allIncomes.length} records`,
      color: "bg-emerald-50 border-emerald-200",
      valueColor: "text-emerald-700",
      dot: "bg-emerald-500",
    },
    {
      label: "Total Expenses",
      value: `$${totalExpense.toLocaleString()}`,
      sub: `${allExpenses.length} records`,
      color: "bg-rose-50 border-rose-200",
      valueColor: "text-rose-700",
      dot: "bg-rose-500",
    },
    {
      label: "Net Balance",
      value: `${netProfit >= 0 ? "+" : ""}$${netProfit.toLocaleString()}`,
      sub: "Overall",
      color: netProfit >= 0 ? "bg-indigo-50 border-indigo-200" : "bg-red-50 border-red-200",
      valueColor: netProfit >= 0 ? "text-indigo-700" : "text-red-700",
      dot: netProfit >= 0 ? "bg-indigo-500" : "bg-red-500",
    },
    {
      label: "Unpaid This Month",
      value: `${unpaidTeachers.length + unpaidStudents.length}`,
      sub: `${unpaidTeachers.length} teachers · ${unpaidStudents.length} students`,
      color: "bg-amber-50 border-amber-200",
      valueColor: "text-amber-700",
      dot: "bg-amber-500",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* PAGE HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Financial Tracking</h1>
          <p className="text-sm text-slate-400 font-medium mt-0.5">Income, expenses & payment ledger</p>
        </div>
        <AddFinanceEntryModal />
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className={`rounded-2xl border p-5 ${card.color} flex flex-col gap-2`}>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${card.dot}`} />
              <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{card.label}</span>
            </div>
            <p className={`text-3xl font-black tracking-tight ${card.valueColor}`}>{card.value}</p>
            <p className="text-xs text-slate-400 font-medium">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* CHART */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4">6-Month Trend</h2>
        <FinanceChart data={chartData} />
      </div>

      {/* FILTER TOOLBAR */}
      <form method="GET" className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by title..."
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 w-52 bg-slate-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</label>
          <select name="type" defaultValue={type} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-slate-50">
            <option value="">All</option>
            <option value="income">Income only</option>
            <option value="expense">Expense only</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</label>
          <select name="category" defaultValue={category} className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400 bg-slate-50">
            <option value="">All Categories</option>
            <option value="SALARY">Salary</option>
            <option value="TUITION">Tuition</option>
            <option value="UTILITIES">Utilities</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DONATION">Donation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div className="flex items-center gap-2 pb-0.5">
          <button type="submit" className="px-5 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-sm">
            Filter
          </button>
          <a href="/admin/finance" className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors">
            Clear
          </a>
        </div>
      </form>

      {/* TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {type !== "income" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500" />
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Expenses</h2>
              </div>
              <ExportButton data={expenseRows as any} headers={["Title", "Amount", "Category", "Date"]} filename="expenses" />
            </div>
            <div className="flex flex-col divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {filteredExpenses.length === 0 ? (
                <p className="text-slate-400 text-sm p-6">No expenses found.</p>
              ) : (
                filteredExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between items-center px-6 py-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{e.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{e.category} · {e.date.toLocaleDateString()}</p>
                    </div>
                    <span className="text-rose-600 font-bold text-sm bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full shrink-0">
                      -${e.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {type !== "expense" && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Incomes</h2>
              </div>
              <ExportButton data={incomeRows as any} headers={["Title", "Amount", "Category", "Date"]} filename="incomes" />
            </div>
            <div className="flex flex-col divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {filteredIncomes.length === 0 ? (
                <p className="text-slate-400 text-sm p-6">No income found.</p>
              ) : (
                filteredIncomes.map((i) => (
                  <div key={i.id} className="flex justify-between items-center px-6 py-3 hover:bg-slate-50 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-700 text-sm">{i.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{i.category} · {i.date.toLocaleDateString()}</p>
                    </div>
                    <span className="text-emerald-600 font-bold text-sm bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full shrink-0">
                      +${i.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* UNPAID REPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <div className="w-2 h-2 rounded-full bg-rose-500" />
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Unpaid Teachers</h2>
            <span className="ml-auto text-xs font-bold text-slate-400">{currentMonth}</span>
          </div>
          {unpaidTeachers.length === 0 ? (
            <p className="text-emerald-600 text-sm font-semibold p-6">✓ All teachers paid this month!</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {unpaidTeachers.map((t) => (
                <a key={t.id} href={`/list/teachers/${t.id}`}
                  className="flex justify-between items-center px-6 py-3 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm font-semibold text-slate-700">{t.name} {t.surname}</span>
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-full">
                    ${t.salary} due
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h2 className="text-sm font-black text-slate-700 uppercase tracking-wider">Unpaid Students</h2>
          </div>
          {unpaidStudents.length === 0 ? (
            <p className="text-emerald-600 text-sm font-semibold p-6">✓ All students paid this month!</p>
          ) : (
            <div className="flex flex-col divide-y divide-slate-50 max-h-72 overflow-y-auto">
              {unpaidStudents.map((s: any) => {
                const tuitionAmount = 80 + s.levelId * 20;
                return (
                  <a key={s.id} href={`/list/students/${s.id}`}
                    className="flex justify-between items-center px-6 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <span className="text-sm font-semibold text-slate-700">{s.name} {s.surname}</span>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      ${tuitionAmount} due
                    </span>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinancePage;
