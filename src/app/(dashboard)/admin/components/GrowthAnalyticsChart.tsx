"use client";

import { useState, useMemo } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceDot,
} from "recharts";

interface GrowthData {
  month: string;
  income: number;
  expense: number;
  isPredictive?: boolean;
}

const SummaryItem = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label}</p>
    <p className={`text-2xl font-black tracking-tighter ${color}`}>${Math.round(value).toLocaleString()}</p>
  </div>
);

const GrowthAnalyticsChart = ({ data }: { data: GrowthData[] }) => {
  const [view, setView] = useState<"all" | "income" | "expense" | "profit">("all");
  const { t } = useLanguage();

  const lastIndex = data.length - 1;
  const lastIncome = data[lastIndex].income;
  const lastExpense = data[lastIndex].expense;

  // 🔥 Improved weighted growth
  const getGrowth = (key: "income" | "expense") => {
    if (data.length < 2) return 0;

    const recentGrowth =
      data.length > 2
        ? data[lastIndex][key] - data[lastIndex - 1][key]
        : 0;

    const overallGrowth =
      (data[lastIndex][key] - data[0][key]) / data.length;

    return recentGrowth * 0.7 + overallGrowth * 0.3;
  };

  const incomeGrowth = getGrowth("income");
  const expenseGrowth = getGrowth("expense");

  // Base data
  const forecastData: any[] = data.map((d, index) => ({
    ...d,
    profit: d.income - d.expense,
    historicalIncome: d.income,
    historicalExpense: d.expense,
    historicalProfit: d.income - d.expense,
    predictiveIncome: index === lastIndex ? d.income : null,
    predictiveExpense: index === lastIndex ? d.expense : null,
    predictiveProfit: index === lastIndex ? (d.income - d.expense) : null,
  }));

  // Month handling (Data from backend uses English)
  const englishMonths = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  let lastMonthIndex = englishMonths.indexOf(data[lastIndex].month);
  if (lastMonthIndex === -1) {
    lastMonthIndex = englishMonths.findIndex(m =>
      m.startsWith(data[lastIndex].month) ||
      data[lastIndex].month.startsWith(m)
    );
  }

  // 🔮 Forecast next 3 months
  for (let i = 1; i <= 3; i++) {
    const nextMonthIndex = (lastMonthIndex + i) % 12;
    const newMonth = englishMonths[nextMonthIndex];

    const income = Math.max(0, lastIncome + incomeGrowth * i);
    const expense = Math.max(0, lastExpense + expenseGrowth * i);

    forecastData.push({
      month: newMonth,
      income,
      expense,
      profit: income - expense,
      historicalIncome: null,
      historicalExpense: null,
      historicalProfit: null,
      predictiveIncome: income,
      predictiveExpense: expense,
      predictiveProfit: income - expense,
      isPredictive: true,
    });
  }

  // 📊 Insight
  const trend =
    incomeGrowth > expenseGrowth
      ? `${t.analyticsChart.healthyGrowth} 📈`
      : `${t.analyticsChart.expensesGrowing} ⚠️`;

  // 🎯 Break-even
  const breakEvenPoint = forecastData.find((d) => d.profit >= 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    const mIdx = englishMonths.indexOf(label);
    const localizedMonth = mIdx !== -1 ? t.months[mIdx] : label;

    if (active && payload && payload.length) {
      const isPredictive = payload[0].payload.isPredictive;
      const income = payload.find((p: any) => p.dataKey === "historicalIncome" || p.dataKey === "predictiveIncome")?.value || 0;
      const expense = payload.find((p: any) => p.dataKey === "historicalExpense" || p.dataKey === "predictiveExpense")?.value || 0;
      const profit = income - expense;

      return (
        <div className="bg-white/95 p-4 rounded-2xl shadow-2xl border border-slate-100 backdrop-blur-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between gap-4">
            <span>{localizedMonth}</span>
            {isPredictive && (
                <span className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-lg text-[8px] border border-indigo-100 font-black">{t.analyticsChart.aiProjection}</span>
            )}
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
                  ${Math.round(entry.value).toLocaleString()}
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
      {/* 🔝 Summary & Insights */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex gap-8">
          <SummaryItem label={t.analyticsChart.revenue} value={lastIncome} color="text-emerald-500" />
          <SummaryItem label={t.analyticsChart.expenses} value={lastExpense} color="text-rose-500" />
          <SummaryItem label={t.analyticsChart.netProfit} value={lastIncome - lastExpense} color="text-indigo-600" />
        </div>
        
        <div className="flex flex-col items-end gap-3">
           <div className="px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                {trend}
              </span>
           </div>
           
           <div className="bg-slate-100/50 p-1 rounded-xl flex gap-1 border border-slate-100">
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
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                    view === v 
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" 
                      : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {labelMap[v]}
                </button>
              )})}
           </div>
        </div>
      </div>

      {/* 📈 Chart */}
      <div className="w-full h-[320px]">
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
              tickFormatter={(v) => {
                const idx = englishMonths.indexOf(v);
                return idx !== -1 ? t.months[idx] : v;
              }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
              tickFormatter={(v) => `$${v / 1000}k`}
            />

            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366F1', strokeWidth: 1, strokeDasharray: '4 4' }} />

            {/* Areas */}
            {(view === "all" || view === "income") && (
              <Area type="monotone" dataKey="historicalIncome" fill="url(#colorIncome)" stroke="none" isAnimationActive={false} />
            )}
            {(view === "all" || view === "expense") && (
              <Area type="monotone" dataKey="historicalExpense" fill="url(#colorExpense)" stroke="none" isAnimationActive={false} />
            )}
            {(view === "profit") && (
              <Area type="monotone" dataKey="profit" fill="url(#colorProfit)" stroke="none" isAnimationActive={false} />
            )}

            {/* Historical Lines */}
            {(view === "all" || view === "income") && (
              <Line type="monotone" dataKey="historicalIncome" stroke="#10B981" strokeWidth={3} dot={false} isAnimationActive={false} />
            )}
            {(view === "all" || view === "expense") && (
              <Line type="monotone" dataKey="historicalExpense" stroke="#F43F5E" strokeWidth={2} dot={false} isAnimationActive={false} />
            )}
            {(view === "all" || view === "profit") && (
              <Line type="monotone" dataKey="historicalProfit" stroke="#6366F1" strokeWidth={2} dot={false} isAnimationActive={false} />
            )}

            {/* Predictive Lines (Dashed) */}
            {(view === "all" || view === "income") && (
               <Line type="monotone" dataKey="predictiveIncome" stroke="#10B981" strokeWidth={3} strokeDasharray="6 6" dot={false} isAnimationActive={false} />
            )}
            {(view === "all" || view === "expense") && (
               <Line type="monotone" dataKey="predictiveExpense" stroke="#F43F5E" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            )}
            {(view === "all" || view === "profit") && (
               <Line type="monotone" dataKey="predictiveProfit" stroke="#6366F1" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
            )}

            {/* Break-even Indicator */}
            {breakEvenPoint && view === "all" && (
              <ReferenceDot
                x={breakEvenPoint.month}
                y={breakEvenPoint.profit}
                r={4}
                fill="#6366F1"
                stroke="#fff"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default GrowthAnalyticsChart;