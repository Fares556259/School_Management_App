"use client";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function PaymentHeatmap({ data }: { data: { date: string, count: number, amount: number }[] }) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow-sm h-full w-full flex flex-col justify-between">
      <h2 className="text-sm font-bold text-slate-700">Payment Activity</h2>
      <ResponsiveContainer width="100%" height="80%">
        <BarChart data={data}>
          <XAxis dataKey="date" hide />
          <Tooltip 
            cursor={{fill:"#f1f5f9"}}
            contentStyle={{ borderRadius: "10px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
          />
          <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
