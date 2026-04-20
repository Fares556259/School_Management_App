"use client";

import { ReactNode } from "react";

interface ConvertyMetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: ReactNode;
  colorClass?: string; // e.g., "text-indigo-600"
  borderColorClass?: string; // e.g., "border-indigo-200"
  bgColorClass?: string; // e.g., "bg-indigo-50"
}

export default function ConvertyMetricCard({
  title,
  value,
  subtitle,
  icon,
  colorClass = "text-indigo-600",
  borderColorClass = "border-indigo-200",
  bgColorClass = "bg-indigo-50",
}: ConvertyMetricCardProps) {
  return (
    <div className={`p-8 bg-white border-2 border-dashed ${borderColorClass} rounded-[32px] flex flex-col items-center justify-center text-center group hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 relative overflow-hidden`}>
      {/* Background Glow */}
      <div className={`absolute -top-10 -right-10 w-24 h-24 ${bgColorClass} blur-3xl opacity-50 rounded-full group-hover:scale-150 transition-transform`} />
      
      <div className={`mb-6 p-4 ${bgColorClass} ${colorClass} rounded-2xl`}>
        {icon}
      </div>
      
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
        {title}
      </p>
      
      <h3 className={`text-3xl font-black ${colorClass} tracking-tight mb-1`}>
        {value}
      </h3>
      
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {subtitle}
      </p>
    </div>
  );
}
