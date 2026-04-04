"use client";

import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface FinanceDataPoint {
  name: string;
  value: number;
  type: 'income' | 'expense';
}

interface FiscalBarChartProps {
  incomeData: FinanceDataPoint[];
  expenseData: FinanceDataPoint[];
}

const FiscalBarChart: React.FC<FiscalBarChartProps> = ({ 
    incomeData: rawIncome, 
    expenseData: rawExpense 
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-[350px] w-full bg-slate-50 animate-pulse rounded-[24px]" />;

  // Combine and sort for the horizontal view
  const combinedData = [
    ...rawIncome.map(d => ({ ...d, color: '#6366f1' })), // Indigo/Blue for Income
    ...rawExpense.map(d => ({ ...d, color: '#fb7185' })) // Rose/Red for Expenses
  ].sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-[20px] border border-slate-100 shadow-xl">
          <p className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest">{data.type}</p>
          <p className="text-sm font-black text-slate-800 italic">{data.name}</p>
          <p className={`text-lg font-black tracking-tight ${data.type === 'income' ? 'text-indigo-500' : 'text-rose-500'}`}>
            ${Math.round(data.value).toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex-1 w-full min-h-[350px]">
      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={combinedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
          barSize={24}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }}
            width={100}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
          <Bar dataKey="value" radius={[0, 12, 12, 0]}>
            {combinedData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FiscalBarChart;
