"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { getFinancialReportData, getAIFinancialReport, ReportData } from "../actions";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FinancialQuickReportProps {
  income: number;
  expense: number;
  unpaid: number;
  month: string;
}

const FinancialQuickReport: React.FC<FinancialQuickReportProps> = ({
  income,
  expense,
  unpaid,
  month,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const balance = income - expense;
  const healthScore = income > 0 ? Math.min(100, Math.round(((income - expense) / income) * 100)) : 0;

  const handlePrint = () => {
    // Generate the URL safe month label (e.g. "April 2026" -> "April_2026")
    const urlSafeMonth = month.replace(' ', '_');
    window.open(`/admin/audit/${encodeURIComponent(urlSafeMonth)}`, '_blank');
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-6 print:hidden no-print"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase opacity-50">
                Financial Quick-Report
            </h2>
            {isCollapsed && (
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                    {month}
                </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isCollapsed && (
                <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
                    {month}
                </span>
            )}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
            >
                {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
            {!isCollapsed && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                >
                    <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-black text-slate-800 tracking-tight">
                ${balance.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 font-medium">Net Monthly Performance</span>
            </div>
            <div className="text-right">
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${healthScore > 20 ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                {healthScore}% Margin
              </span>
            </div>
          </div>

          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-indigo-500 transition-all duration-1000" 
              style={{ width: `${Math.min(100, (income / (income + expense || 1)) * 100)}%` }} 
            />
            <div 
              className="h-full bg-rose-400 transition-all duration-1000" 
              style={{ width: `${Math.min(100, (expense / (income + expense || 1)) * 100)}%` }} 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Income</span>
              <span className="text-sm font-black text-slate-700 tracking-tight">${income.toLocaleString()}</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl flex flex-col gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Expense</span>
              <span className="text-sm font-black text-slate-700 tracking-tight">${expense.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100">
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-slate-800">${Math.round(balance / 1000)}k</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Profit</span>
            </div>
            <div className="flex flex-col items-center border-l border-r border-slate-100">
              <span className="text-sm font-black text-rose-500">${Math.round(unpaid / 1000)}k</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Arrears</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm font-black text-indigo-500">{healthScore}%</span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Margin</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 mt-4">
            <button 
              onClick={handlePrint}
              className="group w-full py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-slate-200"
            >
              <span className="text-lg group-hover:scale-110 transition-transform">📊</span>
              Print Full Fiscal Review
            </button>
          </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default FinancialQuickReport;
