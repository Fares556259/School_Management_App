"use client";

import React from 'react';
import { Wallet, Receipt, TrendingUp, Activity } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string;
  suffix?: string;
  isNegative?: boolean;
  extra?: React.ReactNode;
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  icon,
  iconBg,
  title, 
  value, 
  suffix,
  isNegative = false,
  extra
}) => {
  return (
    <div
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-600">
          {title}
        </span>
      </div>
      
      <div className="flex flex-col justify-end">
        <div className="flex items-baseline flex-wrap">
          <span className={`break-words [overflow-wrap:anywhere] text-xl sm:text-[22px] font-semibold tabular-nums tracking-tight ${isNegative ? 'text-rose-700' : 'text-slate-900'}`}>
            {value}
          </span>
          {suffix && (
            <span className="ml-1.5 text-xs sm:text-[13px] font-semibold text-slate-400">
              {suffix}
            </span>
          )}
        </div>
        {extra}
      </div>
    </div>
  );
};

export interface FinancialKpiSectionProps {
  currentIncome: number;
  prevIncome?: number;
  currentExpense: number;
  prevExpense?: number;
  currentBalance: number;
  prevBalance?: number;
  studentCount?: number;
  collectedTuition?: number;
  totalTuitionDue?: number;
  recoveryPeriod: string;
}

export default function FinancialKpiSection({
  currentIncome,
  currentExpense,
  currentBalance,
  collectedTuition,
  totalTuitionDue,
  recoveryPeriod,
}: FinancialKpiSectionProps) {
  const { t, locale } = useLanguage();
  const currency = t.adminWidgets.currency || "TND";

  const formatMoney = (val: number, forceDecimals?: boolean) => {
    const sign = val < 0 ? '-' : '';
    const abs = Math.abs(val);
    
    if (forceDecimals || abs % 1 !== 0) {
      return `${sign}${abs.toLocaleString('fr-FR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3,
      })}`;
    }

    return `${sign}${abs.toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  // Card 4: Profit Margin (Marge bénéficiaire)
  const currentMargin = currentIncome === 0 ? 0 : (currentBalance / currentIncome) * 100;
  const isMarginNegative = currentMargin < 0;
  const formattedMargin = Math.abs(currentMargin) % 1 === 0 
    ? Math.abs(currentMargin).toFixed(0) 
    : Math.abs(currentMargin).toFixed(1);

  // Card 5: Collection / Recovery Rate
  const displayCollected = collectedTuition ?? 0;

  const displayTotalDue = totalTuitionDue ?? 0;
  const periodLabel = new Intl.DateTimeFormat(locale, {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(recoveryPeriod));
  const recoveryRate = displayTotalDue > 0 ? displayCollected / displayTotalDue : null;
  const formattedRate = recoveryRate === null ? '—' : new Intl.NumberFormat(locale, {
    style: 'percent', maximumFractionDigits: 1,
  }).format(recoveryRate);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1. Chiffre d'affaires */}
      <KpiCard 
        icon={<Wallet className="w-4 h-4 text-emerald-600 stroke-[2.2]" />}
        iconBg="bg-emerald-50 text-emerald-600"
        title={locale === 'ar' ? 'الإيرادات' : locale === 'fr' ? 'Revenus' : 'Revenue'}
        value={formatMoney(currentIncome)}
        suffix={currency}
      />

      {/* 2. Dépenses */}
      <KpiCard 
        icon={<Receipt className="w-4 h-4 text-slate-600" />}
        iconBg="bg-slate-100"
        title={t.adminWidgets.expenses || "Dépenses"}
        value={formatMoney(currentExpense)}
        suffix={currency}
      />

      {/* 3. Bénéfice net */}
      <KpiCard 
        icon={<TrendingUp className="w-4 h-4 text-sky-500 stroke-[2.2]" />}
        iconBg="bg-sky-50 text-sky-500"
        title={locale === 'ar' ? 'النتيجة الصافية' : locale === 'fr' ? 'Résultat net' : 'Net result'}
        value={formatMoney(currentBalance)}
        suffix={currency}
        isNegative={currentBalance < 0}
        extra={currentIncome > 0 ? <span className="mt-2 text-xs text-slate-600">{t.adminWidgets.profitMargin} · {isMarginNegative ? '−' : ''}{formattedMargin}%</span> : undefined}
      />

      {/* 5. Taux de recouvrement */}
      <KpiCard 
        icon={<Activity className="w-4 h-4 text-blue-700" />}
        iconBg="bg-blue-50"
        title={t.adminWidgets.recoveryRate || "Taux de recouvrement"}
        value={formattedRate}
        extra={
          <div className="mt-2 w-full">
            <p className="mb-2 text-xs font-medium text-slate-600">{periodLabel}</p>
            {recoveryRate !== null ? <progress aria-label={t.adminWidgets.recoveryRate} value={recoveryRate} max={1} className="block h-1.5 w-full accent-blue-700" /> : null}
            {recoveryRate !== null && <p className="mt-2 text-xs text-slate-600 tabular-nums">
              {formatMoney(displayCollected)} {currency} {locale === 'fr' ? 'encaissés sur' : locale === 'ar' ? 'محصّلة من' : 'collected of'} {formatMoney(displayTotalDue)} {currency}
            </p>}
          </div>
        }
      />
    </div>
  );
}
