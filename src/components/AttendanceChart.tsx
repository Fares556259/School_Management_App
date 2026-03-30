"use client";
import Image from "next/image";
import {
  BarChart,
  Bar,
  Rectangle,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const data = [
  {
    name: "Mon",
    present: 60,
    absent: 40,
  },
  {
    name: "Tue",
    present: 70,
    absent: 60,
  },
  {
    name: "Wed",
    present: 90,
    absent: 75,
  },
  {
    name: "Thu",
    present: 90,
    absent: 75,
  },
  {
    name: "Fri",
    present: 65,
    absent: 55,
  },
];

const AttendanceChart = () => {
  return (
    <div className="glass-card rounded-3xl p-6 h-full">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-slate-800">Attendance Rate</h1>
        <div className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
          <Image src="/moreDark.png" alt="" width={20} height={20} className="opacity-40" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <BarChart data={data} barSize={12} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis
            dataKey="name"
            axisLine={false}
            tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
            tickLine={false}
            tickMargin={12}
          />
          <YAxis 
            axisLine={false} 
            tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }} 
            tickLine={false} 
            tickMargin={12}
          />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: "16px", border: "none", boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)", padding: "12px" }}
            itemStyle={{ fontWeight: 600 }}
          />
          <Legend
            align="right"
            verticalAlign="top"
            wrapperStyle={{ paddingTop: "0px", paddingBottom: "40px" }}
            iconType="circle"
          />
          <Bar
            dataKey="present"
            fill="#6366f1"
            legendType="circle"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="absent"
            fill="#e2e8f0"
            legendType="circle"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};


export default AttendanceChart;
