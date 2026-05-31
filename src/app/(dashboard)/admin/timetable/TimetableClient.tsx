"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock, Check, Edit2, Sparkles, Lock, FileDown, Eye, CalendarDays, ChevronDown } from "lucide-react";
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
    <div className="p-6 lg:p-10 flex flex-col gap-8 flex-1 bg-white">
       {/* Unified Main Dashboard Header Card */}
      <div className="flex flex-col gap-6 w-full">
        {/* Row 1: Header title and action buttons */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm shrink-0">
              {forceDraft ? <Sparkles size={24} className="stroke-[2px]" /> : <CalendarDays size={24} className="stroke-[2px]" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-500">
                <span>{forceDraft ? "AI Timetable Playground" : "Timetable Registry"}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className={`flex items-center gap-1.5 ${isEditMode ? 'text-amber-500' : 'text-emerald-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEditMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                  {isEditMode ? 'Edit Mode' : 'View Mode'}
                </span>
              </div>
              
              <h1 className="text-2xl xl:text-3xl font-bold text-slate-800 tracking-tight mt-0.5">
                {forceDraft ? "AI Timetable Scheduler" : "Academic Timetable"}
              </h1>
              
              {/* PRO VIEW BAR (Airtable-style filter bar) */}
              <div className="flex items-center bg-[#f8fafc] border border-[#dddddd] rounded-lg px-2 py-1.5 gap-2 w-fit mt-4">
                {/* Target Class */}
                <div className="flex items-center gap-2 px-2 shrink-0">
                  <span className="text-xs font-semibold text-[#41454d] uppercase tracking-wider">Class</span>
                  <div className="relative inline-flex items-center">
                    <select 
                      className="bg-transparent border-0 text-sm font-medium text-[#181d26] focus:outline-none transition-all cursor-pointer pr-5 appearance-none"
                      value={selectedClass?.id}
                      onChange={(e) => {
                        router.push(`${forceDraft ? "/admin/timetable/ai" : "/admin/timetable"}?classId=${e.target.value}`);
                      }}
                    >
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id} className="bg-white text-slate-700">
                          Grade {cls.level.level} - {cls.name}
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                      <ChevronDown size={14} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
                    {/* Right Part: Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isEditMode ? (
              <>
                {/* 1. Design & Plan Capsule Group */}
                {forceDraft ? (
                  <div className="flex items-center gap-3">
                    {/* EDIT TIMETABLE BUTTON */}
                    <button 
                      onClick={() => setIsEditMode(true)}
                      className="px-6 py-3 rounded-xl bg-white border border-[#dddddd] font-medium text-sm active:scale-[0.98] text-[#181d26] hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <Edit2 size={16} /> Edit Schedule
                    </button>

                    {/* AI GENERATE BUTTON */}
                    <button 
                      onClick={() => setIsAiOpen(true)}
                      disabled={isAiLocked}
                      className={`flex items-center gap-2 px-6 py-3 text-sm active:scale-[0.98] font-medium rounded-xl transition-all ${
                        isAiLocked 
                        ? 'bg-[#f8fafc] border border-[#dddddd] text-[#9297a0] cursor-not-allowed'
                        : 'bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent'
                      }`}
                    >
                      {isAiLocked ? <Lock size={16} /> : <Sparkles size={16} />}
                      {isAiLocked ? 'Limit Reached' : hasDraft ? 'Regenerate' : 'AI Generate'}
                    </button>
                  </div>
                ) : (
                  /* STANDALONE EDIT SCHEDULE BUTTON */
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className="px-6 py-3 rounded-xl bg-white border border-[#dddddd] font-medium text-sm active:scale-[0.98] text-[#181d26] hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Edit2 size={16} /> Edit Schedule
                  </button>
                )}

                {/* 2. Direct Header Publish / Discard Capsule Group */}
                {forceDraft && hasDraft && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePublishDraft}
                      className="px-6 py-3 bg-[#181d26] hover:bg-[#0d1218] text-white text-sm active:scale-[0.98] font-medium rounded-xl transition-all"
                    >
                      Publish
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-6 py-3 bg-white border border-[#dddddd] hover:bg-rose-50 text-[#aa2d00] text-sm active:scale-[0.98] font-medium rounded-xl transition-all"
                    >
                      Discard
                    </button>
                  </div>
                )}

                {/* 3. Export Utility (Standalone Outline Button) */}
                <button 
                  onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-6 py-3 text-sm active:scale-[0.98] font-medium rounded-xl transition-all border border-[#dddddd] bg-white text-[#181d26] hover:bg-slate-50"
                >
                  <FileDown size={16} />
                  Export PDF
                </button>
              </>
            ) : (
              /* EDITING MODE ACTIVE - SHOW ONLY DONE EDITING */
              <button 
                onClick={() => setIsEditMode(false)}
                className="px-6 py-3 rounded-xl font-medium text-sm active:scale-[0.98] transition-all flex items-center gap-2 bg-[#181d26] text-white hover:bg-[#0d1218]"
              >
                <Check size={16} /> Done Editing
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
