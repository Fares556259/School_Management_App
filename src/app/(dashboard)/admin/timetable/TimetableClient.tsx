"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Check, Edit2, Sparkles, Lock, FileDown, Eye } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import ScheduleGrid from "./components/ScheduleGrid";
import AiScheduleModal from "./components/AiScheduleModal";
import { isAIQuotaReached } from "../actions/aiActions";
import { 
  getTimetableByClass, 
  moveTimetableSlot, 
  updateTimetableSlot,
  deleteTimetableSlot,
  bulkUpdateTimetableSlots,
  publishDraftTimetable,
  discardDraftTimetable
} from "../actions/timetableActions";
import { generateTimetableFromPrompt } from "../actions/timetableAiActions";

const TimetablePage = ({
  classes,
  subjects,
  teachers,
  sessions,
  rooms,
  forceDraft = false,
}: {
  classes: any[];
  subjects: any[];
  teachers: any[];
  sessions?: any[];
  rooms: any[];
  forceDraft?: boolean;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiLocked, setIsAiLocked] = useState(false);

  // Draft States
  const [isDraftView, setIsDraftView] = useState(forceDraft);
  const [hasDraft, setHasDraft] = useState(false);

  // PDF Export Ref
  const gridRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: gridRef,
    documentTitle: `Timetable_${new Date().toLocaleDateString()}`,
  });

  const classId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;
  const selectedClass = classId 
    ? classes.find(c => c.id === classId) 
    : classes.find(c => c.name === "1A") || classes[0];

  useEffect(() => {
    isAIQuotaReached().then(setIsAiLocked);
  }, []);

  // Check if draft exists for the selected class
  useEffect(() => {
    if (selectedClass?.id) {
      getTimetableByClass(selectedClass.id, true).then(res => {
        const draftExists = !!(res.success && res.data && res.data.length > 0);
        if (forceDraft) {
          setHasDraft(draftExists);
          setIsDraftView(true);
        } else {
          setHasDraft(false);
          setIsDraftView(false);
        }
      });
    }
  }, [selectedClass?.id, refreshKey, forceDraft]);

  const handleAiSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handlePublishDraft = async () => {
    if (!selectedClass?.id) return;
    if (window.confirm("Are you sure you want to approve and publish this draft suggestion? It will replace the current active schedule and become visible to teachers and parents.")) {
      const res = await publishDraftTimetable(selectedClass.id);
      if (res.success) {
        setIsDraftView(false);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
      } else {
        alert(res.error || "Failed to publish draft.");
      }
    }
  };

  const handleDiscardDraft = async () => {
    if (!selectedClass?.id) return;
    if (window.confirm("Are you sure you want to discard this suggested draft? All changes in this draft will be permanently deleted.")) {
      const res = await discardDraftTimetable(selectedClass.id);
      if (res.success) {
        setIsDraftView(false);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
      } else {
        alert(res.error || "Failed to discard draft.");
      }
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 flex-1">
      <div className="flex flex-col xl:flex-row items-center justify-between gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
             <Clock size={24} className="stroke-[2.5px]" />
          </div>
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center ${isEditMode ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isEditMode ? 'Edit Mode' : 'View Mode'}
              </span>
              {forceDraft && (
                <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center ${isDraftView ? 'bg-amber-500 text-white border-amber-600' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                  {isDraftView ? 'Draft View' : 'Published View'}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">
              {forceDraft ? "AI Scheduler Playground" : "Academic Timetable"}
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">
              {forceDraft ? "Plan, generate, and optimize curriculum drafts." : "Manage weekly schedules for all grades."}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* DOWNLOAD PDF BUTTON */}
          <button 
            onClick={() => handlePrint()}
            className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg bg-slate-800 text-white hover:bg-slate-900 shadow-slate-100"
          >
            <FileDown size={14} />
            Download PDF
          </button>

          <div className="h-10 w-px bg-slate-100 mx-1 hidden sm:block"></div>

          {/* AI GENERATE BUTTON */}
          {forceDraft && (
            <>
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

              <div className="h-10 w-px bg-slate-100 mx-1 hidden sm:block"></div>
            </>
          )}

          {/* EDIT TIMETABLE BUTTON */}
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

          <div className="h-10 w-px bg-slate-100 mx-1 hidden sm:block"></div>

          {/* DRAFT VIEW SELECT SWITCHER */}
          {forceDraft && (
            <>
              <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                <button 
                  onClick={() => setIsDraftView(false)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                    !isDraftView 
                    ? 'bg-white text-slate-700 shadow-sm border border-slate-100' 
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Active
                </button>
                <button 
                  onClick={() => setIsDraftView(true)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${
                    isDraftView 
                    ? 'bg-amber-500 text-white shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Draft Suggestion
                  {hasDraft && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>}
                </button>
              </div>

              <div className="h-10 w-px bg-slate-100 mx-1 hidden sm:block"></div>
            </>
          )}

          {/* CLASS SELECTOR */}
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-3">Class</label>
            <select 
              className="bg-white border border-slate-100 rounded-lg px-4 py-2 text-xs font-black text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-white uppercase tracking-wider"
              value={selectedClass?.id}
              onChange={(e) => {
                router.push(`${forceDraft ? "/admin/timetable/ai" : "/admin/timetable"}?classId=${e.target.value}`);
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

      {/* DRAFT REVIEW BANNER */}
      {hasDraft && (
        <div className={`p-5 rounded-[24px] border flex flex-col md:flex-row items-center justify-between gap-4 transition-all duration-300 ${
          isDraftView 
          ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm shadow-amber-50/50' 
          : 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm shadow-indigo-50/50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg shadow-sm border ${
              isDraftView ? 'bg-amber-100 border-amber-200 text-amber-700 font-bold' : 'bg-indigo-100 border-indigo-200 text-indigo-700 font-bold'
            }`}>
              {isDraftView ? "💡" : "⚡"}
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight">
                {isDraftView 
                  ? "Reviewing Suggested Draft Plan (Draft Mode)" 
                  : "An AI-generated draft suggestion is ready for review"}
              </p>
              <p className="text-xs font-semibold opacity-70 mt-0.5">
                {isDraftView 
                  ? "This timetable is only visible to you. Teachers, parents, and students still see the Active schedule." 
                  : "Click the toggle above or the button to review the suggested schedule before publishing."}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDraftView(!isDraftView)}
              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border ${
                isDraftView 
                ? 'bg-white border-amber-200 text-amber-700 hover:bg-amber-100/50' 
                : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100/50'
              }`}
            >
              {isDraftView ? "View Active Timetable" : "View Suggested Draft"}
            </button>

            {isDraftView && (
              <>
                <button
                  onClick={handlePublishDraft}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-emerald-100 transition-all"
                >
                  Approve & Publish
                </button>
                <button
                  onClick={handleDiscardDraft}
                  className="px-4 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                >
                  Discard Suggestion
                </button>
              </>
            )}
          </div>
        </div>
      )}

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
          isDraft={isDraftView}
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
          saveAction={(slots) => bulkUpdateTimetableSlots(selectedClass.id, slots, true)}
        />
      )}
    </div>
  );
};

export default TimetablePage;
