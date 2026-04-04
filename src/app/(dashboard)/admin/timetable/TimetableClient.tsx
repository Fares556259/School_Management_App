"use client";

import { useRouter, useSearchParams } from "next/navigation";
import TimetableGrid from "./components/TimetableGrid";

const TimetablePage = ({
  classes,
  subjects,
  teachers,
}: {
  classes: any[];
  subjects: any[];
  teachers: any[];
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;

  const selectedClass = classId 
    ? classes.find(c => c.id === classId) 
    : classes.find(c => c.name === "1A") || classes[0];

  return (
    <div className="p-4 flex flex-col gap-6 flex-1">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            School Timetable
            <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-1 rounded-full uppercase tracking-widest font-black">Admin Mode</span>
          </h1>
          <p className="text-slate-500 text-sm">Manage weekly schedules for all grades and classes.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-3">Select Class</label>
          <select 
            className="bg-white border-2 border-slate-100 rounded-lg px-4 py-2 text-sm font-bold text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-slate-50"
            value={selectedClass?.id}
            onChange={(e) => {
              router.push(`/admin/timetable?classId=${e.target.value}`);
            }}
          >
            {classes.map(cls => (
              <option key={cls.id} value={cls.id}>
                Grade {cls.level.level} - {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedClass && (
        <TimetableGrid 
          classId={selectedClass.id} 
          className={selectedClass.name}
          subjects={subjects}
          teachers={teachers}
        />
      )}
    </div>
  );
};

export default TimetablePage;
