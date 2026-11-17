"use client";

import Link from 'next/link';
import { Plus, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';

export default function QuickActionBar() {
  const { t, locale } = useLanguage();

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 [&::-webkit-details-marker]:hidden">
        <Plus size={16} aria-hidden="true" />
        {locale === 'fr' ? 'Nouvelle opération' : locale === 'ar' ? 'عملية جديدة' : 'New transaction'}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <div className="absolute end-0 z-30 mt-2 grid min-w-max gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
        <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/list/incomes?add=true">{t.adminWidgets.addIncome}</Link>
        <Link className="rounded-md px-3 py-2 text-sm hover:bg-slate-100" href="/list/expenses?add=true">{t.adminWidgets.addExpense}</Link>
      </div>
    </details>
  );
}
