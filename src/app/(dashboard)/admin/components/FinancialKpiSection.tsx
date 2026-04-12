"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface KpiCardProps {
  title: string;
  value: number;
  prevValue: number;
  isCurrency?: boolean;
  isPercentage?: boolean;
  inverseColors?: boolean;
  compareLabel?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  title, 
  value, 
  prevValue, 
  isCurrency = true, 
  isPercentage = false,
  inverseColors = false,
  compareLabel = "vs last period"
}) => {
  const diff = prevValue === 0 ? 0 : ((value - prevValue) / Math.abs(prevValue)) * 100;
  const isPositive = diff >= 0;
  
  // For expenses, positive diff is "bad" (red), negative is "good" (green)
  let statusColor = isPositive ? 'text-emerald-500 bg-emerald-50' : 'text-rose-500 bg-rose-50';
  if (inverseColors) {
    statusColor = isPositive ? 'text-rose-500 bg-rose-50' : 'text-emerald-500 bg-emerald-50';
  }

  const formattedValue = isPercentage 
    ? `${value.toFixed(1)}%` 
    : `${isCurrency ? '$' : ''}${Math.round(value).toLocaleString()}`;

  // Simple SVG Sparkline based on trend
  const generatePath = () => {
    const points = isPositive 
      ? "0,20 10,18 20,22 30,15 40,18 50,10 60,12" // Upward trend
      : "0,10 10,12 20,8 30,15 40,12 50,20 60,18"; // Downward trend
    return points;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-1 relative overflow-hidden group transition-all hover:shadow-xl hover:shadow-indigo-50/50"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-70">
          {title}
        </span>
      </div>
      
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-3xl font-black text-slate-800 tracking-tight">
          {formattedValue}
        </h3>
        
        {/* Decorative Sparkline */}
        <div className="w-16 h-8 opacity-30 group-hover:opacity-100 transition-opacity">
            <svg viewBox="0 0 60 30" width="100%" height="100%" preserveAspectRatio="none">
                <path 
                    d={`M ${generatePath()}`} 
                    fill="none" 
                    stroke={isPositive ? '#10b981' : '#f43f5e'} 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />
            </svg>
        </div>
      </div>
      
      <div className="flex items-center gap-2 mt-3">
        <div className={`flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${statusColor}`}>
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(Math.round(diff))}%</span>
        </div>
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
          {compareLabel}
        </span>
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
  revenueGap: number;
  isCustomRange?: boolean;
}

const FinancialKpiSection: React.FC<FinancialKpiSectionProps> = ({
  currentIncome,
  prevIncome,
  currentExpense,
  prevExpense,
  currentBalance,
  prevBalance,
  revenueGap,
  isCustomRange = false
}) => {
  const { t } = useLanguage();
  
  const currentMargin = currentIncome === 0 ? 0 : (currentBalance / currentIncome) * 100;
  const prevMargin = prevIncome === 0 ? 0 : (prevBalance / prevIncome) * 100;

  const compareLabel = isCustomRange ? t.adminWidgets.vsPrevMonth : t.adminWidgets.vsLastPeriod;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
      <KpiCard 
        title={t.adminWidgets.netBalance}
        value={currentBalance} 
        prevValue={prevBalance} 
        compareLabel={compareLabel}
      />
      <KpiCard 
        title={t.adminWidgets.totalRevenue}
        value={currentIncome} 
        prevValue={prevIncome} 
        compareLabel={compareLabel}
      />
      <KpiCard 
        title={t.adminWidgets.totalExpenses}
        value={currentExpense} 
        prevValue={prevExpense} 
        inverseColors 
        compareLabel={compareLabel}
      />
      <KpiCard 
        title={t.adminWidgets.profitMargin}
        value={currentMargin} 
        prevValue={prevMargin} 
        isCurrency={false} 
        isPercentage 
        compareLabel={compareLabel}
      />
      <KpiCard 
        title="Revenue Gap (Lost)"
        value={revenueGap} 
        prevValue={0} 
        inverseColors
        compareLabel="Allocated to June"
      />
    </div>
  );
};

export default FinancialKpiSection;
