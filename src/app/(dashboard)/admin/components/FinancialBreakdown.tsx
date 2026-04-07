"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface BreakdownItem {
  name: string;
  value: number;
  type: 'income' | 'expense';
}

interface FinancialBreakdownProps {
  data: BreakdownItem[];
}

const FinancialBreakdown: React.FC<FinancialBreakdownProps> = ({ data }) => {
  const incomeItems = data.filter(d => d.type === 'income').sort((a, b) => b.value - a.value);
  const expenseItems = data.filter(d => d.type === 'expense').sort((a, b) => b.value - a.value);

  const totalIncome = incomeItems.reduce((acc, curr) => acc + curr.value, 0);
  const totalExpense = expenseItems.reduce((acc, curr) => acc + curr.value, 0);

  // Create unified rows by taking the max length of both lists
  const rowCount = Math.max(incomeItems.length, expenseItems.length);
  const rows = Array.from({ length: rowCount }, (_, i) => ({
    income: incomeItems[i] || null,
    expense: expenseItems[i] || null,
  }));

  const renderItem = (item: BreakdownItem | null, total: number, idx: number) => {
    const isIncome = item?.type === 'income';
    const color = isIncome ? 'bg-indigo-500' : 'bg-rose-500';
    const percentage = !item || total === 0 ? 0 : (item.value / total) * 100;

    return (
      <div className={`flex-1 flex flex-col gap-3 py-2 ${!item ? 'opacity-0 select-none' : ''}`}>
        {/* Row 1: Header (Label + Amount) - Fixed height ensures baseline alignment */}
        <div className="flex items-baseline justify-between h-5">
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className="text-[11px] font-black text-slate-800 tracking-tight uppercase truncate">
              {item?.name || 'Spacer'}
            </span>
            <span className="text-[8px] font-black text-slate-400 border border-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter bg-slate-50 flex-shrink-0">
              {item?.type || 'Empty'}
            </span>
          </div>
          <span className="text-sm font-black text-slate-800 tracking-tighter tabular-nums flex-shrink-0 ml-4">
            ${item ? Math.round(item.value).toLocaleString() : '000'}
          </span>
        </div>

        {/* Row 2: Visual (Progress Bar + Percentage) - Fixed height for horizontal synchronization */}
        <div className="flex items-center gap-4 h-4">
          <div className="flex-1 h-1.5 bg-slate-100/50 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "circOut", delay: idx * 0.05 }}
              className={`h-full ${color} shadow-[0_0_8px_rgba(31,41,55,0.1)]`} 
            />
          </div>
          <span className="text-[10px] font-black text-slate-400 w-8 text-right tabular-nums tracking-tighter">
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-10 h-full">
      <div className="flex items-center justify-between border-b border-slate-50 pb-6">
         <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black text-slate-800 tracking-widest uppercase opacity-40">
                Category Breakdown
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Symmetrical Financial Distribution
            </p>
         </div>
         <div className="flex items-center gap-6">
            <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</span>
            </span>
            <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expense</span>
            </span>
         </div>
      </div>

      <div className="flex flex-col gap-8">
        {rows.map((row, idx) => (
          <div key={idx} className="grid grid-cols-1 lg:grid-cols-2 gap-x-16 gap-y-0 items-start relative">
            {renderItem(row.income, totalIncome, idx)}
            
            {/* Center Alignment Guide (Visible only in high-res) */}
            <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-10 bg-slate-100 opacity-30" />
            
            {renderItem(row.expense, totalExpense, idx)}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FinancialBreakdown;
