"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, Receipt, TrendingUp, Percent, Activity } from 'lucide-react';
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
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, transition: { duration: 0.2 } }}
      className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-100 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)] flex flex-col justify-between hover:shadow-md hover:border-slate-200/80 transition-all min-h-[108px] h-full"
    >
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <span className="text-[13px] sm:text-[14px] font-medium text-slate-500 truncate">
          {title}
        </span>
      </div>
      
      <div className="flex flex-col justify-end">
        <div className="flex items-baseline flex-wrap">
          <span className={`text-xl sm:text-[22px] font-bold tracking-tight ${isNegative ? 'text-rose-600' : 'text-slate-800'}`}>
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
    </motion.div>
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
  uncollectedTuition?: number;
  revenueGap?: number;
  isCustomRange?: boolean;
}

export default function FinancialKpiSection({
  currentIncome,
  currentExpense,
  currentBalance,
  collectedTuition,
  totalTuitionDue,
  uncollectedTuition,
  revenueGap = 0,
}: FinancialKpiSectionProps) {
  const { t } = useLanguage();
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
  const displayCollected = (collectedTuition !== undefined && collectedTuition > 0)
    ? collectedTuition 
    : currentIncome;

  const displayTotalDue = (uncollectedTuition !== undefined && uncollectedTuition > 0)
    ? displayCollected + uncollectedTuition
    : (totalTuitionDue !== undefined && totalTuitionDue > 0
        ? Math.max(totalTuitionDue, displayCollected)
        : (revenueGap > 0 ? displayCollected + revenueGap : displayCollected));

  const recoveryRate = displayTotalDue > 0
    ? Math.min(100, Math.round((displayCollected / displayTotalDue) * 100))
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 mb-4">
      {/* 1. Chiffre d'affaires */}
      <KpiCard 
        icon={<Wallet className="w-4 h-4 text-emerald-600 stroke-[2.2]" />}
        iconBg="bg-emerald-50 text-emerald-600"
        title={t.adminWidgets.turnover || "Chiffre d'affaires"}
        value={formatMoney(currentIncome)}
        suffix={currency}
      />

      {/* 2. Dépenses */}
      <KpiCard 
        icon={<Receipt className="w-4 h-4 text-rose-500 stroke-[2.2]" />}
        iconBg="bg-rose-50 text-rose-500"
        title={t.adminWidgets.expenses || "Dépenses"}
        value={formatMoney(currentExpense)}
        suffix={currency}
      />

      {/* 3. Bénéfice net */}
      <KpiCard 
        icon={<TrendingUp className="w-4 h-4 text-sky-500 stroke-[2.2]" />}
        iconBg="bg-sky-50 text-sky-500"
        title={t.adminWidgets.netProfit || "Bénéfice net"}
        value={formatMoney(currentBalance)}
        suffix={currency}
        isNegative={currentBalance < 0}
      />

      {/* 4. Marge bénéficiaire */}
      <KpiCard 
        icon={<Percent className="w-4 h-4 text-amber-500 stroke-[2.2]" />}
        iconBg="bg-amber-50 text-amber-500"
        title={t.adminWidgets.profitMargin || "Marge bénéficiaire"}
        value={`${isMarginNegative ? '-' : ''}${formattedMargin}`}
        suffix="%"
        isNegative={isMarginNegative}
      />

      {/* 5. Taux de recouvrement */}
      <KpiCard 
        icon={<Activity className="w-4 h-4 text-purple-600 stroke-[2.2]" />}
        iconBg="bg-purple-50 text-purple-600"
        title={t.adminWidgets.recoveryRate || "Taux de recouvrement"}
        value={formatMoney(displayCollected)}
        suffix={`${currency}/${formatMoney(displayTotalDue)}`}
        extra={
          <div className="w-full mt-2">
            <div className="w-full bg-purple-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-purple-600 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, recoveryRate))}%` }}
              />
            </div>
            <div className="flex justify-end mt-1">
              <span className="text-[11px] font-medium text-purple-600">
                {recoveryRate}%
              </span>
            </div>
          </div>
        }
      />
    </div>
  );
}
