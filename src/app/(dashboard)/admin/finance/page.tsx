import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { redirect } from "next/navigation";
import Link from "next/link";
import FinanceChart from "./FinanceChart";
import AddFinanceEntryModal from "./AddFinanceEntryModal";
import ExportButton from "@/components/ExportButton";
import { MONTHS } from "@/lib/dateUtils";
// Group records by "Month Year" and sum amounts
function groupByMonth(records: { date: Date; amount: number }[]) {
  const map: Record<string, number> = {};
  for (const r of records) {
    const key = r.date.toLocaleString("en-US", { month: "short", year: "numeric" });
    map[key] = (map[key] || 0) + r.amount;
  }
  return map;
}

// Get last 6 month labels
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

  // Build where clauses from search params
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

  // Fetch ALL records for chart (unfiltered), filtered for lists
  const [
    allIncomes,
    allExpenses,
    filteredIncomes,
    filteredExpenses,
    allTeachers,
    allStudents,
  ] = await Promise.all([
    // All records for chart (unaffected by type/search filters)
    prisma.income.findMany({ orderBy: { date: "desc" } }),
    prisma.expense.findMany({ orderBy: { date: "desc" } }),
    // Filtered for the list display
    type !== "expense"
      ? prisma.income.findMany({ where: incomeWhere, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    type !== "income"
      ? prisma.expense.findMany({ where: expenseWhere, orderBy: { date: "desc" } })
      : Promise.resolve([]),
    // Unpaid (fetch all with current month payments, filter in JS)
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

  // Chart data uses ALL (unfiltered) records
  const incomeByMonth = groupByMonth(allIncomes);
  const expenseByMonth = groupByMonth(allExpenses);
  const last6 = getLast6Months();
  const chartData = last6.map((m) => ({
    month: m,
    income: incomeByMonth[m] || 0,
    expense: expenseByMonth[m] || 0,
  }));

  // CSV exports use filtered lists
  const incomeRows = filteredIncomes.map((i) => ({
    Title: i.title,
    Amount: i.amount,
    Category: i.category,
    Date: i.date.toLocaleDateString(),
  }));
  const expenseRows = filteredExpenses.map((e) => ({
    Title: e.title,
    Amount: e.amount,
    Category: e.category,
    Date: e.date.toLocaleDateString(),
  }));

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-800">Financial Tracking</h1>
        <AddFinanceEntryModal />
      </div>

      {/* SUMMARY CARDS */}
      <div className="flex gap-4 justify-between flex-wrap">
        <div className="rounded-2xl bg-indigo-500 p-6 flex-1 min-w-[180px] shadow-sm">
          <h2 className="text-sm font-semibold text-indigo-200 uppercase tracking-widest">Total Income</h2>
          <h1 className="text-3xl font-bold text-white mt-2">${totalIncome.toLocaleString()}</h1>
          <p className="text-xs text-indigo-200 mt-2">{allIncomes.length} records</p>
        </div>
        <div className="rounded-2xl bg-rose-500 p-6 flex-1 min-w-[180px] shadow-sm">
          <h2 className="text-sm font-semibold text-rose-200 uppercase tracking-widest">Total Expenses</h2>
          <h1 className="text-3xl font-bold text-white mt-2">${totalExpense.toLocaleString()}</h1>
          <p className="text-xs text-rose-200 mt-2">{allExpenses.length} records</p>
        </div>
        <div className={`rounded-2xl p-6 flex-1 min-w-[180px] shadow-sm ${netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`}>
          <h2 className="text-sm font-semibold text-emerald-100 uppercase tracking-widest">Net Balance</h2>
          <h1 className="text-3xl font-bold text-white mt-2">${netProfit.toLocaleString()}</h1>
          <p className="text-xs text-emerald-100 mt-2">Overall</p>
        </div>
        <div className="rounded-2xl bg-amber-500 p-6 flex-1 min-w-[180px] shadow-sm">
          <h2 className="text-sm font-semibold text-amber-100 uppercase tracking-widest">Unpaid This Month</h2>
          <h1 className="text-3xl font-bold text-white mt-2">{unpaidTeachers.length + unpaidStudents.length}</h1>
          <p className="text-xs text-amber-100 mt-2">{unpaidTeachers.length} teachers · {unpaidStudents.length} students</p>
        </div>
      </div>

      {/* CHART */}
      <FinanceChart data={chartData} />

      {/* SEARCH + FILTER */}
      <form method="GET" className="bg-white p-4 rounded-2xl shadow-sm flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Search</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by title..."
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 w-52"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</label>
          <select name="type" defaultValue={type} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="">All</option>
            <option value="income">Income only</option>
            <option value="expense">Expense only</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
          <select name="category" defaultValue={category} className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="">All Categories</option>
            <option value="SALARY">Salary</option>
            <option value="TUITION">Tuition</option>
            <option value="UTILITIES">Utilities</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="DONATION">Donation</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-indigo-500 text-white text-sm font-semibold rounded-lg hover:bg-indigo-600">
          Filter
        </button>
        <a href="/admin/finance" className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-800">
          Clear
        </a>
      </form>

      {/* TRANSACTIONS */}
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* EXPENSES */}
        {type !== "income" && (
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Expenses</h2>
              <ExportButton
                data={expenseRows as any}
                headers={["Title", "Amount", "Category", "Date"]}
                filename="expenses"
              />
            </div>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {filteredExpenses.length === 0 ? (
                <p className="text-slate-400 text-sm">No expenses found.</p>
              ) : (
                filteredExpenses.map((e) => (
                  <div key={e.id} className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div>
                      <p className="font-medium text-slate-700 text-sm">{e.title}</p>
                      <p className="text-xs text-slate-400">{e.category} · {e.date.toLocaleDateString()}</p>
                    </div>
                    <span className="text-rose-500 font-bold text-sm bg-rose-50 px-2 py-1 rounded-full">
                      -${e.amount.toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* INCOMES */}
        {type !== "expense" && (
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Incomes</h2>
              <ExportButton
                data={incomeRows as any}
                headers={["Title", "Amount", "Category", "Date"]}
                filename="incomes"
              />
            </div>
            <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
              {filteredIncomes.length === 0 ? (
                <p className="text-slate-400 text-sm">No income found.</p>
              ) : (
                filteredIncomes.map((i) => (
                  <div key={i.id} className="flex justify-between items-center border-b border-slate-50 pb-3">
                    <div>
                      <p className="font-medium text-slate-700 text-sm">{i.title}</p>
                      <p className="text-xs text-slate-400">{i.category} · {i.date.toLocaleDateString()}</p>
                    </div>
                    <span className="text-emerald-500 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-full">
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
      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-rose-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4">⚠ Unpaid Teachers ({currentMonth})</h2>
          {unpaidTeachers.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ All teachers paid this month!</p>
          ) : (
            <div className="flex flex-col gap-2">
              {unpaidTeachers.map((t) => (
                <Link
                  key={t.id}
                  href={`/list/teachers/${t.id}`}
                  className="flex justify-between items-center border-b border-slate-50 pb-2 hover:bg-slate-50 px-2 rounded-md"
                >
                  <span className="text-sm font-medium text-slate-700">{t.name} {t.surname}</span>
                  <span className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-full">
                    ${t.salary} due
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-amber-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4">⚠ Unpaid Students</h2>
          {unpaidStudents.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ All students paid this month!</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {unpaidStudents.map((s: any) => {
                const tuitionAmount = 80 + s.grade.level * 20;
                return (
                  <Link
                    key={s.id}
                    href={`/list/students/${s.id}`}
                    className="flex justify-between items-center border-b border-slate-50 pb-2 hover:bg-slate-50 px-2 rounded-md"
                  >
                    <span className="text-sm font-medium text-slate-700">{s.name} {s.surname}</span>
                    <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full">
                      ${tuitionAmount} due
                    </span>
                  </Link>
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
