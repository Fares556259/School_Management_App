"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { AlertCircle, Zap } from "lucide-react";

interface TornadoChartProps {
  baselineProfit: number;
  simulatedProfit: number;
  impacts: {
    variable: string;
    lowImpact: number; // profit if -10%
    highImpact: number; // profit if +10%
  }[];
}

export default function TornadoChart({ baselineProfit, simulatedProfit, impacts }: TornadoChartProps) {
  const data = useMemo(() => {
    return impacts.map(item => ({
      ...item,
      // Normalize to show variance from current simulated profit
      low: item.lowImpact - simulatedProfit,
      high: item.highImpact - simulatedProfit,
      absMax: Math.max(Math.abs(item.lowImpact - simulatedProfit), Math.abs(item.highImpact - simulatedProfit))
    })).sort((a, b) => b.absMax - a.absMax); // Tornado effect (biggest impact on top)
  }, [simulatedProfit, impacts]);

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-xl text-amber-600">
            <Zap size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 leading-none">Sensitivity Analysis</h2>
            <p className="text-[10px] text-slate-400 mt-1 uppercase font-black tracking-widest italic">Profit Impact of ±10% Variance</p>
          </div>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Base Simulator Profit</p>
           <p className="text-sm font-black text-indigo-600">${Math.floor(simulatedProfit).toLocaleString()}</p>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
            stackOffset="sign"
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" hide />
            <YAxis 
              dataKey="variable" 
              type="category" 
              axisLine={false} 
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 800 }}
              width={100}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload;
                  return (
                    <div className="bg-white p-4 rounded-2xl shadow-xl border border-slate-100">
                      <p className="text-xs font-black text-slate-800 mb-2 uppercase">{item.variable}</p>
                      <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400 font-bold">-10% Impact:</span>
                          <span className={item.lowImpact < item.highImpact ? "text-rose-500 font-bold" : "text-emerald-500 font-bold"}>
                             ${Math.floor(item.lowImpact).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-400 font-bold">+10% Impact:</span>
                          <span className={item.highImpact > item.lowImpact ? "text-emerald-500 font-bold" : "text-rose-500 font-bold"}>
                             ${Math.floor(item.highImpact).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            <Bar dataKey="low" stackId="stack" radius={[4, 0, 0, 4]}>
              {data.map((entry, index) => (
                <Cell key={`cell-low-${index}`} fill={entry.low < 0 ? "#f43f5e" : "#10b981"} />
              ))}
            </Bar>
            <Bar dataKey="high" stackId="stack" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-high-${index}`} fill={entry.high > 0 ? "#10b981" : "#f43f5e"} />
              ))}
              <LabelList 
                 position="right" 
                 dataKey="variable" 
                 content={(props: any) => {
                    const { x, y, width, height, index } = props;
                    const item = data[index];
                    const impact = Math.max(Math.abs(item.low), Math.abs(item.high));
                    return (
                       <text x={x + width + 5} y={y + height/2 + 4} fill="#94a3b8" fontSize={10} fontWeight={800}>
                          ±${Math.floor(impact).toLocaleString()}
                       </text>
                    );
                 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-3">
         <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
         <p className="text-[10px] text-amber-700/80 leading-relaxed font-bold">
            The Tornado chart ranks variables by their &quot;swing&quot; potential. Adjusting 
            <span className="text-slate-800"> {data[0]?.variable}</span> yields the highest ROI sensitivity.
         </p>
      </div>
    </div>
  );
}
