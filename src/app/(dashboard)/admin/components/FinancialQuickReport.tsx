"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { getFinancialReportData, getAIFinancialReport, ReportData } from "../actions";

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
        className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-6 print:hidden no-print"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 tracking-tight uppercase opacity-50">
            Financial Quick-Report
          </h2>
          <span className="text-xs font-bold px-2 py-1 bg-slate-100 text-slate-500 rounded-full">
            {month}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-end justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-2xl font-black text-slate-800 tracking-tighter italic">
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

          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-slate-400">Arrears/Unpaid</span>
              <span className="text-rose-500 font-bold">${unpaid.toLocaleString()}</span>
            </div>
            <button 
              onClick={handlePrint}
              className="group w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-slate-200"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
              Print Full Fiscal Review
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default FinancialQuickReport;
