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
        <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100 backdrop-blur-md bg-white/90">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
            {label} {isPredictive && <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[8px]">AI FORECAST</span>}
          </p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-8 mb-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-sm font-medium text-slate-600">{entry.name}</span>
              </div>
              <span className="text-sm font-black text-slate-900">${entry.value.toLocaleString()}</span>
            </div>
          ))}
          {!isPredictive && (
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-8">
              <span className="text-sm font-medium text-slate-600">Net Profit</span>
              <span className="text-sm font-black text-[#10B981]">
                ${(payload[0].value - payload[1].value).toLocaleString()}
              </span>
            </div>
          )}
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
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorPredictive" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563EB" stopOpacity={0.05}/>
              <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }}
            dy={10}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94A3B8', fontSize: 12, fontWeight: 600 }}
            tickFormatter={(value) => `$${value / 1000}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#F8FAFC' }} />
          
          {/* Historical Revenue */}
          <Area
            type="monotone"
            dataKey={(d) => d.isPredictive ? null : d.income}
            name="Revenue"
            stroke="#2563EB"
            strokeWidth={4}
            fillOpacity={1}
            fill="url(#colorIncome)"
            animationDuration={1500}
            connectNulls
          />

          {/* Predictive Revenue */}
          <Area
            type="monotone"
            dataKey={(d) => d.isPredictive ? d.income : null}
            name="Forecast"
            stroke="#2563EB"
            strokeWidth={4}
            strokeDasharray="8 8"
            fillOpacity={1}
            fill="url(#colorPredictive)"
            animationDuration={1500}
            connectNulls
          />
          
          <Bar 
            dataKey="expense" 
            name="Expenses" 
            fill="#E2E8F0" 
            radius={[4, 4, 0, 0]} 
            barSize={20}
          />

          <Line
            type="monotone"
            dataKey={(d) => d.income - d.expense}
            name="Net Profit"
            stroke="#10B981"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 4"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default GrowthAnalyticsChart;
