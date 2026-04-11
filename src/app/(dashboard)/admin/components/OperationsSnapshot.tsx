"use client";

import { GraduationCap, Users, UserRound, LayoutDashboard, ArrowRight, ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface OperationsSnapshotProps {
  students: number;
  teachers: number;
  staff: number;
  classes: number;
}

type ColorTheme = {
  bg: string;
  text: string;
  bar: string;
};

const StatItem = ({ label, value, icon: Icon, theme }: { label: string, value: number, icon: any, theme: ColorTheme }) => (
  <div className="flex flex-col p-6 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-xl group relative overflow-hidden">
    {/* Subtle Background Glow */}
    <div className={`absolute -right-12 -top-12 w-32 h-32 rounded-full ${theme.bg} blur-[40px] opacity-40 group-hover:opacity-80 transition-opacity pointer-events-none`} />

    <div className="flex justify-between items-start mb-6">
      <div className={`w-12 h-12 rounded-2xl ${theme.bg} ${theme.text} flex items-center justify-center transition-transform group-hover:scale-110 duration-300 relative z-10`}>
        <Icon size={24} strokeWidth={2.5} />
      </div>
      <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300 hover:text-indigo-500 relative z-10">
        <ArrowRight size={16} />
      </button>
    </div>
    
    <div className="flex flex-col relative z-10">
      <span className="text-3xl font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</span>
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</span>
    </div>
  </div>
);

const OperationsSnapshot = ({ students, teachers, staff, classes }: OperationsSnapshotProps) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { t } = useLanguage();

  return (
    <div className="w-full flex flex-col mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-400">
            <Activity size={12} />
            <h2 className="text-[10px] font-black uppercase tracking-widest">{t.adminWidgets.operationalSnapshot}</h2>
        </div>
        <button 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 transition-colors"
        >
            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      <StatItem 
        label={t.adminWidgets.studentsEnrolled}
        value={students} 
        icon={GraduationCap} 
        theme={{ bg: "bg-indigo-50", text: "text-indigo-600", bar: "bg-indigo-500" }} 
      />
      <StatItem 
        label={t.adminWidgets.activeTeachers}
        value={teachers} 
        icon={Users} 
        theme={{ bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" }} 
      />
      <StatItem 
        label={t.adminWidgets.supportStaff}
        value={staff} 
        icon={UserRound} 
        theme={{ bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" }} 
      />
      <StatItem 
        label={t.adminWidgets.activeClasses}
        value={classes} 
        icon={LayoutDashboard} 
        theme={{ bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500" }} 
      />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OperationsSnapshot;
