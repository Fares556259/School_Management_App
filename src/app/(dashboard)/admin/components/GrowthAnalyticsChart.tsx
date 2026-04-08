"use client";

import {
  Area,
  AreaChart,
  Bar,
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

const GrowthAnalyticsChart = ({ data }: { data: GrowthData[] }) => {
  const lastIndex = data.length - 1;
  const lastIncome = data[lastIndex].income;
  const lastExpense = data[lastIndex].expense;
  
  const avgIncomeGrowth = data.length > 1 
    ? (data[lastIndex].income - data[0].income) / (data.length - 1)
    : 0;
    
  const avgExpenseGrowth = data.length > 1
    ? (data[lastIndex].expense - data[0].expense) / (data.length - 1)
    : 0;

  const forecastData = data.map((d, index) => ({
    ...d,
    historicalIncome: d.income,
    historicalExpense: d.expense,
    predictiveIncome: index === lastIndex ? d.income : null,
    predictiveExpense: index === lastIndex ? d.expense : null,
  }));

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const lastMonthName = data[lastIndex].month;
  // Fallback to substring match if exact match fails
  let lastMonthIndex = months.indexOf(lastMonthName);
  if (lastMonthIndex === -1) {
    lastMonthIndex = months.findIndex(m => m.startsWith(lastMonthName) || lastMonthName.startsWith(m));
  }

  for (let i = 1; i <= 3; i++) {
    const nextMonthIndex = (lastMonthIndex + i) % 12;
    // We try to match structural format of the incoming label
    const newMonthName = lastMonthName.length <= 3 ? months[nextMonthIndex].substring(0, 3) : months[nextMonthIndex];
    forecastData.push({
      month: newMonthName,
      income: Math.max(0, lastIncome + avgIncomeGrowth * i),
      expense: Math.max(0, lastExpense + avgExpenseGrowth * i),
      historicalIncome: null as any,
      historicalExpense: null as any,
      predictiveIncome: Math.max(0, lastIncome + avgIncomeGrowth * i),
      predictiveExpense: Math.max(0, lastExpense + avgExpenseGrowth * i),
      isPredictive: true,
    } as any);
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isPredictive = payload[0].payload.isPredictive;
      return (
        <div className="bg-white/95 p-4 rounded-2xl shadow-2xl border border-slate-100 backdrop-blur-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between gap-4">
            <span>{label}</span>
            {isPredictive && (
                <span className="bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-lg text-[8px] border border-indigo-100">AI PROJECTION</span>
            )}
          </p>
          <div className="flex flex-col gap-2">
            {payload.map((entry: any, index: number) => {
              if (index > 1) return null; // Only show main metrics
              return (
                <div key={index} className="flex items-center justify-between gap-8">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-xs font-bold text-slate-500">{entry.name}</span>
                  </div>
                  <span className="text-sm font-black text-slate-800">${Math.round(entry.value).toLocaleString()}</span>
                </div>
              );
            })}
            {!isPredictive && (() => {
                const profit = payload[0].value - payload[1].value;
                const isPositive = profit >= 0;
                return (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-400">Net Profit</span>
                      <span className={`text-xs font-black ${isPositive ? 'text-indigo-500' : 'text-slate-500'}`}>
                        {isPositive ? '+' : '-'}${Math.abs(Math.round(profit)).toLocaleString()}
                      </span>
                  </div>
                );
            })()}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
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
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#10B981', strokeWidth: 1, strokeDasharray: '4 4' }} 
          />
          
          {/* --- Render Areas --- */}
          <Area 
            type="monotone" 
            dataKey="historicalIncome" 
            stroke="none" 
            fill="url(#colorIncome)" 
            isAnimationActive={false}
          />
          <Area 
            type="monotone" 
            dataKey="historicalExpense" 
            stroke="none" 
            fill="url(#colorExpense)" 
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="historicalExpense" 
            stroke="#F43F5E" 
            strokeWidth={2} 
            strokeDasharray="4 4" 
            dot={false}
            activeDot={{ r: 4, fill: '#F43F5E', strokeWidth: 0 }}
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="historicalIncome" 
            stroke="#10B981" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          
          {/* Dashed line for predictive */}
          <Line 
            type="monotone" 
            dataKey="predictiveExpense" 
            stroke="#F43F5E" 
            strokeWidth={2} 
            strokeDasharray="4 4" 
            dot={false} 
            activeDot={false}
            isAnimationActive={false}
          />
          <Line 
            type="monotone" 
            dataKey="predictiveIncome" 
            stroke="#10B981" 
            strokeWidth={3} 
            strokeDasharray="6 6" 
            dot={false} 
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GrowthAnalyticsChart;
