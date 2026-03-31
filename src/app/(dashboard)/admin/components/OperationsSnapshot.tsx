import React from 'react';
import { GraduationCap, Users, UserRound, LayoutDashboard, ArrowRight } from 'lucide-react';

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
  <div className="flex flex-col p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
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
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1 mb-4">{label}</span>
    </div>
    
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden relative z-10">
       <div className={`h-full rounded-full ${theme.bar} opacity-80`} style={{ width: '60%' }} />
    </div>
  </div>
);

const OperationsSnapshot = ({ students, teachers, staff, classes }: OperationsSnapshotProps) => {
  return (
    <div className="grid grid-cols-2 gap-4 w-full">
      <StatItem 
        label="Students Enrolled" 
        value={students} 
        icon={GraduationCap} 
        theme={{ bg: "bg-indigo-50", text: "text-indigo-600", bar: "bg-indigo-500" }} 
      />
      <StatItem 
        label="Active Teachers" 
        value={teachers} 
        icon={Users} 
        theme={{ bg: "bg-emerald-50", text: "text-emerald-600", bar: "bg-emerald-500" }} 
      />
      <StatItem 
        label="Support Staff" 
        value={staff} 
        icon={UserRound} 
        theme={{ bg: "bg-amber-50", text: "text-amber-600", bar: "bg-amber-500" }} 
      />
      <StatItem 
        label="Active Classes" 
        value={classes} 
        icon={LayoutDashboard} 
        theme={{ bg: "bg-rose-50", text: "text-rose-600", bar: "bg-rose-500" }} 
      />
    </div>
  );
};

export default OperationsSnapshot;
