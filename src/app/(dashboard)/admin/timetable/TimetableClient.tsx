"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Check, Edit2, Sparkles, Lock, FileDown } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import ScheduleGrid from "./components/ScheduleGrid";
import AiScheduleModal from "./components/AiScheduleModal";
import { isAIQuotaReached } from "../actions/aiActions";
import { 
  getTimetableByClass, 
  moveTimetableSlot, 
  updateTimetableSlot,
  deleteTimetableSlot
} from "../actions/timetableActions";
import { generateTimetableFromPrompt } from "../actions/timetableAiActions";

const TimetablePage = ({
  classes,
  subjects,
  teachers,
  sessions,
  rooms,
}: {
  classes: any[];
  subjects: any[];
  teachers: any[];
  sessions?: any[];
  rooms: any[];
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiLocked, setIsAiLocked] = useState(false);

  // PDF Export Ref
  const gridRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: gridRef,
    documentTitle: `Timetable_${new Date().toLocaleDateString()}`,
  });

  useEffect(() => {
    isAIQuotaReached().then(setIsAiLocked);
  }, []);

  const classId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;

  const handleAiSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

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
            <div className="mb-1">
              <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center ${isEditMode ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isEditMode ? 'Edit Mode' : 'View Mode'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Academic Timetable
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">Manage weekly schedules for all grades.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* DOWNLOAD PDF BUTTON */}
          <button 
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg bg-slate-800 text-white hover:bg-slate-900 shadow-slate-100"
          >
            <FileDown size={14} />
            Download PDF
          </button>

          <div className="h-10 w-px bg-slate-100 mx-2"></div>

          <button 
            onClick={() => setIsAiOpen(true)}
            className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg group ${
              isAiLocked 
              ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-amber-100'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
            }`}
          >
            {isAiLocked ? <Lock size={14} /> : <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />}
            {isAiLocked ? 'Limite AI Atteinte' : 'AI Magic Generate'}
          </button>

          <div className="h-10 w-px bg-slate-100 mx-2"></div>

          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${
              isEditMode 
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-100 hover:bg-emerald-700' 
              : 'bg-white border-slate-100 text-slate-600 hover:border-indigo-200 hover:text-indigo-600'
            }`}
          >
            {isEditMode ? (
              <><><Check size={14} className="stroke-[3px]"/> Save Changes</></>
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
        <ScheduleGrid 
          ref={gridRef}
          classId={selectedClass.id} 
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
          isEditMode={isEditMode}
          refreshKey={refreshKey}
          type="timetable"
          fetchDataAction={getTimetableByClass}
          onMoveAction={moveTimetableSlot}
          onUpdateAction={updateTimetableSlot}
          onDeleteAction={deleteTimetableSlot}
          onRefresh={() => setRefreshKey(prev => prev + 1)}
          sessions={sessions}
        />
      )}

      {isAiOpen && selectedClass && (
        <AiScheduleModal 
          onClose={() => setIsAiOpen(false)}
          onSuccess={handleAiSuccess}
          title="AI Timetable Magic"
          classContext={{
            id: selectedClass.id,
            name: selectedClass.name,
            level: selectedClass.level.level
          }}
          subjects={subjects}
          teachers={teachers}
          generateAction={generateTimetableFromPrompt}
          saveAction={(slots) => bulkUpdateTimetableSlots(selectedClass.id, slots)}
        />
      )}
    </div>
  );
};

export default TimetablePage;
