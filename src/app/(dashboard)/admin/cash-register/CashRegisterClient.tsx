"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Plus, Printer, RefreshCw, Wallet } from "lucide-react";
import CrudFormModal from "@/components/CrudFormModal";
import { useLanguage } from "@/lib/translations/LanguageContext";

const copy = {
  fr: { subtitle: "Recettes, dépenses et solde de la journée.", date: "Date de caisse", today: "Aujourd’hui", refresh: "Actualiser", print: "Imprimer le livre A4", download: "Télécharger le PDF", income: "Recettes", expense: "Dépenses", net: "Solde net du jour", addIncome: "Ajouter une recette", addExpense: "Ajouter une dépense", operations: "Opérations", time: "Heure", description: "Description", category: "Catégorie", amount: "Montant", empty: "Aucune opération à cette date.", ledgers: "Registres" },
  en: { subtitle: "See the day’s income, expenses and net balance.", date: "Register date", today: "Today", refresh: "Refresh", print: "Print A4 cashbook", download: "Download PDF", income: "Income", expense: "Expenses", net: "Daily net balance", addIncome: "Add income", addExpense: "Add expense", operations: "Transactions", time: "Time", description: "Description", category: "Category", amount: "Amount", empty: "No transactions on this date.", ledgers: "Ledgers" },
  ar: { subtitle: "مداخيل اليوم ومصاريفه ورصيده الصافي.", date: "تاريخ الخزينة", today: "اليوم", refresh: "تحديث", print: "طباعة دفتر الخزينة A4", download: "تنزيل PDF", income: "المداخيل", expense: "المصاريف", net: "صافي رصيد اليوم", addIncome: "إضافة مدخول", addExpense: "إضافة مصروف", operations: "العمليات", time: "الوقت", description: "البيان", category: "الصنف", amount: "المبلغ", empty: "لا توجد عمليات في هذا التاريخ.", ledgers: "السجلات" },
};

type Category = { value: string; label: string };
type Operation = {
  id: number;
  date: string;
  type: "income" | "expense";
  title: string;
  category: string;
  amount: number;
};

export default function CashRegisterClient({ day, today, totalIncome, totalExpenses, net, operations, incomeCategories, expenseCategories }: {
  day: string;
  today: string;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  operations: Operation[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}) {
  const { t, locale } = useLanguage();
  const labels = copy[locale];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 3 });
  const dateLabel = new Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "Africa/Tunis" }).format(new Date(day));
  const clock = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Tunis" });
  const pdf = `/api/admin/cash-register/pdf?date=${day}`;

  const refresh = () => startTransition(() => router.refresh());
  const selectDay = (value: string) => {
    if (!value) return;
    startTransition(() => router.push(value === today ? "/admin/cash-register" : `/admin/cash-register?date=${value}`));
  };
  const metrics = [
    { label: labels.net, value: net, icon: Wallet },
    { label: labels.income, value: totalIncome, icon: ArrowDownLeft },
    { label: labels.expense, value: totalExpenses, icon: ArrowUpRight },
  ];

  return (
    <section className="mx-auto max-w-6xl space-y-5" aria-busy={pending}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900 md:text-3xl">{t.menu["cash-register"]}</h2>
          <p className="mt-1 text-sm text-ink-600">{labels.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a className="ss-button-primary" href={pdf} target="_blank" rel="noopener noreferrer">
            <Printer size={16} aria-hidden /> {labels.print}
          </a>
          <a className="ss-button-secondary" href={`${pdf}&download=1`}>
            <Download size={16} aria-hidden /> {labels.download}
          </a>
        </div>
      </header>

      <div className="rounded-2xl border border-ink-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label={labels.date} value={day} max={today} onChange={(event) => selectDay(event.target.value)} disabled={pending}
              className="min-h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-900" />
            {day !== today && <button type="button" className="ss-button-secondary" onClick={() => selectDay(today)} disabled={pending}>{labels.today}</button>}
            <button type="button" onClick={refresh} disabled={pending} aria-label={labels.refresh} title={labels.refresh} className="ss-icon-button">
              <RefreshCw size={17} aria-hidden className={pending ? "motion-safe:animate-spin" : undefined} />
            </button>
          </div>
          <span className="text-sm text-ink-600 first-letter:uppercase">{dateLabel}</span>
        </div>
        <dl className="grid divide-y divide-ink-200 sm:grid-cols-3 sm:divide-y-0">
          {metrics.map(({ label, value, icon: Icon }, index) => (
            <div key={label} className={`px-4 py-4 sm:px-6 ${index ? "sm:border-s sm:border-ink-200" : "bg-ink-50/60"}`}>
              <dt className="flex items-center gap-2 text-sm font-medium text-ink-600"><Icon size={16} aria-hidden />{label}</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink-900"><bdi>{format.format(value)}</bdi> <span className="text-sm font-medium text-ink-600">DT</span></dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-200 px-4 py-4 sm:px-6">
          <h3 className="text-base font-semibold text-ink-900">{labels.operations} <span className="ms-1 text-sm font-normal tabular-nums text-ink-600">({format.format(operations.length)})</span></h3>
          {day === today && (
            <div className="flex flex-wrap gap-2">
              <CrudFormModal entity="income" mode="create" data={{ date: day }} relatedData={{ category: incomeCategories }} waitForSave onSuccess={refresh}
                trigger={<button type="button" className="ss-button-secondary"><Plus size={16} aria-hidden />{labels.addIncome}</button>} />
              <CrudFormModal entity="expense" mode="create" data={{ date: day }} relatedData={{ category: expenseCategories }} waitForSave onSuccess={refresh}
                trigger={<button type="button" className="ss-button-secondary"><Plus size={16} aria-hidden />{labels.addExpense}</button>} />
            </div>
          )}
        </div>

        {operations.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-ink-50 text-ink-600">
                <tr>
                  <th scope="col" className="px-4 py-3 text-start font-medium sm:px-6">{labels.time}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{labels.description}</th>
                  <th scope="col" className="px-4 py-3 text-start font-medium">{labels.category}</th>
                  <th scope="col" className="px-4 py-3 text-end font-medium sm:px-6">{labels.amount}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {operations.map((row) => (
                  <tr key={`${row.type}-${row.id}`} className="hover:bg-ink-50/50">
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600 sm:px-6">{clock.format(new Date(row.date))}</td>
                    <td className="px-4 py-3 font-medium text-ink-900"><bdi>{row.title}</bdi><span className="block text-xs font-normal text-ink-600">{labels[row.type]}</span></td>
                    <td className="px-4 py-3 text-ink-600"><bdi>{row.category}</bdi></td>
                    <td className="whitespace-nowrap px-4 py-3 text-end font-medium tabular-nums text-ink-900 sm:px-6"><bdi>{format.format(row.type === "expense" ? -row.amount : row.amount)} DT</bdi></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-4 py-12 text-center text-sm text-ink-600">{labels.empty}</p>}
      </div>

      <nav aria-label={labels.ledgers} className="flex flex-wrap gap-4 text-sm font-semibold text-brand-700">
        <Link href="/list/incomes" className="hover:underline">{t.menu.incomes}</Link>
        <Link href="/list/expenses" className="hover:underline">{t.menu.expenses}</Link>
      </nav>
    </section>
  );
}
