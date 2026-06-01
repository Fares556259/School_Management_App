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
};

const StatItem = ({ label, value, icon: Icon, theme }: { label: string, value: number, icon: any, theme: ColorTheme }) => (
  <div className="flex items-center justify-between p-5 bg-[#ffffff] rounded-[8px] border border-[#d8d8d8] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] group relative overflow-hidden">
    <div className="flex items-center gap-4 relative z-10">
      <div className="w-12 h-12 flex items-center justify-center rounded-full bg-[#146ef5]/10 text-[#146ef5] transition-transform group-hover:scale-110 duration-300 shrink-0">
        <Icon size={24} strokeWidth={2} />
      </div>
      <div className="flex flex-col">
        <span className="text-[32px] font-medium tracking-[-0.5px] text-[#080808] leading-none">{value.toLocaleString()}</span>
        <span className="text-[13px] font-medium text-[#5a5a5a] mt-1">{label}</span>
      </div>
    </div>
    <button className="p-1.5 hover:bg-black/5 rounded-[4px] transition-colors text-[#080808]/40 hover:text-[#080808] relative z-10 self-start">
      <ArrowRight size={16} />
    </button>
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
        theme={{ bg: "bg-[#fcab79]" }} 
      />
      <StatItem 
        label={t.adminWidgets.activeTeachers}
        value={teachers} 
        icon={Users} 
        theme={{ bg: "bg-[#a8d8c4]" }} 
      />
      <StatItem 
        label={t.adminWidgets.supportStaff}
        value={staff} 
        icon={UserRound} 
        theme={{ bg: "bg-[#f5e9d4]" }} 
      />
      <StatItem 
        label={t.adminWidgets.activeClasses}
        value={classes} 
        icon={LayoutDashboard} 
        theme={{ bg: "bg-[#f4d35e]" }} 
      />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OperationsSnapshot;
