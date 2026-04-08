"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-[480px]">
      {/* Header with Integrated Toggle */}
      <div className="p-8 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight leading-none">Fiscal Intelligence</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Unified Income & Operational Expenses</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Segmented View Toggle */}
          <div className="flex p-1 bg-slate-50 rounded-xl border border-slate-100">
            <button
              onClick={() => setViewMode('chart')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'chart' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Visual
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                viewMode === 'list' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Detailed
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
