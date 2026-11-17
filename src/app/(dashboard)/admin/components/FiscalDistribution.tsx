"use client";

import { useLanguage } from '@/lib/translations/LanguageContext';

type Category = { name: string; value: number };

function CategoryBreakdown({ title, items, tone }: { title: string; items: Category[]; tone: string }) {
  const { t, locale } = useLanguage();
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'TND', currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 3 });
  const totals = new Map<string, number>();
  for (const item of items) totals.set(item.name, (totals.get(item.name) ?? 0) + item.value);
  const ranked = Array.from(totals, ([name, value]) => ({ name, value }))
    .filter(item => item.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const total = ranked.reduce((sum, item) => sum + item.value, 0);
  const main = ranked.slice(0, 5);
  const other = ranked.slice(5);
  const otherTotal = other.reduce((sum, item) => sum + item.value, 0);
  const rows = other.length ? [...main, { name: t.fiscalDistribution.other, value: otherTotal }] : main;
  const scale = rows.reduce((largest, item) => Math.max(largest, Math.abs(item.value)), 0);

  return (
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((item, index) => (
            <li key={index === 5 ? 'other' : `category-${item.name}`}>
              <div className="mb-1 flex flex-wrap justify-between gap-x-3 text-sm">
                <span className="min-w-0 break-words text-slate-700">{item.name}</span>
                <span className={`tabular-nums ${item.value < 0 ? 'text-rose-700' : 'text-slate-900'}`}>{money.format(item.value)}</span>
              </div>
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.abs(item.value) / scale * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-slate-500">{locale === 'fr' ? 'Aucune donnée pour cette période' : locale === 'ar' ? 'لا توجد بيانات لهذه الفترة' : 'No data for this period'}</p>}
      <div className="mt-4 flex justify-between gap-3 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
        <span>{t.fiscalDistribution.totalAmount}</span><span className="tabular-nums">{money.format(total)}</span>
      </div>
    </section>
  );
}

export default function FiscalDistribution({ incomeData, expenseData }: { incomeData: Category[]; expenseData: Category[] }) {
  const { t } = useLanguage();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CategoryBreakdown title={t.fiscalDistribution.revenueDistribution} items={incomeData} tone="bg-blue-600" />
      <CategoryBreakdown title={t.fiscalDistribution.expenseDistribution} items={expenseData} tone="bg-slate-500" />
    </div>
  );
}
