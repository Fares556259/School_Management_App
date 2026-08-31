"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
} from "recharts";

interface GrowthData {
  month: string;
  income: number;
  expense: number;
}

const SummaryItem = ({ label, value, colorHex }: { label: string, value: number, colorHex: string }) => (
  <div>
    <p className="text-[12px] font-medium text-[#5a5a5a] mb-1 flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorHex }} />
      {label}
    </p>
    <p className="text-[24px] font-semibold text-[#080808] tracking-[-0.5px]">
      {`\u202A${value < 0 ? '-' : ''}${Math.abs(Math.round(value)).toLocaleString()} DT\u202C`}
    </p>
  </div>
);

const GrowthAnalyticsChart = ({ data, currentIncome, currentExpense }: { data: GrowthData[], currentIncome?: number, currentExpense?: number }) => {
  const [view, setView] = useState<"all" | "income" | "expense" | "profit">("all");
  const { t } = useLanguage();

  const lastIndex = data.length > 0 ? data.length - 1 : 0;
  const lastIncome = currentIncome !== undefined ? currentIncome : (data[lastIndex]?.income || 0);
  const lastExpense = currentExpense !== undefined ? currentExpense : (data[lastIndex]?.expense || 0);
  const netProfit = lastIncome - lastExpense;
  const isHealthy = netProfit >= 0;
  const trend = isHealthy ? t.analyticsChart.healthyGrowth : t.analyticsChart.expensesGrowing;

  // Base data
  const forecastData: any[] = data.map((d) => ({
    ...d,
    profit: d.income - d.expense,
    historicalIncome: d.income,
    historicalExpense: d.expense,
    historicalProfit: d.income - d.expense,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const income = payload.find((p: any) => p.dataKey === "historicalIncome")?.value || 0;
      const expense = payload.find((p: any) => p.dataKey === "historicalExpense")?.value || 0;
      const profit = income - expense;

      return (
        <div className="bg-white/95 p-4 rounded-2xl shadow-2xl border border-slate-100 backdrop-blur-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between gap-4">
            <span>{label}</span>
          </p>
          <div className="flex flex-col gap-2">
            {[
              { label: t.analyticsChart.revenue, value: income, color: "#10B981" },
              { label: t.analyticsChart.expenses, value: expense, color: "#F43F5E" },
              { label: t.analyticsChart.netProfit, value: profit, color: "#6366F1", isBold: true }
            ].map((entry, idx) => (
              <div key={idx} className={`flex items-center justify-between gap-8 ${entry.isBold ? 'mt-2 pt-2 border-t border-slate-100' : ''}`}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-bold text-slate-500">{entry.label}</span>
                </div>
                <span className={`text-sm font-black tracking-tight ${entry.isBold ? 'text-indigo-600' : 'text-slate-800'}`}>
                  {`\u202A${entry.value < 0 ? '-' : ''}${Math.abs(Math.round(entry.value)).toLocaleString()} DT\u202C`}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex gap-8">
          <SummaryItem label={t.analyticsChart.revenue} value={lastIncome} colorHex="#10b981" />
          <SummaryItem label={t.analyticsChart.expenses} value={lastExpense} colorHex="#f43f5e" />
          <SummaryItem label={t.analyticsChart.netProfit} value={netProfit} colorHex="#6366f1" />
        </div>
        
        <div className="flex flex-col items-end gap-3">
           <div className="px-3 py-1.5 bg-[#f9f9f9] rounded-[4px] border border-[#d8d8d8]">
              <span className="text-[11px] font-medium text-[#5a5a5a] uppercase tracking-wider flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-indigo-500' : 'bg-rose-500'} animate-pulse`} />
                {trend}
              </span>
           </div>
           
           <div className="bg-[#f9f9f9] p-1 rounded-[6px] flex gap-1 border border-[#d8d8d8]">
              {["all", "income", "expense", "profit"].map((v) => {
                const labelMap: Record<string, string> = {
                  "all": t.analyticsChart.filterAll,
                  "income": t.analyticsChart.filterIncome,
                  "expense": t.analyticsChart.filterExpense,
                  "profit": t.analyticsChart.filterProfit
                };
                return (
                <button
                  key={v}
                  onClick={() => setView(v as any)}
                  className={`px-3 py-1.5 text-[12px] font-medium transition-all rounded-[4px] ${
                    view === v 
                      ? "bg-[#ffffff] text-[#080808] shadow-sm border border-[#d8d8d8]" 
                      : "text-[#5a5a5a] hover:text-[#080808] border border-transparent"
                  }`}
                >
                  {labelMap[v]}
                </button>
              )})}
           </div>
        </div>
      </div>

      <div className="w-full h-[320px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" strokeOpacity={0.5} />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
                tickFormatter={(v) => `\u202A${v < 0 ? '-' : ''}${Math.abs(v / 1000).toFixed(0)}k DT\u202C`}
              />

              <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }} />

              {(view === "all" || view === "income") && (
                <Area type="monotone" dataKey="historicalIncome" fill="url(#colorIncome)" stroke="none" isAnimationActive={false} />
              )}
              {(view === "all" || view === "expense") && (
                <Area type="monotone" dataKey="historicalExpense" fill="url(#colorExpense)" stroke="none" isAnimationActive={false} />
              )}
              {(view === "profit") && (
                <Area type="monotone" dataKey="historicalProfit" fill="url(#colorProfit)" stroke="none" isAnimationActive={false} />
              )}

              {(view === "all" || view === "income") && (
                <Line type="monotone" dataKey="historicalIncome" stroke="#10B981" strokeWidth={3} dot={data.length === 1} isAnimationActive={false} />
              )}
              {(view === "all" || view === "expense") && (
                <Line type="monotone" dataKey="historicalExpense" stroke="#F43F5E" strokeWidth={2} dot={data.length === 1} isAnimationActive={false} />
              )}
              {(view === "all" || view === "profit") && (
                <Line type="monotone" dataKey="historicalProfit" stroke="#6366F1" strokeWidth={2} dot={data.length === 1} isAnimationActive={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm">
            {/* Fallback when data is empty */}
          </div>
        )}
      </div>
    </div>
  );
};

export default GrowthAnalyticsChart;