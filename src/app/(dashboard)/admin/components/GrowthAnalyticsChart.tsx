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
  // Simple linear forecasting for next 3 months
  const forecastData = [...data];
  const lastIndex = data.length - 1;
  const lastIncome = data[lastIndex].income;
  const lastExpense = data[lastIndex].expense;
  
  // Calculate average growth rate if possible
  const avgIncomeGrowth = data.length > 1 
    ? (data[lastIndex].income - data[0].income) / (data.length - 1)
    : 0;
    
  const avgExpenseGrowth = data.length > 1
    ? (data[lastIndex].expense - data[0].expense) / (data.length - 1)
    : 0;

  // Add 3 predictive months
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const lastMonthName = data[lastIndex].month;
  const lastMonthIndex = months.indexOf(lastMonthName);

  for (let i = 1; i <= 3; i++) {
    const nextMonthIndex = (lastMonthIndex + i) % 12;
    forecastData.push({
      month: months[nextMonthIndex],
      income: Math.max(0, lastIncome + avgIncomeGrowth * i),
      expense: Math.max(0, lastExpense + avgExpenseGrowth * i),
      isPredictive: true,
    });
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isPredictive = payload[0].payload.isPredictive;
      return (
        <div className="bg-white/95 p-4 rounded-2xl shadow-2xl border border-slate-100 backdrop-blur-xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center justify-between gap-4">
            <span>{label} 2026</span>
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
            {!isPredictive && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400">Net Profit</span>
                    <span className="text-xs font-black text-emerald-500">+${Math.round(payload[0].value - payload[1].value).toLocaleString()}</span>
                </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[400px] mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#94A3B8" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#94A3B8" stopOpacity={0}/>
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
            cursor={{ stroke: '#4F46E5', strokeWidth: 1, strokeDasharray: '4 4' }} 
          />
          
          {/* Expense Area */}
          <Area
            type="monotone"
            dataKey="expense"
            name="Expenses"
            stroke="#94A3B8"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorExpense)"
            animationDuration={1500}
            strokeDasharray="5 5"
          />

          {/* Revenue Area (Primary) */}
          <Area
            type="monotone"
            dataKey={(d) => d.isPredictive ? null : d.income}
            name="Revenue"
            stroke="#4F46E5"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorIncome)"
            animationDuration={1500}
            connectNulls
          />

          {/* Forecast Area */}
          <Area
            type="monotone"
            dataKey={(d) => d.isPredictive ? d.income : null}
            name="Forecast"
            stroke="#4F46E5"
            strokeWidth={4}
            strokeDasharray="8 8"
            fillOpacity={1}
            fill="none"
            animationDuration={1000}
            connectNulls
          />

          {/* "Today" Marker */}
          {forecastData[lastIndex] && (
            <ReferenceDot 
                x={forecastData[lastIndex].month} 
                y={forecastData[lastIndex].income} 
                r={6} 
                fill="#4F46E5" 
                stroke="#fff" 
                strokeWidth={3} 
                label={{ 
                    position: 'top', 
                    value: 'Today', 
                    fill: '#4F46E5', 
                    fontSize: 10, 
                    fontWeight: 900,
                    offset: 15
                }} 
            />
          )}

          <Line
            type="monotone"
            dataKey={(d) => d.income - d.expense}
            name="Net Margin"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            strokeDasharray="3 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GrowthAnalyticsChart;
