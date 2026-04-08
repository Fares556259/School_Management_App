"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Check, Edit2 } from "lucide-react";
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
  const [isEditMode, setIsEditMode] = useState(false);
  const classId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;

  const selectedClass = classId 
    ? classes.find(c => c.id === classId) 
    : classes.find(c => c.name === "1A") || classes[0];

  return (
    <div className="p-4 flex flex-col gap-6 flex-1">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
             <Clock size={24} className="stroke-[2.5px]" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 uppercase">
              Academic Timetable
              <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-widest font-black border ${isEditMode ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isEditMode ? 'Edit Mode' : 'View Mode'}
              </span>
            </h1>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">Manage weekly schedules for all grades.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* EDIT TOGGLE BUTTON */}
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${
              isEditMode 
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            {isEditMode ? (
              <><Check size={14} className="stroke-[3px]"/> Save Changes</>
            ) : (
              <><Edit2 size={14} className="stroke-[3px]"/> Edit Schedule</>
            )}
          </button>

          <div className="h-10 w-px bg-slate-100 mx-2"></div>

          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-3">Class</label>
            <select 
              className="bg-white border border-slate-100 rounded-lg px-4 py-2 text-xs font-black text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-white uppercase tracking-wider"
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
      </div>

      {selectedClass && (
        <TimetableGrid 
          classId={selectedClass.id} 
          className={selectedClass.name}
          subjects={subjects}
          teachers={teachers}
          isEditMode={isEditMode}
        />
      )}
    </div>
  );
};

export default TimetablePage;
