"use client";
import React from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Activity, Calendar } from 'lucide-react';

export default function PaymentHeatmap({ data }: { data: { date: string, count: number, amount: number }[] }) {
  // Take last 30 days for the snapshot
  const recentData = data.slice(-30);
  const totalAmount = recentData.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 h-full w-full flex flex-col gap-6 group">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
             <Activity size={16} />
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-widest leading-none">Payment Volume</h2>
            <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Activity heat-map</p>
          </div>
        </div>
        <div className="text-right">
           <span className="text-lg font-black text-slate-800 tracking-tighter">${totalAmount.toLocaleString()}</span>
           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Last 30 Days</p>
        </div>
      </div>

      <div className="flex-1 min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={recentData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="date" hide />
            <Tooltip 
              cursor={{fill:"#f8fafc", radius: 8}}
              contentStyle={{ 
                borderRadius: "16px", 
                border: "none", 
                boxShadow: "0 10px 30px -5px rgba(0,0,0,0.1)",
                padding: "12px",
                fontSize: "12px",
                fontWeight: "bold"
              }}
              labelStyle={{ display: "none" }}
              formatter={(value: number) => [`$${value.toLocaleString()}`, "Volume"]}
            />
            <Bar dataKey="amount" radius={[4, 4, 4, 4]}>
              {recentData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.amount > 0 ? "#10b981" : "#f1f5f9"} 
                  className="transition-all duration-300 hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between items-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] border-t border-slate-50 pt-4">
         <div className="flex items-center gap-1.5 transition-colors hover:text-indigo-500 cursor-pointer">
            <Calendar size={10} />
            <span>Full History</span>
         </div>
         <div className="flex items-center gap-1">
            <span>Low</span>
            <div className="flex gap-1 px-1">
               <div className="w-2 h-2 rounded-sm bg-emerald-50" />
               <div className="w-2 h-2 rounded-sm bg-emerald-200" />
               <div className="w-2 h-2 rounded-sm bg-emerald-500" />
            </div>
            <span>High</span>
         </div>
      </div>
    </div>
  );
}
