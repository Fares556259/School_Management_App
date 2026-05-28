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
        router.push(`/admin/timetable?classId=${selectedClass.id}`);
        router.refresh();
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
        setIsDraftView(forceDraft);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
      } else {
        alert(res.error || "Failed to discard draft.");
      }
    }
  };

  return (
    <div className="p-4 flex flex-col gap-6 flex-1">
       {/* Unified Main Dashboard Header Card */}
      <div className="flex flex-col gap-5 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 transition-all duration-300">
        {/* Row 1: Header title and action buttons */}
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border transition-all duration-300 ${
              forceDraft 
                ? "bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white border-transparent" 
                : "bg-indigo-50 text-indigo-600 border-indigo-100"
            }`}>
               {forceDraft ? <Sparkles size={22} className="stroke-[2px] animate-pulse" /> : <Clock size={22} className="stroke-[2.5px]" />}
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center transition-all ${
                  isEditMode 
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm animate-pulse' 
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}>
                  {isEditMode ? 'Edit Mode' : 'View Mode'}
                </span>
                {forceDraft && (
                  <span className="text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center bg-purple-50 text-purple-600 border-purple-100 shadow-sm">
                    AI Scheduler
                  </span>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">
                  {forceDraft ? "AI Scheduler Playground" : "Academic Timetable"}
                </h1>
                
                {/* Sleek inline dropdown next to the title */}
                <div className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl px-2.5 py-1 transition-all w-fit">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest pl-1">Class</span>
                  <select 
                    className="bg-transparent border-0 text-[10px] font-black text-slate-700 focus:outline-none transition-all cursor-pointer uppercase tracking-wider pr-2"
                    value={selectedClass?.id}
                    onChange={(e) => {
                      router.push(`${forceDraft ? "/admin/timetable/ai" : "/admin/timetable"}?classId=${e.target.value}`);
                    }}
                  >
                    {classes.map(cls => (
                      <option key={cls.id} value={cls.id} className="bg-white">
                        Grade {cls.level.level} - {cls.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2.5 opacity-60">
                {forceDraft ? "Plan, generate, and optimize curriculum drafts." : "Manage weekly schedules for all grades."}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {!isEditMode ? (
              <>
                {/* DOWNLOAD PDF BUTTON */}
                <button 
                  onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md bg-slate-800 text-white hover:bg-slate-900 shadow-slate-100 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileDown size={14} />
                  Download PDF
                </button>

                {/* AI GENERATE BUTTON */}
                {forceDraft && (
                  <button 
                    onClick={() => setIsAiOpen(true)}
                    className={`flex items-center gap-2 px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-md group hover:scale-[1.02] active:scale-[0.98] ${
                      isAiLocked 
                      ? 'bg-slate-100 border border-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                      : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-100/50'
                    }`}
                  >
                    {isAiLocked ? <Lock size={14} /> : <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />}
                    {isAiLocked ? 'Limite AI Atteinte' : hasDraft ? 'Regenerate with AI' : 'AI Magic Generate'}
                  </button>
                )}

                {/* EDIT TIMETABLE BUTTON */}
                <button 
                  onClick={() => setIsEditMode(true)}
                  className="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 bg-white border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Edit2 size={14} className="stroke-[3px]"/> Edit Schedule
                </button>

                {/* DIRECT HEADER PUBLISH/DISCARD DRAFTS */}
                {forceDraft && hasDraft && (
                  <>
                    <button
                      onClick={handlePublishDraft}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-emerald-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Approve & Publish
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-5 py-2.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Discard Suggestion
                    </button>
                  </>
                )}
              </>
            ) : (
              /* EDITING MODE ACTIVE - SHOW ONLY DONE EDITING */
              <button 
                onClick={() => setIsEditMode(false)}
                className="px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 border-2 bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 hover:bg-emerald-700 hover:scale-[1.02] active:scale-[0.98]"
              >
                <Check size={14} className="stroke-[3px]"/> Done Editing
              </button>
            )}
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
