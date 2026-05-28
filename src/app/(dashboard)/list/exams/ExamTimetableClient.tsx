"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, ClipboardCheck, Check, Edit2, Sparkles, Lock, FileDown } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import ScheduleGrid from "../../admin/timetable/components/ScheduleGrid";
import AiScheduleModal from "../../admin/timetable/components/AiScheduleModal";
import { isAIQuotaReached } from "../../admin/actions/aiActions";
import { 
  getExamsByClass, 
  moveExam, 
  updateExamSlot,
  deleteExam,
  bulkUpdateExams,
  getExamPeriodConfigs,
  upsertExamPeriodConfig,
  publishDraftExams,
  discardDraftExams
} from "../../admin/actions/examActions";
import ExamTimetablePrint from "../../admin/timetable/components/ExamTimetablePrint";
import { defaultSessions } from "../../admin/timetable/components/ScheduleGrid";
import { getSchoolConfig } from "../../admin/actions/schoolActions";
import { generateExamsFromPrompt } from "../../admin/actions/examAiActions";

const ExamTimetableClient = ({ 
  classes, 
  subjects, 
  teachers, 
  rooms,
  role,
  forceDraft = false
}: { 
  classes: any[]; 
  subjects: any[]; 
  teachers: any[]; 
  rooms: any[];
  role: string;
  forceDraft?: boolean;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditMode, setIsEditMode] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAiLocked, setIsAiLocked] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState(1);
  const [periodConfigs, setPeriodConfigs] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolConfig, setSchoolConfig] = useState<any>(null);
  const [dynamicSessions, setDynamicSessions] = useState<any[]>(defaultSessions);

  // Draft States
  const [isDraftView, setIsDraftView] = useState(forceDraft);
  const [hasDraft, setHasDraft] = useState(false);

  // PDF Export Ref
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `ExamsSchedule_${new Date().toLocaleDateString()}`,
  });

  const classId = searchParams.get("classId") ? parseInt(searchParams.get("classId")!) : undefined;

  const selectedClass = classId 
    ? classes.find(c => c.id === classId) 
    : classes[0];

  const fetchSlots = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    const res = await getExamsByClass(selectedClass.id, selectedPeriod, isDraftView);
    if (res.success && res.data) {
      setSlots(res.data as any[]);
    }
    setLoading(false);
  }, [selectedClass, selectedPeriod, isDraftView]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots, refreshKey]);

  useEffect(() => {
    isAIQuotaReached().then(setIsAiLocked);
    getExamPeriodConfigs().then(res => {
      if (res.success && res.data) setPeriodConfigs(res.data);
    });
    getSchoolConfig().then(res => {
      if (res.success && res.data) {
        setSchoolConfig(res.data);
        if (res.data.sessions) {
          try {
            const parsed = typeof res.data.sessions === 'string' ? JSON.parse(res.data.sessions) : res.data.sessions;
            if (Array.isArray(parsed) && parsed.length > 0) {
              setDynamicSessions(parsed);
            }
          } catch (e) { console.error("Session parse error", e); }
        }
      }
    });
  }, []);

  // Check if draft exists
  useEffect(() => {
    if (selectedClass?.id) {
      getExamsByClass(selectedClass.id, selectedPeriod, true).then(res => {
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
  }, [selectedClass?.id, selectedPeriod, refreshKey, forceDraft]);

  const handleDateChange = async (field: 'startDate' | 'endDate', dateStr: string) => {
    if (!dateStr) return;
    
    // Parse local date carefully to avoid TZ shift
    const [year, month, day] = dateStr.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);

    const currentConf = periodConfigs.find(c => c.period === selectedPeriod);
    const updatedStart = field === 'startDate' ? newDate : (currentConf?.startDate ? new Date(currentConf.startDate) : newDate);
    const updatedEnd = field === 'endDate' ? newDate : (currentConf?.endDate ? new Date(currentConf.endDate) : undefined);

    const res = await upsertExamPeriodConfig(selectedPeriod, updatedStart, updatedEnd);
    if (res.success) {
      getExamPeriodConfigs().then(r => {
        if (r.success && r.data) setPeriodConfigs(r.data);
      });
      setRefreshKey(prev => prev + 1);
    }
  };

  const handlePublishDraft = async () => {
    if (!selectedClass?.id) return;
    if (window.confirm("Are you sure you want to approve and publish this exam draft suggestion? It will replace the current active exams schedule and become visible to students and parents.")) {
      const res = await publishDraftExams(selectedClass.id, selectedPeriod);
      if (res.success) {
        setIsDraftView(false);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
        router.push(`/list/exams?classId=${selectedClass.id}`);
        router.refresh();
      } else {
        alert(res.error || "Failed to publish exam draft.");
      }
    }
  };

  const handleDiscardDraft = async () => {
    if (!selectedClass?.id) return;
    if (window.confirm("Are you sure you want to discard this suggested exam draft? All changes in this draft will be permanently deleted.")) {
      const res = await discardDraftExams(selectedClass.id, selectedPeriod);
      if (res.success) {
        setIsDraftView(forceDraft);
        setHasDraft(false);
        setRefreshKey(prev => prev + 1);
      } else {
        alert(res.error || "Failed to discard draft.");
      }
    }
  };

  const toLocalISO = (date?: Date) => {
    if (!date) return "";
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const currentPeriodConfig = periodConfigs.find(c => c.period === selectedPeriod);
  const currentStartDate = currentPeriodConfig ? new Date(currentPeriodConfig.startDate) : undefined;
  const currentEndDate = currentPeriodConfig?.endDate ? new Date(currentPeriodConfig.endDate) : undefined;

  const handleAiSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-4 flex flex-col gap-6 flex-1 bg-[#F7F8FA]">
      {/* Unified Main Dashboard Header Card */}
      <div className="flex flex-col gap-5 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 transition-all duration-300">
        <div className="flex flex-col xl:flex-row items-center justify-between gap-6 w-full">
          {/* Left Part: Icon, Title, and Scope Selector */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
               <ClipboardCheck size={24} className="stroke-[2.5px]" />
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center ${isEditMode ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
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
                  {forceDraft ? "AI Exam Scheduler Playground" : "Academic Exams"}
                </h1>
                
                {/* Sleek inline dropdown next to the title */}
                <div className="inline-flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-100 rounded-xl px-2.5 py-1 transition-all w-fit">
                  <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest pl-1">Class</span>
                  <select 
                    className="bg-transparent border-0 text-[10px] font-black text-slate-700 focus:outline-none transition-all cursor-pointer uppercase tracking-wider pr-2"
                    value={selectedClass?.id}
                    onChange={(e) => {
                      const params = new URLSearchParams(searchParams);
                      params.set("classId", e.target.value);
                      startTransition(() => {
                          router.push(`${forceDraft ? "/admin/timetable/ai?type=exam" : "/list/exams"}?${params.toString()}`);
                      });
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
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">
                {forceDraft ? "Plan, generate, and optimize exam drafts." : "Manage and monitor examination calendars."}
              </p>
            </div>
          </div>

          {/* Right Part: Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isEditMode ? (
              <>
                {/* 1. Design & Plan Capsule Group */}
                {(role === "admin" || role === "teacher") && (
                  <div className="flex items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-1 gap-1">
                    {/* EDIT TOGGLE BUTTON */}
                    <button 
                      onClick={() => setIsEditMode(true)}
                      className="px-4.5 py-2 rounded-xl bg-white border border-slate-200/60 font-black text-[9px] uppercase tracking-widest text-slate-600 hover:border-indigo-500 hover:text-indigo-600 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Edit2 size={12} className="stroke-[3px]"/> Edit Schedule
                    </button>

                    {/* AI GENERATE BUTTON */}
                    <button 
                      onClick={() => setIsAiOpen(true)}
                      disabled={isAiLocked}
                      className={`flex items-center gap-1.5 px-4.5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm ${
                        isAiLocked 
                        ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                        : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 shadow-indigo-100/50'
                      }`}
                    >
                      {isAiLocked ? <Lock size={12} /> : <Sparkles size={12} />}
                      {isAiLocked ? 'Limit' : hasDraft ? 'Regenerate' : 'AI Generate'}
                    </button>
                  </div>
                )}

                {/* 2. Direct Header Publish / Discard Capsule Group */}
                {forceDraft && hasDraft && (role === "admin" || role === "teacher") && (
                  <div className="flex items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-1 gap-1">
                    <button
                      onClick={handlePublishDraft}
                      className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-md shadow-emerald-100/50 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Publish
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-4.5 py-2 bg-rose-50 border border-rose-200/55 hover:bg-rose-100 text-rose-700 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      Discard
                    </button>
                  </div>
                )}

                {/* 3. Export Utility (Standalone Outline Button) */}
                <button 
                  onClick={() => handlePrint()}
                  className="flex items-center gap-1.5 px-4.5 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileDown size={12} />
                  PDF
                </button>
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

      {/* PERIOD SELECTOR SECTION */}
      <div className="flex items-center justify-between gap-4 bg-white px-8 py-4 rounded-[24px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 pr-6">Exam Period</div>
           <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100 gap-1">
              {[1, 2, 3].map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-8 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    selectedPeriod === p 
                    ? 'bg-white text-indigo-600 shadow-md shadow-indigo-100/50 border border-indigo-100' 
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                  }`}
                >
                  Week {p}
                </button>
              ))}
           </div>
        </div>
        <div className="h-10 w-px bg-slate-100 mx-6"></div>
         <div className="flex items-center gap-6">
            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 gap-3 items-center">
              <div className="flex items-center gap-6 px-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon size={14} className="text-slate-400" />
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Start</span>
                  <input 
                    type="date" 
                    value={toLocalISO(currentStartDate)}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    disabled={!isEditMode}
                    className={`bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black text-indigo-600 shadow-sm focus:outline-none focus:border-indigo-400 transition-all outline-none ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-200'}`}
                  />
                </div>
                <div className="w-px h-4 bg-slate-200"></div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">End</span>
                  <input 
                    type="date" 
                    value={toLocalISO(currentEndDate)}
                    onChange={(e) => handleDateChange('endDate', e.target.value)}
                    disabled={!isEditMode}
                    className={`bg-white border border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black text-indigo-600 shadow-sm focus:outline-none focus:border-indigo-400 transition-all outline-none ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-indigo-200'}`}
                  />
                </div>
              </div>
            </div>
          </div>
      </div>

      {/* TIMETABLE GRID */}
      {selectedClass && (
        <div className={(isPending || loading) ? "opacity-50 transition-opacity" : ""}>
          {loading ? (
             <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-slate-100 animate-pulse">
                <div className="w-16 h-16 border-[6px] border-slate-50 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                   Synchronizing Exam Schedule...
                </p>
             </div>
          ) : (
            <ScheduleGrid 
              slots={slots}
              classId={selectedClass.id} 
              subjects={subjects}
              teachers={teachers}
              rooms={rooms}
              isEditMode={isEditMode}
              refreshKey={refreshKey}
              type="exam"
              examPeriod={selectedPeriod}
              startDate={currentStartDate}
              endDate={currentEndDate}
              onMoveAction={moveExam}
              onUpdateAction={(data) => updateExamSlot({ ...data, isDraft: isDraftView })}
              onDeleteAction={deleteExam}
              onRefresh={() => setRefreshKey(prev => prev + 1)}
              sessions={dynamicSessions}
              isDraft={isDraftView}
            />
          )}
        </div>
      )}

      {/* HIDDEN PRINT COMPONENT */}
      {selectedClass && schoolConfig && (
        <ExamTimetablePrint 
          ref={printRef}
          slots={slots}
          schoolConfig={schoolConfig}
          classInfo={{
            name: selectedClass.name,
            level: selectedClass.level.level
          }}
          examPeriod={selectedPeriod}
          startDate={currentStartDate}
          endDate={currentEndDate}
          subjects={subjects}
          teachers={teachers}
          sessions={dynamicSessions}
        />
      )}

      {isAiOpen && selectedClass && (
        <AiScheduleModal 
          onClose={() => setIsAiOpen(false)}
          onSuccess={handleAiSuccess}
          title="AI Exam Magic"
          classContext={{
            id: selectedClass.id,
            name: selectedClass.name,
            level: selectedClass.level.level
          }}
          subjects={subjects}
          teachers={teachers}
          generateAction={(p, c, s, t) => generateExamsFromPrompt(p, c, s, t, selectedPeriod)}
          saveAction={(slots) => bulkUpdateExams(selectedClass.id, selectedPeriod, slots, isDraftView)}
        />
      )}
    </div>
  );
};

export default ExamTimetableClient;
