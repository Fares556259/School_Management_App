"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface KpiCardProps {
  title: string;
  value: number;
  prevValue: number;
  isCurrency?: boolean;
  isPercentage?: boolean;
  inverseColors?: boolean;
  compareLabel?: string;
  icon: string;
  accentColor: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  title, 
  value, 
  prevValue, 
  isCurrency = true, 
  isPercentage = false,
  inverseColors = false,
  compareLabel = "vs last period",
  icon,
  accentColor,
}) => {
  const diff = prevValue === 0 ? 0 : ((value - prevValue) / Math.abs(prevValue)) * 100;
  const isPositive = diff >= 0;
  
  // For expenses, positive diff is "bad" (red), negative is "good" (green)
  let trendColor = isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  if (inverseColors) {
    trendColor = isPositive ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';
  }

  const formattedValue = isPercentage 
    ? `${value.toFixed(1)}%` 
    : `${isCurrency ? '$' : ''}${Math.round(value).toLocaleString()}`;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow"
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
        <span className={`w-8 h-8 rounded-xl ${accentColor} flex items-center justify-center text-sm`}>{icon}</span>
      </div>
      
      {/* Value */}
      <h3 className="text-3xl font-black text-slate-800 tracking-tight leading-none">
        {formattedValue}
      </h3>
      
      {/* Trend */}
      <div className="flex items-center gap-2">
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${trendColor}`}>
          {isPositive ? '↑' : '↓'} {Math.abs(Math.round(diff))}%
        </span>
        <span className="text-[11px] text-slate-400 font-medium">{compareLabel}</span>
      </div>
    </motion.div>
  );
};

interface FinancialKpiSectionProps {
  currentIncome: number;
  prevIncome: number;
  currentExpense: number;
  prevExpense: number;
  currentBalance: number;
  prevBalance: number;
  isCustomRange?: boolean;
}

const FinancialKpiSection: React.FC<FinancialKpiSectionProps> = ({
  currentIncome,
  prevIncome,
  currentExpense,
  prevExpense,
  currentBalance,
  prevBalance,
  isCustomRange = false
}) => {
  const currentMargin = currentIncome === 0 ? 0 : (currentBalance / currentIncome) * 100;
  const prevMargin = prevIncome === 0 ? 0 : (prevBalance / prevIncome) * 100;

  const compareLabel = isCustomRange ? "vs prev. month" : "vs last period";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard 
        title="Net Balance" 
        value={currentBalance} 
        prevValue={prevBalance} 
        compareLabel={compareLabel}
        icon="💰"
        accentColor="bg-indigo-50"
      />
      <KpiCard 
        title="Total Revenue" 
        value={currentIncome} 
        prevValue={prevIncome} 
        compareLabel={compareLabel}
        icon="📈"
        accentColor="bg-emerald-50"
      />
      <KpiCard 
        title="Total Expenses" 
        value={currentExpense} 
        prevValue={prevExpense} 
        inverseColors 
        compareLabel={compareLabel}
        icon="📉"
        accentColor="bg-rose-50"
      />
      <KpiCard 
        title="Profit Margin" 
        value={currentMargin} 
        prevValue={prevMargin} 
        isCurrency={false} 
        isPercentage 
        compareLabel={compareLabel}
        icon="🎯"
        accentColor="bg-amber-50"
      />
    </div>
  );
};

export default FinancialKpiSection;
