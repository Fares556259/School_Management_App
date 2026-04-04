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
  const totalIncome = data.filter(d => d.type === 'income').reduce((acc, curr) => acc + curr.value, 0);
  const totalExpense = data.filter(d => d.type === 'expense').reduce((acc, curr) => acc + curr.value, 0);

  // Sorting: Highest value first
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-6">
      <div className="flex items-center justify-between">
         <h2 className="text-xl font-bold text-slate-800 tracking-tight">Category Breakdown</h2>
         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
            Detailed Metrics
         </span>
      </div>

      <div className="grid grid-cols-1 gap-y-6">
        {sortedData.map((item, idx) => {
          const total = item.type === 'income' ? totalIncome : totalExpense;
          const percentage = total === 0 ? 0 : (item.value / total) * 100;
          const color = item.type === 'income' ? 'bg-indigo-500' : 'bg-rose-500';

          return (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="flex items-center justify-between group"
            >
              <div className="flex items-center gap-4">
                <div className={`w-2 h-10 rounded-full ${color} opacity-20 group-hover:opacity-100 transition-opacity`} />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-slate-700 italic tracking-tight underline decoration-slate-100 decoration-2 underline-offset-4">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {item.type}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-lg font-black text-slate-800 tracking-tighter italic">
                  ${Math.round(item.value).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1 bg-slate-50 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${color}`} 
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">
                    {Math.round(percentage)}%
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default FinancialBreakdown;
