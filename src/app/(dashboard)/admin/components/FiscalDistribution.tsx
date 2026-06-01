"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/translations/LanguageContext';
import FiscalBarChart from './FiscalBarChart';
import FinancialBreakdown from './FinancialBreakdown';

interface BreakdownItem {
  name: string;
  value: number;
  type: 'income' | 'expense';
}

interface FiscalDistributionProps {
  incomeData: { name: string, value: number, type: 'income' | 'expense' }[];
  expenseData: { name: string, value: number, type: 'income' | 'expense' }[];
  fullBreakdown: BreakdownItem[];
  timeFilter: string;
}

const FiscalDistribution: React.FC<FiscalDistributionProps> = ({
  incomeData,
  expenseData,
  fullBreakdown,
  timeFilter
}) => {
  const [viewMode, setViewMode] = useState<'chart' | 'list'>('chart');
  const { t } = useLanguage();

  return (
    <div className="bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] shadow-sm flex flex-col overflow-hidden h-[480px]">
      {/* Header with Integrated Toggle */}
      <div className="p-6 border-b border-[#d8d8d8] flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-[16px] font-semibold text-[#080808] tracking-[-0.2px]">{t.fiscalDistribution.title}</h2>
          <p className="text-[11px] text-[#5a5a5a] font-medium uppercase tracking-widest mt-1">{t.fiscalDistribution.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented View Toggle */}
          <div className="flex p-1 bg-[#f9f9f9] rounded-[6px] border border-[#d8d8d8]">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-4 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${
                viewMode === 'chart' 
                ? 'bg-[#ffffff] text-[#080808] shadow-sm border border-[#d8d8d8]' 
                : 'text-[#5a5a5a] hover:text-[#080808] border border-transparent'
              }`}
            >
              {t.fiscalDistribution.visual}
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${
                viewMode === 'list' 
                ? 'bg-[#ffffff] text-[#080808] shadow-sm border border-[#d8d8d8]' 
                : 'text-[#5a5a5a] hover:text-[#080808] border border-transparent'
              }`}
            >
              {t.fiscalDistribution.detailed}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Content Area - Fixed Height with Internal Scroll */}
      <div className="flex-1 min-h-0 relative">
        <AnimatePresence mode="wait">
          {viewMode === 'chart' ? (
            <motion.div
              key="chart"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="p-8 h-full w-full"
            >
              <FiscalBarChart 
                  incomeData={incomeData}
                  expenseData={expenseData}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="px-8 pb-8 h-full overflow-y-auto custom-scrollbar"
            >
              <FinancialBreakdown data={fullBreakdown} hideCard />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default FiscalDistribution;
