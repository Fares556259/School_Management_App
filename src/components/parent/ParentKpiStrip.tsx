"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  CalendarCheck, 
  CreditCard, 
  GraduationCap,
  ArrowUpRight
} from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  color: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, icon: Icon, color, trend }) => (
  <motion.div 
    whileHover={{ y: -4 }}
    className="flex-1 bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4 min-w-[240px]"
  >
    <div className="flex items-center justify-between">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center`} style={{ backgroundColor: `${color}15` }}>
        <Icon size={24} color={color} />
      </div>
      {trend && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black ${trend.isUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
          {trend.isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.value}%
        </div>
      )}
    </div>
    
    <div>
      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</h3>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-800 tracking-tighter">{value}</span>
        <span className="text-xs font-bold text-slate-400">{subtitle}</span>
      </div>
    </div>

    <div className="pt-4 border-t border-slate-50 flex items-center justify-between group cursor-pointer">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:text-primary transition-colors">View Details</span>
      <ArrowUpRight size={14} className="text-slate-300 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
    </div>
  </motion.div>
);

interface ParentKpiStripProps {
  data: {
    averageGrade: number;
    gradeTrend: number;
    attendanceRate: number;
    attendanceTrend: number;
    financeStatus: string;
    balanceDue: number;
  };
}

const ParentKpiStrip: React.FC<ParentKpiStripProps> = ({ data }) => {
  return (
    <div className="flex flex-wrap gap-6 mb-8">
      <KpiCard 
        title="Academic Performance" 
        value={`${data.averageGrade}/20`} 
        subtitle="Average Grade"
        icon={GraduationCap}
        color="#8b5cf6"
        trend={{ value: data.gradeTrend, isUp: data.gradeTrend > 0 }}
      />
      <KpiCard 
        title="Attendance Rate" 
        value={`${data.attendanceRate}%`} 
        subtitle="This Term"
        icon={CalendarCheck}
        color="#0055d4"
        trend={{ value: data.attendanceTrend, isUp: data.attendanceTrend > 0 }}
      />
      <KpiCard 
        title="Finance & Tuition" 
        value={data.financeStatus} 
        subtitle={data.balanceDue > 0 ? `${data.balanceDue} TND Due` : "Up to date"}
        icon={CreditCard}
        color={data.financeStatus === "Paid" ? "#10b981" : "#f59e0b"}
      />
    </div>
  );
};

export default ParentKpiStrip;
