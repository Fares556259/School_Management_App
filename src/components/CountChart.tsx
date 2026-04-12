"use client";
import Image from "next/image";
import {
  RadialBarChart,
  RadialBar,
  Legend,
  ResponsiveContainer,
} from "recharts";

const data = [
  {
    name: "Total",
    count: 106,
    fill: "white",
  },
  {
    name: "Girls",
    count: 53,
    fill: "#94a3b8",
  },
  {
    name: "Boys",
    count: 53,
    fill: "#6366f1",
  },
];

const CountChart = () => {
  return (
    <div className="glass-card rounded-3xl w-full h-full p-6">
      {/* TITLE */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-slate-800">Student Distribution</h1>
        <div className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
          <Image src="/moreDark.png" alt="" width={20} height={20} className="opacity-40" />
        </div>
      </div>
      {/* CHART */}
      <div className="relative w-full h-[65%]">
        <ResponsiveContainer>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="100%"
            barSize={24}
            data={data}
          >
            <RadialBar background dataKey="count" cornerRadius={12} />
          </RadialBarChart>
        </ResponsiveContainer>
        <Image
          src="/maleFemale.png"
          alt=""
          width={40}
          height={40}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20"
        />
      </div>
      {/* BOTTOM */}
      <div className="flex justify-center gap-12 mt-4">
        <div className="flex flex-col items-center gap-1">
          <div className="w-4 h-4 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.4)]" />
          <h1 className="font-bold text-slate-700 text-lg">1,234</h1>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Boys</h2>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="w-4 h-4 bg-slate-300 rounded-full" />
          <h1 className="font-bold text-slate-700 text-lg">1,234</h1>
          <h2 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Girls</h2>
        </div>
      </div>
    </div>
  );
};


export default CountChart;
