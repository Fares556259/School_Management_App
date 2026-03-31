import React from 'react';
import { GraduationCap, Users, UserRound, LayoutDashboard, ArrowRight } from 'lucide-react';

interface OperationsSnapshotProps {
  students: number;
  teachers: number;
  staff: number;
  classes: number;
}

const StatItem = ({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) => (
  <div className="flex flex-col gap-4 p-6 bg-white rounded-[24px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
    <div className="flex justify-between items-start">
      <div className={`w-12 h-12 rounded-2xl ${color} flex items-center justify-center transition-transform group-hover:scale-110`}>
        <Icon size={24} />
      </div>
      <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors text-slate-300 hover:text-indigo-500">
        <ArrowRight size={16} />
      </button>
    </div>
    <div className="flex flex-col mt-2">
      <span className="text-3xl font-black text-slate-800 tracking-tighter">{value.toLocaleString()}</span>
      <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">{label}</span>
    </div>
    <div className="w-full h-1 bg-slate-50 rounded-full mt-2 overflow-hidden">
       <div className={`h-full rounded-full opacity-60 ${color.split(' ')[1]}`} style={{ width: '40%' }} />
    </div>
  </div>
);

const OperationsSnapshot = ({ students, teachers, staff, classes }: OperationsSnapshotProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
      <StatItem label="Students" value={students} icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
      <StatItem label="Teachers" value={teachers} icon={Users} color="bg-emerald-50 text-emerald-600" />
      <StatItem label="Staff" value={staff} icon={UserRound} color="bg-amber-50 text-amber-600" />
      <StatItem label="Classes" value={classes} icon={LayoutDashboard} color="bg-rose-50 text-rose-600" />
    </div>
  );
};

export default OperationsSnapshot;
