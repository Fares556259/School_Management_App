"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CashFlowChartProps {
  monthlyRevenue: number;
  monthlyExpenses: number;
}

export default function CashFlowChart({ monthlyRevenue, monthlyExpenses }: CashFlowChartProps) {
  const data = useMemo(() => {
    const months = [
      "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"
    ];
    
    // Seasonality multipliers (typical academic cycle)
    const seasonality = {
      Sep: 1.4, // Registration spikes
      Oct: 1.0,
      Nov: 1.0,
      Dec: 0.9,
      Jan: 1.1, // Half-year enrollment
      Feb: 1.0,
      Mar: 1.0,
      Apr: 1.0,
      May: 1.0,
      Jun: 0.9,
      Jul: 0.3, // Holiday drop
      Aug: 0.3, // Holiday drop
    };

    let cumulative = 0;
    return months.map((m) => {
      const mult = seasonality[m as keyof typeof seasonality];
      const rev = Math.floor(monthlyRevenue * mult);
      const exp = Math.floor(monthlyExpenses * (mult > 0.5 ? 1.0 : 0.7)); // Fixed costs stay relatively similar
      const profit = rev - exp;
      cumulative += profit;

      return {
        month: m,
        revenue: rev,
        expenses: exp,
        profit: profit,
        cumulative: cumulative,
      };
    });
  }, [monthlyRevenue, monthlyExpenses]);

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
          <History size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 leading-none">12-Month Cash Flow Projection</h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest italic">Academic Cycle Seasonal Forecast</p>
        </div>
      </div>

      <div className="h-[350px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis 
              dataKey="month" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
            />
            <YAxis 
              yAxisId="left"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
              tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
            />
            <Tooltip 
               contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '20px' }}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            
            <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Proj. Revenue" barSize={30} />
            <Bar yAxisId="left" dataKey="expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} name="Proj. Expenses" barSize={30} />
            <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke="#10b981" strokeWidth={3} name="Cumulative Balance" dot={{ fill: '#10b981', r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Re-using History icon from lucide-react (imported in main file, adding here for completeness if needed as stand-alone but usually best to prop-drill or re-import)
import { History } from "lucide-react";
