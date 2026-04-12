"use client";

import { useRouter } from "next/navigation";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

type ChartData = { name: string; income: number; expense: number };

const FinanceChartClient = ({ 
  data,
  totalIncome,
  totalExpense,
  netResult,
  currentFilter
}: { 
  data: ChartData[],
  totalIncome: number,
  totalExpense: number,
  netResult: number,
  currentFilter: string
}) => {
  const router = useRouter();

  const handleFilterChange = (filter: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("chartFilter", filter);
    router.push(url.pathname + url.search);
  };

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col gap-8 h-full">
      {/* 1. HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Financial Performance</h2>
          <p className="text-slate-400 text-sm font-medium">Monthly revenue and spending analysis</p>
        </div>
        
        <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
          {["1M", "6M", "1Y"].map((f) => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                currentFilter === f 
                  ? "bg-white text-indigo-600 shadow-sm" 
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* 2. SUMMARY HEADER */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-4 border-y border-slate-50">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Income</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">${totalIncome.toLocaleString()}</span>
            <div className="p-1 rounded-full bg-emerald-50 text-emerald-500">
              <ArrowUpRight size={14} />
            </div>
          </div>
        </div>
        
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Expenses</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-800 tracking-tight">${totalExpense.toLocaleString()}</span>
            <div className="p-1 rounded-full bg-rose-50 text-rose-500">
              <ArrowDownRight size={14} />
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Net Result</span>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-black tracking-tight ${netResult >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
              ${netResult.toLocaleString()}
            </span>
            <div className={`p-1 rounded-full ${netResult >= 0 ? "bg-emerald-50 text-emerald-500" : "bg-rose-50 text-rose-500"}`}>
              {netResult > 0 ? <ArrowUpRight size={14} /> : netResult < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
            </div>
          </div>
        </div>
      </div>

      {/* 3. CHART */}
      <div className="flex-1 min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f8fafc" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tick={{ fill: "#cbd5e1", fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              tickMargin={15}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: "#cbd5e1", fontSize: 10, fontWeight: 700 }}
              tickLine={false}
              tickMargin={15}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "20px",
                border: "none",
                boxShadow: "0 20px 40px -10px rgba(0,0,0,0.1)",
                padding: "16px",
                backgroundColor: "#fff",
              }}
              itemStyle={{ fontWeight: 800, fontSize: "12px" }}
              labelStyle={{ fontWeight: 800, color: "#64748b", marginBottom: "8px", fontSize: "10px", textTransform: "uppercase" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
            />
            <Line
              type="monotone"
              dataKey="income"
              stroke="#6366f1"
              strokeWidth={4}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: "#6366f1" }}
            />
            <Line
              type="monotone"
              dataKey="expense"
              stroke="#f43f5e"
              strokeWidth={4}
              strokeDasharray="8 8"
              dot={false}
              activeDot={{ r: 6, strokeWidth: 0, fill: "#f43f5e" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FinanceChartClient;
