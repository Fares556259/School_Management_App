"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export default function CollectionGauge({ rate, month }: { rate: number, month: string }) {
  const data = [
    { name: "Collected", value: rate, color: "#4f46e5" },
    { name: "Pending", value: 100 - rate, color: "#e2e8f0" }
  ];
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm h-full w-full flex flex-col justify-between items-center relative">
      <div className="w-full flex justify-between items-center">
        <h2 className="text-sm font-bold text-slate-700">Collection Rates</h2>
        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-500 px-2 py-1 rounded-full uppercase tracking-wider">{month}</span>
      </div>
      <div className="w-full h-[80%] relative flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius="70%"
              outerRadius="90%"
              startAngle={180}
              endAngle={0}
              paddingAngle={5}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute flex flex-col items-center justify-center translate-y-4">
          <span className="text-4xl font-black text-slate-800">{Math.round(rate)}%</span>
        </div>
      </div>
    </div>
  );
}
