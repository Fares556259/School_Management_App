"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Clock, Check, Edit2, Sparkles, Lock, FileDown, Eye, CalendarDays, ChevronDown, AlertTriangle } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import ScheduleGrid from "./components/ScheduleGrid";
import AiScheduleModal from "./components/AiScheduleModal";
import { toast } from "react-toastify";
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
  dayStartTime,
  dayEndTime,
  rooms,
  allActiveSlots,
  forceDraft = false,
}: {
  classes: any[];
  subjects: any[];
  teachers: any[];
  dayStartTime?: string;
  dayEndTime?: string;
  rooms: any[];
  allActiveSlots?: any[];
  forceDraft?: boolean;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiLocked, setIsAiLocked] = useState(false);
  const [showEditWarningModal, setShowEditWarningModal] = useState(false);

  // Draft States
  const [isDraftView, setIsDraftView] = useState(forceDraft);
  const [hasDraft, setHasDraft] = useState(false);

  // PDF Export Ref
  const gridRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: gridRef,
    documentTitle: `Timetable_${new Date().toLocaleDateString()}`,
  });

  const urlClassId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;
  const [clientClassId, setClientClassId] = useState<number | undefined>(urlClassId);
  const selectedClass = clientClassId 
    ? classes.find(c => c.id === clientClassId) 
    : urlClassId 
      ? classes.find(c => c.id === urlClassId) 
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
    if (window.confirm(t.confirmations.publishScheduleMessage)) {
      const res = await publishDraftTimetable(selectedClass.id);
      if (res.success) {
        setIsDraftView(false);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
        router.push(`/admin/timetable?classId=${selectedClass.id}`);
        router.refresh();
        toast.success(t.toasts.draftPublished);
      } else {
        toast.error(res.error || t.toasts.failedToPublishDraft);
      }
    }
  };

  const handleDiscardDraft = async () => {
    if (!selectedClass?.id) return;
    if (window.confirm(t.confirmations.discardDraftMessage)) {
      const res = await discardDraftTimetable(selectedClass.id);
      if (res.success) {
        setIsDraftView(forceDraft);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
        toast.success(t.toasts.draftDiscarded);
      } else {
        toast.error(res.error || t.toasts.failedToDiscardDraft);
      }
    }
  };

  const classSlots = React.useMemo(() => {
    if (isDraftView || !selectedClass) return undefined;
    return (allActiveSlots || []).filter((s: any) => s.classId === selectedClass.id);
  }, [allActiveSlots, selectedClass?.id, isDraftView]);

  return (
    <div className="p-6 lg:p-10 flex flex-col gap-8 flex-1 bg-white">
       {/* Unified Main Dashboard Header Card */}
      <div className="flex flex-col gap-6 w-full">
        {/* Row 1: Header title and action buttons */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1 text-[12px] font-medium text-[#5a5a5a]">
                <span>{forceDraft ? t.timetable.aiPlayground : t.timetable.registry}</span>
                <span className="w-1 h-1 rounded-full bg-[#dddddd]"></span>
                <span className={`flex items-center gap-1.5 ${isEditMode ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEditMode ? 'bg-amber-600 animate-pulse' : 'bg-emerald-600'}`}></span>
                  {isEditMode ? t.timetable.editMode : t.timetable.viewMode}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {forceDraft ? <Sparkles size={24} className="text-[#181d26]" /> : <CalendarDays size={24} className="text-[#181d26]" />}
                <h1 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">
                  {forceDraft ? t.timetable.aiScheduler : t.timetable.academicTimetable}
                </h1>
              </div>
              
              {/* PRO VIEW BAR (Airtable-style filter bar) */}
              <div className="flex items-center bg-[#f8fafc] border border-[#dddddd] rounded-[6px] px-2 py-1.5 gap-2 w-fit mt-4">
                {/* Target Class */}
                <div className="flex items-center gap-2 px-2 shrink-0">
                  <span className="text-[12px] font-medium text-[#41454d] capitalize tracking-wide">{t.timetable.class}</span>
                  <div className="relative inline-flex items-center">
                    <select 
                      className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none transition-all cursor-pointer pr-5 appearance-none"
                      value={selectedClass?.id}
                      onChange={(e) => {
                        if (forceDraft) {
                          router.push(`/admin/timetable/ai?classId=${e.target.value}`);
                        } else {
                          setClientClassId(parseInt(e.target.value));
                        }
                      }}
                    >
                      {classes.map(cls => (
                        <option key={cls.id} value={cls.id} className="bg-white text-[#181d26]">
                          {cls.level.level === 0 ? cls.name : `${t.timetable.grade} ${cls.level.level} - ${cls.name}`}
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
                      onClick={() => setShowEditWarningModal(true)}
                      className="px-4 py-2.5 rounded-[6px] bg-[#ffffff] border border-[#dddddd] font-medium text-[13px] active:scale-[0.98] text-[#181d26] hover:bg-[#f8fafc] transition-all flex items-center gap-2 shadow-sm"
                    >
                      <Edit2 size={14} className="text-[#41454d]" /> {t.timetable.editSchedule}
                    </button>

                    {/* AI GENERATE BUTTON */}
                    <button 
                      onClick={() => setIsAiOpen(true)}
                      disabled={isAiLocked}
                      className={`flex items-center gap-2 px-4 py-2.5 text-[13px] active:scale-[0.98] font-medium rounded-[6px] transition-all shadow-sm ${
                        isAiLocked 
                        ? 'bg-[#f8fafc] border border-[#dddddd] text-[#9297a0] cursor-not-allowed'
                        : 'bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent'
                      }`}
                    >
                      {isAiLocked ? <Lock size={14} /> : <Sparkles size={14} />}
                      {isAiLocked ? t.timetable.limitReached : hasDraft ? t.timetable.regenerate : t.timetable.aiGenerate}
                    </button>
                  </div>
                ) : (
                  /* STANDALONE EDIT SCHEDULE BUTTON */
                  <button 
                    onClick={() => setShowEditWarningModal(true)}
                    className="px-4 py-2.5 rounded-[6px] bg-[#ffffff] border border-[#dddddd] font-medium text-[13px] active:scale-[0.98] text-[#181d26] hover:bg-[#f8fafc] transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Edit2 size={14} className="text-[#41454d]" /> {t.timetable.editSchedule}
                  </button>
                )}

                {/* 2. Direct Header Publish / Discard Capsule Group */}
                {forceDraft && hasDraft && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePublishDraft}
                      className="px-4 py-2.5 bg-[#181d26] hover:bg-[#0d1218] text-white text-[13px] active:scale-[0.98] font-medium rounded-[6px] transition-all shadow-sm"
                    >
                      {t.timetable.publish}
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-4 py-2.5 bg-[#ffffff] border border-[#dddddd] hover:bg-rose-50 text-rose-600 text-[13px] active:scale-[0.98] font-medium rounded-[6px] transition-all shadow-sm"
                    >
                      {t.timetable.discard}
                    </button>
                  </div>
                )}

                {/* 3. Export Utility (Standalone Outline Button) */}
                <button 
                  onClick={() => handlePrint()}
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] active:scale-[0.98] font-medium rounded-[6px] transition-all border border-[#dddddd] bg-[#ffffff] text-[#181d26] hover:bg-[#f8fafc] shadow-sm"
                >
                  <FileDown size={14} className="text-[#41454d]" />
                  {t.timetable.exportPdf}
                </button>
              </>
            ) : (
              /* EDITING MODE ACTIVE - SHOW ONLY DONE EDITING */
              <button 
                onClick={() => setIsEditMode(false)}
                className="px-4 py-2.5 rounded-[6px] font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 bg-[#181d26] text-white hover:bg-[#0d1218] shadow-sm"
              >
                <Check size={14} /> {t.timetable.doneEditing}
              </button>
            )}
          </div>
        </div>

      </div>

      {selectedClass && (
        <ScheduleGrid 
          ref={gridRef}
          classId={selectedClass.id} 
          classNameStr={selectedClass.name}
          slots={classSlots}
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
          isEditMode={isEditMode}
          refreshKey={refreshKey}
          type="timetable"
          fetchDataAction={getTimetableByClass}
          allActiveSlots={allActiveSlots || []}
          onMoveAction={moveTimetableSlot}
          onUpdateAction={updateTimetableSlot}
          onDeleteAction={deleteTimetableSlot}
          onRefresh={() => {
            setRefreshKey(prev => prev + 1);
            router.refresh();
          }}
          dayStartTime={dayStartTime}
          dayEndTime={dayEndTime}
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

      {/* CLEAN & SIMPLE CONFIRMATION MODAL */}
      {showEditWarningModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 animate-in fade-in"
          onClick={() => setShowEditWarningModal(false)}
        >
          <div 
            className="bg-white rounded-[12px] border border-[#e2e8f0] w-full max-w-sm shadow-xl p-5 transition-all duration-200 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-[6px] bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                <Edit2 size={15} />
              </div>
              <h3 className="text-[15px] font-semibold text-[#181d26]">
                {t.timetable.liveEditWarning?.title || t.timetable.editSchedule}
              </h3>
            </div>
            
            <p className="text-[13px] text-[#5a5a5a] leading-relaxed mb-5">
              {t.timetable.liveEditWarning?.timetableDesc}
            </p>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowEditWarningModal(false)}
                className="px-3.5 py-2 rounded-[6px] border border-[#dddddd] bg-white hover:bg-[#f8fafc] text-[13px] font-medium text-[#41454d] transition-all active:scale-[0.98]"
              >
                {t.timetable.liveEditWarning?.cancel || "Annuler"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEditWarningModal(false);
                  setIsEditMode(true);
                }}
                className="px-4 py-2 rounded-[6px] bg-[#181d26] hover:bg-[#0d1218] text-white text-[13px] font-medium transition-all shadow-sm active:scale-[0.98] flex items-center gap-1.5"
              >
                <Edit2 size={13} />
                {t.timetable.liveEditWarning?.continueEdit || t.timetable.editSchedule}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetablePage;
