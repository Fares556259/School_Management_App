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
            <div className="w-14 h-14 rounded-3xl bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-slate-500/5 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-sm relative overflow-hidden group shrink-0">
              <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {forceDraft ? <Sparkles size={26} className="stroke-[2px] text-indigo-600 animate-pulse" /> : <Clock size={26} className="stroke-[2px] text-indigo-600" />}
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
              
              <h1 className="text-2xl font-semibold text-slate-800">
                {forceDraft ? "AI Timetable Scheduler" : "Academic Timetable"}
              </h1>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-500">Target Class:</span>
                  <div className="relative inline-flex items-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 transition-all">
                    <select 
                      className="bg-transparent border-0 text-sm font-medium text-slate-700 focus:outline-none transition-all cursor-pointer pr-6 appearance-none"
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
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-xs">▼</div>
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
                  <div className="flex items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-1 gap-1">
                    {/* EDIT TIMETABLE BUTTON */}
                    <button 
                      onClick={() => setIsEditMode(true)}
                      className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-medium text-sm text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:shadow-sm transition-all flex items-center gap-2"
                    >
                      <Edit2 size={14} className="stroke-[2.5px]"/> Edit Schedule
                    </button>

                    {/* AI GENERATE BUTTON */}
                    <button 
                      onClick={() => setIsAiOpen(true)}
                      disabled={isAiLocked}
                      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all hover:shadow-sm ${
                        isAiLocked 
                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 border border-transparent'
                      }`}
                    >
                      {isAiLocked ? <Lock size={14} /> : <Sparkles size={14} />}
                      {isAiLocked ? 'Limit Reached' : hasDraft ? 'Regenerate' : 'AI Generate'}
                    </button>
                  </div>
                ) : (
                  /* STANDALONE EDIT SCHEDULE BUTTON */
                  <button 
                    onClick={() => setIsEditMode(true)}
                    className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-medium text-sm text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:shadow-sm transition-all flex items-center gap-2"
                  >
                    <Edit2 size={14} className="stroke-[2.5px]"/> Edit Schedule
                  </button>
                )}

                {/* 2. Direct Header Publish / Discard Capsule Group */}
                {forceDraft && hasDraft && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePublishDraft}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all"
                    >
                      Publish
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-rose-50 text-rose-600 text-sm font-medium rounded-lg transition-all"
                    >
                      Discard
                    </button>
                  </div>
                )}

                {/* 3. Export Utility (Standalone Outline Button) */}
                <button 
                  onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-sm"
                >
                  <FileDown size={14} />
                  Export PDF
                </button>
              </>
            ) : (
              /* EDITING MODE ACTIVE - SHOW ONLY DONE EDITING */
              <button 
                onClick={() => setIsEditMode(false)}
                className="px-5 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
              >
                <Check size={16} className="stroke-[2.5px]"/> Done Editing
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
