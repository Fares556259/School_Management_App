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
  
  const isGood = inverseColors ? !isPositive : isPositive;
  const statusColor = isGood ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50';
  const strokeColor = isGood ? '#10b981' : '#f43f5e';

  const formattedValue = `\u202A${isPercentage 
    ? `${value < 0 ? '-' : ''}${Math.abs(value).toFixed(1)}%` 
    : `${value < 0 ? '-' : ''}${Math.abs(Math.round(value)).toLocaleString()}${isCurrency ? ' DT' : ''}`}\u202C`;

  // Mini line chart
  const generatePath = () => {
    return isPositive 
      ? "M 0,20 L 10,18 L 20,22 L 30,15 L 40,18 L 50,10 L 60,12"
      : "M 0,10 L 10,12 L 20,8 L 30,15 L 40,12 L 50,20 L 60,18";
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-[#ffffff] p-4 rounded-[8px] border border-[#d8d8d8] flex flex-col group transition-all"
    >
      <div className="flex justify-between items-start mb-1">
        <span className="text-[13px] font-medium text-[#5a5a5a]">
          {title}
        </span>
        {prevValue !== 0 && Math.abs(Math.round(diff)) > 0 && (
          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[11px] font-medium ${statusColor}`}>
            <span>{isPositive ? '↑' : '↓'}</span>
            <span>{Math.abs(Math.round(diff))}%</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between gap-4 mt-1">
        <h3 className="text-[24px] font-semibold text-[#080808] tracking-[-0.5px] leading-none">
          {formattedValue}
        </h3>
      </div>
      
      <span className="text-[11px] font-medium text-[#898989] mt-2 block">
        {compareLabel}
      </span>
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
        title={t.adminWidgets.revenueGap}
        value={revenueGap} 
        prevValue={0} 
        inverseColors
        compareLabel={t.adminWidgets.allocatedToJune}
      />
    </div>
  );
};

export default FinancialKpiSection;
