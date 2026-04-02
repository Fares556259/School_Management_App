"use client";

import React, { useState } from 'react';
import { ArrowUpRight, ArrowDownLeft, Filter, History, Search, ChevronUp } from 'lucide-react';

interface Transaction {
  type: 'income' | 'expense';
  title: string;
  amount: number;
  date: Date;
  effectiveDate?: Date;
  source: string;
}

interface RecentTransactionsProps {
  transactions: Transaction[];
}

const RecentTransactions = ({ transactions }: RecentTransactionsProps) => {
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  const filteredTxs = transactions.filter(tx => 
    filter === 'all' ? true : tx.type === filter
  );

  const displayTxs = isExpanded ? filteredTxs : filteredTxs.slice(0, 10);

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 h-full flex flex-col group">
      {/* 1. HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-500 flex items-center justify-center">
             <History size={16} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Recent Activity</h3>
        </div>
        <div className="flex bg-slate-50 p-1 rounded-lg border border-slate-100">
           {['all', 'income', 'expense'].map((f) => (
             <button
               key={f}
               onClick={() => setFilter(f as any)}
               className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                 filter === f ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
               }`}
             >
               {f}
             </button>
           ))}
        </div>
      </div>

      {/* 2. FEED */}
      <div className="flex-1 overflow-y-auto space-y-3 no-scrollbar pr-1">
        {displayTxs.map((tx, idx) => {
          const isDifferentDate = tx.effectiveDate && 
            tx.effectiveDate.toDateString() !== tx.date.toDateString();

          return (
            <div key={idx} className="flex justify-between items-center p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-50 hover:border-slate-100 transition-all group/item">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border ${
                  tx.type === 'income' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-rose-50 text-rose-500 border-rose-100'
                }`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-700 leading-tight group-hover/item:text-indigo-600 transition-colors uppercase tracking-tight">{tx.title}</span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400 uppercase tracking-tighter">
                      {tx.source}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                      Logged: {tx.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    {isDifferentDate && (
                      <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest bg-indigo-50 px-1 rounded">
                        Eff: {tx.effectiveDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-black tracking-tighter ${tx.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {tx.type === 'income' ? '+' : '-'}${tx.amount.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
        {filteredTxs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
             <Search size={32} className="mb-2 text-slate-400" />
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No matching activity</p>
          </div>
        )}
      </div>

      {/* 3. FOOTER */}
      <div className="mt-6 pt-4 border-t border-slate-50">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-3 text-xs font-black text-indigo-500 hover:text-white hover:bg-indigo-500 border border-indigo-100 rounded-xl transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-sm"
        >
           {isExpanded ? "Show Less" : "View Full Statement"} 
           {isExpanded ? <ChevronUp size={12} /> : <ArrowRight size={12} />}
        </button>
      </div>
    </div>
  );
};

const ArrowRight = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default RecentTransactions;
