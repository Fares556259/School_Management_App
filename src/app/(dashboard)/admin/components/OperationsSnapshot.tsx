import React from 'react';

interface OperationsSnapshotProps {
  students: number;
  teachers: number;
  staff: number;
  classes: number;
}

const StatItem = ({ label, value, icon, color }: { label: string, value: number, icon: string, color: string }) => (
  <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow group">
    <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center text-xl shadow-lg shadow-current/10 group-hover:scale-110 transition-transform`}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span className="text-2xl font-black text-slate-800 tracking-tight">{value.toLocaleString()}</span>
      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{label}</span>
    </div>
  </div>
);

const OperationsSnapshot = ({ students, teachers, staff, classes }: OperationsSnapshotProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      <StatItem label="Students" value={students} icon="🎓" color="bg-indigo-50 text-indigo-600" />
      <StatItem label="Teachers" value={teachers} icon="👨‍🏫" color="bg-purple-50 text-purple-600" />
      <StatItem label="Staff" value={staff} icon="💼" color="bg-orange-50 text-orange-600" />
      <StatItem label="Classes" value={classes} icon="🏫" color="bg-pink-50 text-pink-600" />
    </div>
  );
};

export default OperationsSnapshot;
