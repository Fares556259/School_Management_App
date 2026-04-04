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
}

const KpiCard: React.FC<KpiCardProps> = ({ 
  title, 
  value, 
  prevValue, 
  isCurrency = true, 
  isPercentage = false,
  inverseColors = false 
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-2 relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <span className="text-4xl font-black italic tracking-tighter">KPI</span>
      </div>
      
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
        {title}
      </span>
      
      <div className="flex items-end justify-between gap-2">
        <h3 className="text-3xl font-black text-slate-800 tracking-tighter italic">
          {formattedValue}
        </h3>
        
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase italic ${statusColor}`}>
          <span>{isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(Math.round(diff))}%</span>
        </div>
      </div>
      
      <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase italic opacity-60">
        vs last period
      </p>
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
}

const FinancialKpiSection: React.FC<FinancialKpiSectionProps> = ({
  currentIncome,
  prevIncome,
  currentExpense,
  prevExpense,
  currentBalance,
  prevBalance
}) => {
  const currentMargin = currentIncome === 0 ? 0 : (currentBalance / currentIncome) * 100;
  const prevMargin = prevIncome === 0 ? 0 : (prevBalance / prevIncome) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <KpiCard 
        title="Net Balance" 
        value={currentBalance} 
        prevValue={prevBalance} 
      />
      <KpiCard 
        title="Total Revenue" 
        value={currentIncome} 
        prevValue={prevIncome} 
      />
      <KpiCard 
        title="Total Expenses" 
        value={currentExpense} 
        prevValue={prevExpense} 
        inverseColors 
      />
      <KpiCard 
        title="Profit Margin" 
        value={currentMargin} 
        prevValue={prevMargin} 
        isCurrency={false} 
        isPercentage 
      />
    </div>
  );
};

export default FinancialKpiSection;
