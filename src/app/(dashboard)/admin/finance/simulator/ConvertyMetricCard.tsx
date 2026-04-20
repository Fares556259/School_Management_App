"use client";

import { ReactNode } from "react";

interface ConvertyMetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  colorClass?: string; // e.g., "text-indigo-400"
  borderColorClass?: string; // e.g., "border-indigo-500/50"
  bgColorClass?: string; // e.g., "bg-indigo-500/10"
}

export default function ConvertyMetricCard({
  title,
  value,
  subtitle,
  icon,
  colorClass = "text-indigo-400",
  borderColorClass = "border-indigo-500/30",
  bgColorClass = "bg-indigo-500/10",
}: ConvertyMetricCardProps) {
  return (
    <div className={`p-8 bg-slate-900/40 border-2 border-dashed ${borderColorClass} rounded-[32px] flex flex-col items-center justify-center text-center group hover:bg-slate-900/60 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden backdrop-blur-sm`}>
      {/* Background Glow */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 ${bgColorClass} blur-3xl opacity-20 group-hover:opacity-40 transition-opacity rounded-full group-hover:scale-150 transition-transform`} />
      
      <div className={`mb-4 p-4 lg:p-5 ${bgColorClass} ${colorClass} rounded-[24px] shadow-inner`}>
        {icon}
      </div>
      
      <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 mb-2">
        {title}
      </p>
      
      <h3 className={`text-3xl font-black ${colorClass} tracking-tighter mb-1 tabular-nums transition-all`}>
        {value}
      </h3>
      
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
        {subtitle}
      </p>
    </div>
  );
}
