import prisma from "@/lib/prisma";
import { getCachedTenantData } from "@/lib/cache";
import { getRole } from "@/lib/role";
import { getSchoolId } from "@/lib/school";
import { redirect } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import AddFinanceEntryModal from "./AddFinanceEntryModal";

const FinanceChart = dynamic(() => import("./FinanceChart"), {
  ssr: false,
  loading: () => (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[400px] flex items-center justify-center">
      <div className="w-full h-[320px] bg-slate-100/70 animate-pulse rounded-xl" />
    </div>
  ),
});
import ExportButton from "@/components/ExportButton";
import { MONTHS } from "@/lib/dateUtils";
import FinancePeriodFilter from "./FinancePeriodFilter";
import ConsolidatedFinanceExport from "./ConsolidatedFinanceExport";
import { getExpenseNature } from "@/app/(dashboard)/list/expenses/ExpensesListClient";
import { TrendingUp, Banknote, Receipt, AlertCircle, ArrowUpRight } from "lucide-react";

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

  const { category, type, q, period, from, to } = searchParams;
  const schoolId = await getSchoolId();
  const currentMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  // Period resolution
  const now = new Date();
  const activePeriod = period || "month";
  let startDate: Date | undefined;
  let endDate: Date | undefined;
  let periodLabel = "Ce mois-ci";

  if (activePeriod === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    periodLabel = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  } else if (activePeriod === "last_month") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const prevMonthIdx = (now.getMonth() + 11) % 12;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    periodLabel = `${MONTHS[prevMonthIdx]} ${prevYear}`;
  } else if (activePeriod === "quarter") {
    startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    periodLabel = "Trimestre en cours";
  } else if (activePeriod === "school_year") {
    const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    startDate = new Date(startYear, 8, 1, 0, 0, 0, 0);
    endDate = new Date(startYear + 1, 7, 31, 23, 59, 59, 999);
    periodLabel = `Année Scolaire ${startYear}-${startYear + 1}`;
  } else if (activePeriod === "custom" && (from || to)) {
    startDate = from ? new Date(from) : undefined;
    endDate = to ? new Date(to) : undefined;
    periodLabel = `Du ${from || "..."} au ${to || "..."}`;
  } else if (activePeriod === "all") {
    periodLabel = "Tout l'historique";
  }

  // Build where clauses from search params & period
  const dateFilter: Record<string, any> = {};
  if (startDate) dateFilter.gte = startDate;
  if (endDate) dateFilter.lte = endDate;

  const incomeWhere: Record<string, any> = { schoolId };
  const expenseWhere: Record<string, any> = { schoolId };

  if (startDate || endDate) {
    incomeWhere.date = dateFilter;
    expenseWhere.date = dateFilter;
  }

  if (q) {
    incomeWhere.title = { contains: q, mode: "insensitive" };
    expenseWhere.title = { contains: q, mode: "insensitive" };
  }
  if (category) {
    incomeWhere.category = category;
    expenseWhere.category = category;
  }

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Parallel data fetching with tenant cache
  const [
    chartIncomes,
    chartExpenses,
    periodIncomes,
    periodExpenses,
    allTeachers,
    allStudents,
  ] = await getCachedTenantData(
    schoolId,
    "finance",
    [category, type, q, activePeriod, from, to, schoolId],
    () =>
      Promise.all([
        prisma.income.findMany({
          where: { schoolId, date: { gte: sixMonthsAgo } },
          orderBy: { date: "desc" },
        }),
        prisma.expense.findMany({
          where: { schoolId, date: { gte: sixMonthsAgo } },
          orderBy: { date: "desc" },
        }),
        type !== "expense"
          ? prisma.income.findMany({ where: incomeWhere, orderBy: { date: "desc" } })
          : Promise.resolve([]),
        type !== "income"
          ? prisma.expense.findMany({ where: expenseWhere, orderBy: { date: "desc" } })
          : Promise.resolve([]),
        prisma.teacher.findMany({
          select: {
            id: true,
            name: true,
            surname: true,
            salary: true,
            payments: {
              where: {
                month: MONTHS.indexOf(MONTHS[new Date().getMonth()]),
                year: new Date().getFullYear(),
              },
            },
          },
        }),
        prisma.student.findMany({
          include: {
            level: true,
            payments: {
              where: {
                month: MONTHS.indexOf(MONTHS[new Date().getMonth()]),
                year: new Date().getFullYear(),
              },
            },
          },
        }),
      ]),
    120
  );

  const unpaidTeachers = allTeachers.filter((t: any) => !t.payments.some((p: any) => p.status === "PAID"));
  const unpaidStudents = allStudents.filter((s: any) => !s.payments.some((p: any) => p.status === "PAID"));

  const totalIncome = periodIncomes.reduce((s, i) => s + i.amount, 0);
  const totalExpense = periodExpenses.reduce((s, e) => s + e.amount, 0);

  // Expense breakdown: Salaries vs Advances vs Operations
  let totalSalaries = 0;
  let countSalaries = 0;
  let totalAdvances = 0;
  let countAdvances = 0;
  let totalCharges = 0;
  let countCharges = 0;

  periodExpenses.forEach((e) => {
    const nature = getExpenseNature(e);
    if (nature === "salary") {
      totalSalaries += e.amount;
      countSalaries += 1;
    } else if (nature === "advance") {
      totalAdvances += e.amount;
      countAdvances += 1;
    } else {
      totalCharges += e.amount;
      countCharges += 1;
    }
  });

  const netProfit = totalIncome - totalExpense;
  const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : "0.0";

  // Chart data
  const incomeByMonth = groupByMonth(chartIncomes);
  const expenseByMonth = groupByMonth(chartExpenses);
  const last6 = getLast6Months();
  const chartData = last6.map((m) => ({
    month: m,
    income: incomeByMonth[m] || 0,
    expense: expenseByMonth[m] || 0,
  }));

  // CSV exports
  const incomeRows = periodIncomes.map((i) => ({
    Title: i.title,
    Amount: i.amount,
    Category: i.category,
    Date: new Date(i.date).toLocaleDateString("fr-FR"),
  }));
  const expenseRows = periodExpenses.map((e) => {
    const nature = getExpenseNature(e);
    const natureLabel =
      nature === "salary"
        ? "Salaire Soldé"
        : nature === "advance"
        ? "Acompte / Avance"
        : "Charge";
    return {
      Title: e.title,
      Nature: natureLabel,
      Amount: e.amount,
      Category: e.category,
      Date: new Date(e.date).toLocaleDateString("fr-FR"),
    };
  });

  return (
    <div className="p-4 flex flex-col gap-6">
      {/* HEADER WITH ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Tableau de Bord Financier & Rentabilité</h1>
          <p className="text-xs text-slate-500 mt-1">
            Analyse complète des revenus, ventilation des salaires & acomptes, marge nette et charges.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConsolidatedFinanceExport
            periodLabel={periodLabel}
            totalIncome={totalIncome}
            totalExpense={totalExpense}
            totalSalaries={totalSalaries}
            totalAdvances={totalAdvances}
            totalCharges={totalCharges}
            netProfit={netProfit}
            profitMargin={profitMargin}
            incomes={periodIncomes}
            expenses={periodExpenses}
          />
          <AddFinanceEntryModal />
        </div>
      </div>

      {/* PERIOD & QUICK FILTER BAR */}
      <FinancePeriodFilter
        currentPeriod={activePeriod}
        currentFrom={from}
        currentTo={to}
        currentQuery={q}
        currentCategory={category}
        currentType={type}
      />

      {/* 4 SUMMARY METRIC CARDS WITH BREAKDOWN */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 shadow-sm text-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-indigo-200 uppercase tracking-widest">Revenus Totaux</h2>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">{periodIncomes.length} flux</span>
            </div>
            <h1 className="text-3xl font-black mt-2">
              {totalIncome.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-sm font-semibold text-indigo-200">DT</span>
            </h1>
          </div>
          <p className="text-[11px] text-indigo-200/90 mt-3 pt-2 border-t border-white/10">
            Encaissements ({periodLabel})
          </p>
        </div>

        {/* Total Expenses with sub-breakdown */}
        <div className="rounded-2xl bg-white border border-rose-100 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-rose-500 uppercase tracking-widest">Dépenses Totales</h2>
              <span className="text-[10px] bg-rose-50 text-rose-600 px-2 py-0.5 rounded-full font-bold">{periodExpenses.length} flux</span>
            </div>
            <h1 className="text-3xl font-black text-slate-800 mt-2">
              {totalExpense.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-sm font-semibold text-slate-400">DT</span>
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold">
            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              Salaires: {totalSalaries.toLocaleString("en-US").replace(/,/g, " ")} DT
            </span>
            <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200">
              Avances: {totalAdvances.toLocaleString("en-US").replace(/,/g, " ")} DT
            </span>
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
              Charges: {totalCharges.toLocaleString("en-US").replace(/,/g, " ")} DT
            </span>
          </div>
        </div>

        {/* Net Profit & Profit Margin */}
        <div className={`rounded-2xl p-5 shadow-sm flex flex-col justify-between border ${
          netProfit >= 0 ? "bg-emerald-50/70 border-emerald-200" : "bg-red-50/70 border-red-200"
        }`}>
          <div>
            <div className="flex items-center justify-between">
              <h2 className={`text-xs font-bold uppercase tracking-widest ${netProfit >= 0 ? "text-emerald-800" : "text-red-800"}`}>
                Résultat Net (Bénéfice)
              </h2>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                netProfit >= 0 ? "bg-emerald-200/80 text-emerald-800" : "bg-red-200/80 text-red-800"
              }`}>
                {netProfit >= 0 ? `+${profitMargin}% Marge` : `${profitMargin}% Déficit`}
              </span>
            </div>
            <h1 className={`text-3xl font-black mt-2 ${netProfit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
              {netProfit.toLocaleString("en-US").replace(/,/g, " ")} <span className="text-sm font-semibold opacity-70">DT</span>
            </h1>
          </div>
          <p className={`text-[11px] font-semibold mt-3 pt-2 border-t ${
            netProfit >= 0 ? "border-emerald-200 text-emerald-700" : "border-red-200 text-red-700"
          }`}>
            {netProfit >= 0 ? "✓ Rentabilité positive" : "⚠ Solde déficitaire sur la période"}
          </p>
        </div>

        {/* Unpaid / Recovery Gaps */}
        <div className="rounded-2xl bg-white border border-amber-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-amber-600 uppercase tracking-widest">Impayés du Mois</h2>
              <Link
                href="/list/payments-partial"
                className="text-[10px] text-amber-600 hover:text-amber-800 font-bold flex items-center gap-0.5 hover:underline"
              >
                File de Recouvrement <ArrowUpRight size={12} />
              </Link>
            </div>
            <h1 className="text-3xl font-black text-slate-800 mt-2">
              {unpaidTeachers.length + unpaidStudents.length} <span className="text-sm font-semibold text-slate-400">dossiers</span>
            </h1>
          </div>
          <p className="text-[11px] text-amber-700 mt-3 pt-2 border-t border-slate-100 font-medium">
            {unpaidTeachers.length} enseignant(s) · {unpaidStudents.length} élève(s)
          </p>
        </div>
      </div>

      {/* CHART */}
      <FinanceChart data={chartData} />

      {/* TRANSACTIONS BREAKDOWN */}
      <div className="flex gap-6 flex-col lg:flex-row">
        {/* EXPENSES */}
        {type !== "income" && (
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Dépenses ({periodLabel})</h2>
                <p className="text-xs text-slate-400">{periodExpenses.length} décaissements enregistrés</p>
              </div>
              <ExportButton
                data={expenseRows as any}
                headers={["Title", "Nature", "Amount", "Category", "Date"]}
                filename="depenses"
              />
            </div>
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {periodExpenses.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">Aucune dépense enregistrée sur cette période.</p>
              ) : (
                periodExpenses.map((e) => {
                  const nature = getExpenseNature(e);
                  return (
                    <div
                      key={e.id}
                      className="flex justify-between items-center border-b border-slate-50 pb-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                            nature === "salary"
                              ? "bg-emerald-50 text-emerald-600"
                              : nature === "advance"
                              ? "bg-purple-50 text-purple-600"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {nature === "salary" ? (
                            <Banknote size={14} />
                          ) : nature === "advance" ? (
                            <TrendingUp size={14} />
                          ) : (
                            <Receipt size={14} />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700 text-xs">{e.title}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                nature === "salary"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : nature === "advance"
                                  ? "bg-purple-50 text-purple-700 border border-purple-200"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {nature === "salary" ? "Salaire" : nature === "advance" ? "Avance" : e.category}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(e.date).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span
                        className={`font-bold text-xs px-2 py-1 rounded-full ${
                          nature === "salary"
                            ? "text-emerald-700 bg-emerald-50"
                            : nature === "advance"
                            ? "text-purple-700 bg-purple-50"
                            : "text-rose-500 bg-rose-50"
                        }`}
                      >
                        -{e.amount.toLocaleString("en-US").replace(/,/g, " ")} DT
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* INCOMES */}
        {type !== "expense" && (
          <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Revenus ({periodLabel})</h2>
                <p className="text-xs text-slate-400">{periodIncomes.length} encaissements enregistrés</p>
              </div>
              <ExportButton
                data={incomeRows as any}
                headers={["Title", "Amount", "Category", "Date"]}
                filename="revenus"
              />
            </div>
            <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
              {periodIncomes.length === 0 ? (
                <p className="text-slate-400 text-sm py-6 text-center">Aucun revenu trouvé sur cette période.</p>
              ) : (
                periodIncomes.map((i) => (
                  <div
                    key={i.id}
                    className="flex justify-between items-center border-b border-slate-50 pb-3 hover:bg-slate-50/60 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-slate-700 text-xs">{i.title}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {i.category} · {new Date(i.date).toLocaleDateString("fr-FR")}
                      </p>
                    </div>
                    <span className="text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-full">
                      +{i.amount.toLocaleString("en-US").replace(/,/g, " ")} DT
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
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            Enseignants en attente de salaire ({currentMonth})
          </h2>
          {unpaidTeachers.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ Tous les enseignants sont payés ce mois-ci !</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
              {unpaidTeachers.map((t) => (
                <Link
                  key={t.id}
                  href={`/list/teachers/${t.id}`}
                  className="flex justify-between items-center border-b border-slate-50 pb-2 hover:bg-slate-50 px-2 rounded-md"
                >
                  <span className="text-xs font-semibold text-slate-700">
                    {t.name} {t.surname}
                  </span>
                  <span className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-1 rounded-full">
                    {t.salary.toLocaleString("en-US").replace(/,/g, " ")} DT dû
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 bg-white p-6 rounded-2xl shadow-sm border-l-4 border-amber-400">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Élèves en attente de paiement ({currentMonth})
          </h2>
          {unpaidStudents.length === 0 ? (
            <p className="text-emerald-600 text-sm font-medium">✓ Tous les élèves sont à jour ce mois-ci !</p>
          ) : (
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-2">
              {unpaidStudents.map((s: any) => {
                const tuitionAmount = s.level?.tuitionFee || 80 + (s.level?.level || 1) * 20;
                return (
                  <Link
                    key={s.id}
                    href={`/list/students/${s.id}`}
                    className="flex justify-between items-center border-b border-slate-50 pb-2 hover:bg-slate-50 px-2 rounded-md"
                  >
                    <span className="text-xs font-semibold text-slate-700">
                      {s.name} {s.surname}
                    </span>
                    <span className="text-xs text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded-full">
                      {tuitionAmount.toLocaleString("en-US").replace(/,/g, " ")} DT dû
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
