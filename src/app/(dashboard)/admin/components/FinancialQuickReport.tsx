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
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<ReportData | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const balance = income - expense;
  const healthScore = income > 0 ? Math.min(100, Math.round(((income - expense) / income) * 100)) : 0;

  const handlePrint = async () => {
    setLoading(true);
    try {
      const data = await getFinancialReportData(month);
      setReport(data);
      
      const analysis = await getAIFinancialReport(data);
      setAiAnalysis(analysis);

      // Wait for React to render the portal content
      setTimeout(() => {
        window.print();
        setLoading(false);
      }, 1200);
    } catch (err) {
      console.error("Failed to generate report:", err);
      setLoading(false);
    }
  };

  const ReportContent = report ? (
    <div id="print-report" className="hidden print:block absolute inset-0 bg-white z-[9999] px-20 py-24 overflow-visible min-h-screen w-full">
      {/* Header */}
      <div className="border-b-[10px] border-slate-900 pb-16 mb-20 flex justify-between items-end">
        <div>
          <h1 className="text-7xl font-black italic tracking-tighter uppercase mb-6 leading-none text-slate-900">Fiscal Audit</h1>
          <div className="flex items-center gap-6">
            <span className="px-6 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm">Confidential</span>
            <p className="text-base text-slate-500 font-bold uppercase tracking-[0.1em]">{report.month} Senior Review</p>
          </div>
        </div>
        <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Audit Timestamp</p>
            <p className="text-xl font-black italic text-slate-900">{new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* AI Analysis Content */}
      <div className="prose prose-slate max-w-none ai-report-container">
        {aiAnalysis ? (
          <div className="space-y-12 text-slate-800">
            <ReactMarkdown 
              components={{
                h3: ({node, ...props}) => <h3 className="text-3xl font-black text-slate-900 mt-16 mb-8 uppercase tracking-tight border-l-[8px] border-indigo-600 pl-6 leading-none" {...props} />,
                p: ({node, ...props}) => <p className="text-lg leading-relaxed text-slate-700 italic font-medium mb-6" {...props} />,
                li: ({node, ...props}) => <li className="text-lg leading-relaxed text-slate-700 mb-2 list-none flex items-start gap-3 before:content-['→'] before:text-indigo-600 before:font-black" {...props} />,
                ul: ({node, ...props}) => <ul className="pl-0 space-y-4 mb-8" {...props} />,
                strong: ({node, ...props}) => <strong className="font-black text-slate-900 underline decoration-indigo-200 decoration-4 underline-offset-4" {...props} />
              }}
            >
              {aiAnalysis}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="py-20 text-center">
            <p className="text-xl font-bold text-slate-400 animate-pulse uppercase tracking-widest">Compiling fiscal intelligence...</p>
          </div>
        )}
      </div>

      {/* Signature Area for Authority */}
      <div className="mt-32 pt-20 border-t-2 border-slate-100 flex justify-between items-end">
         <div className="space-y-8">
            <div className="w-64 h-px bg-slate-300 mb-2" />
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Financial Analyst Signature</p>
         </div>
         <div className="text-right">
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4">
                Automated School Audit Engine | Fiscal Transparency Initiative
            </p>
            <p className="text-[8px] font-bold text-slate-200 uppercase tracking-widest">
               ID: {Math.random().toString(36).substring(7).toUpperCase()} / v1.42.AI
            </p>
         </div>
      </div>
    </div>
  ) : null;

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
              disabled={loading}
              className="group w-full py-4 bg-slate-900 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg shadow-slate-200"
            >
              <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
              {loading ? "Compiling Analyst Audit..." : "Print Full Fiscal Review"}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Portal for Printing */}
      {mounted && createPortal(ReportContent, document.body)}
    </>
  );
};

export default FinancialQuickReport;
