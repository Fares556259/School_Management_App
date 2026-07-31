"use client";

import { useState, useEffect, useTransition, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Calendar as CalendarIcon, ClipboardCheck, Check, Edit2, Sparkles, Lock, FileDown, ChevronDown, Send } from "lucide-react";
import { useReactToPrint } from "react-to-print";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { toast } from "react-toastify";
import { createClient } from "@/utils/supabase/client";
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
  discardDraftExams,
  publishExamScheduleToStudents
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
  const { t } = useLanguage();
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
  const [isPublishing, setIsPublishing] = useState(false);

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

  useEffect(() => {
    if (selectedClass?.id) {
      getExamPeriodConfigs(selectedClass.id).then(res => {
        if (res.success && res.data) setPeriodConfigs(res.data);
      });
    }
  }, [selectedClass?.id]);

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

  const handleSaveDates = async () => {
    if (!localStartDate) return;
    
    const [yS, mS, dS] = localStartDate.split('-').map(Number);
    let updatedStart = new Date(yS, mS - 1, dS);

    let updatedEnd: Date | undefined = undefined;
    if (localEndDate) {
      const [yE, mE, dE] = localEndDate.split('-').map(Number);
      updatedEnd = new Date(yE, mE - 1, dE);
    }

    // Enforce Start <= End logic
    if (updatedEnd && updatedStart > updatedEnd) {
      updatedEnd = new Date(updatedStart);
      setLocalEndDate(toLocalISO(updatedEnd));
    }

    const res = await upsertExamPeriodConfig(selectedPeriod, updatedStart, updatedEnd, selectedClass?.id);
    if (res.success) {
      getExamPeriodConfigs(selectedClass?.id).then(r => {
        if (r.success && r.data) setPeriodConfigs(r.data);
      });
      setRefreshKey(prev => prev + 1);
    } else {
      alert("Failed to save dates: " + res.error);
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

  const [localStartDate, setLocalStartDate] = useState<string>("");
  const [localEndDate, setLocalEndDate] = useState<string>("");

  const hasUnsavedDates = localStartDate !== toLocalISO(currentStartDate) || localEndDate !== toLocalISO(currentEndDate);

  useEffect(() => {
    setLocalStartDate(toLocalISO(currentStartDate));
    setLocalEndDate(toLocalISO(currentEndDate));
  }, [currentPeriodConfig, selectedPeriod]);

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

  const handlePublishToStudents = async () => {
    if (!selectedClass?.id) return;
    if (!printRef.current) return;

    if (!window.confirm("Are you sure you want to generate the PDF and publish it to all students in this class? They will receive a notification immediately.")) return;

    setIsPublishing(true);
    const toastId = toast.loading("Generating PDF...");
    
    try {
      // 1. Generate PDF (temporarily make print block visible for html2canvas if needed, but react-to-print uses iframe. For html2canvas we need it in DOM. Since it has `hidden print:block`, we need to temporarily unhide it)
      const el = printRef.current;
      const originalDisplay = el.style.display;
      el.classList.remove("hidden");
      el.style.display = "block";

      const canvas = await html2canvas(el, { scale: 2, useCORS: true });
      
      // restore
      el.classList.add("hidden");
      el.style.display = originalDisplay;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');

      // 2. Upload to Supabase
      toast.update(toastId, { render: "Uploading PDF...", type: "info", isLoading: true });
      const supabase = createClient();
      const fileName = `exam_timetable_${selectedClass.id}_period_${selectedPeriod}_${Date.now()}.pdf`;
      
      const { error: uploadError } = await supabase.storage.from('uploads').upload(fileName, pdfBlob);
      if (uploadError) throw new Error("Failed to upload PDF: " + uploadError.message);

      const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);

      // 3. Update database and send notifications
      toast.update(toastId, { render: "Notifying students...", type: "info", isLoading: true });
      const res = await publishExamScheduleToStudents(selectedClass.id, selectedPeriod, publicUrl);
      
      if (!res.success) throw new Error(res.error || "Failed to notify students");

      toast.update(toastId, { render: "Successfully published to students!", type: "success", isLoading: false, autoClose: 3000 });
    } catch (err: any) {
      console.error(err);
      toast.update(toastId, { render: err.message || "An error occurred", type: "error", isLoading: false, autoClose: 4000 });
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAiSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="p-6 lg:p-10 flex flex-col gap-8 flex-1 bg-white">
      {/* Unified Main Dashboard Header Card */}
      <div className="flex flex-col gap-6 w-full">
        {/* Row 1: Header title and action buttons */}
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 w-full">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 shadow-sm shrink-0">
              <ClipboardCheck size={24} className="stroke-[2px]" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-slate-500">
                <span>{forceDraft ? t.exams.aiPlayground : t.exams.registry}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className={`flex items-center gap-1.5 ${isEditMode ? 'text-amber-500' : 'text-emerald-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEditMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                  {isEditMode ? t.timetable.editMode : t.timetable.viewMode}
                </span>
              </div>
              
              <h1 className="text-2xl xl:text-3xl font-bold text-slate-800 tracking-tight mt-0.5">
                {forceDraft ? t.exams.aiScheduler : t.exams.academicExams}
              </h1>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-slate-500 hidden">
                {/* Removed messy inline controls */}
              </div>
            </div>
          </div>

          {/* Right Part: Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {!isEditMode ? (
              <>
                {/* 1. Design & Plan Capsule Group */}
                {(role === "admin" || role === "teacher") && (
                  forceDraft ? (
                    <div className="flex items-center gap-3">
                      {/* EDIT TOGGLE BUTTON */}
                      <button 
                        onClick={() => setIsEditMode(true)}
                        className="px-6 py-3 rounded-xl bg-white border border-[#dddddd] font-medium text-sm text-[#181d26] hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2"
                      >
                        <Edit2 size={16} /> {t.timetable.editSchedule}
                      </button>

                      {/* AI GENERATE BUTTON */}
                      <button 
                        onClick={() => setIsAiOpen(true)}
                        disabled={isAiLocked}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl transition-all active:scale-[0.98] ${
                          isAiLocked 
                          ? 'bg-slate-100 border border-[#dddddd] text-slate-400 cursor-not-allowed'
                          : 'bg-[#181d26] text-white hover:bg-[#0d1218]'
                        }`}
                      >
                        {isAiLocked ? <Lock size={16} /> : <Sparkles size={16} />}
                        {isAiLocked ? t.timetable.limitReached : hasDraft ? t.timetable.regenerate : t.timetable.aiGenerate}
                      </button>
                    </div>
                  ) : (
                    /* STANDALONE EDIT SCHEDULE BUTTON */
                    <button 
                      onClick={() => setIsEditMode(true)}
                      className="px-6 py-3 rounded-xl bg-white border border-[#dddddd] font-medium text-sm text-[#181d26] hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                      <Edit2 size={16} /> {t.timetable.editSchedule}
                    </button>
                  )
                )}

                {/* 2. Direct Header Publish / Discard Capsule Group */}
                {forceDraft && hasDraft && (role === "admin" || role === "teacher") && (
                  <div className="flex items-center gap-3 ml-2 pl-5 border-l border-[#dddddd]">
                    <button
                      onClick={handlePublishDraft}
                      className="px-6 py-3 bg-[#181d26] hover:bg-[#0d1218] text-white text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
                    >
                      {t.timetable.publish}
                    </button>
                    <button
                      onClick={handleDiscardDraft}
                      className="px-6 py-3 bg-white border border-[#dddddd] hover:bg-slate-50 text-[#aa2d00] text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
                    >
                      {t.timetable.discard}
                    </button>
                  </div>
                )}

                {/* 3. Export Utility (Standalone Outline Button) */}
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handlePrint()}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl transition-all border border-[#dddddd] bg-white text-[#181d26] hover:bg-slate-50 active:scale-[0.98]"
                  >
                    <FileDown size={16} />
                    {t.timetable.exportPdf}
                  </button>
                  <button 
                    onClick={handlePublishToStudents}
                    disabled={isPublishing || slots.length === 0}
                    className="flex items-center gap-2 px-6 py-3 text-sm font-medium rounded-xl transition-all border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send size={16} />
                    {isPublishing ? t.exams.publishing : t.exams.publishToStudents}
                  </button>
                </div>
              </>
            ) : (
              /* EDITING MODE ACTIVE - SHOW ONLY DONE EDITING */
              <button 
                onClick={() => setIsEditMode(false)}
                className="px-8 py-3 rounded-xl font-medium text-sm transition-all flex items-center gap-2 bg-[#181d26] text-white hover:bg-[#0d1218] active:scale-[0.98]"
              >
                <Check size={16} /> {t.timetable.doneEditing}
              </button>
            )}
          </div>
        </div>

        {/* PRO VIEW BAR (Airtable-style filter bar) */}
        <div className="flex items-center overflow-x-auto bg-[#f8fafc] border border-[#dddddd] rounded-lg px-2 py-1.5 gap-2 w-full">
          {/* Target Class */}
          <div className="flex items-center gap-2 px-2 border-r border-[#dddddd] pr-4 shrink-0">
            <span className="text-xs font-semibold text-[#41454d] uppercase tracking-wider">{t.timetable.class}</span>
            <div className="relative inline-flex items-center">
              <select 
                className="bg-transparent border-0 text-sm font-medium text-[#181d26] focus:outline-none transition-all cursor-pointer pr-5 appearance-none"
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
                  <option key={cls.id} value={cls.id} className="bg-white text-slate-700">
                    {t.timetable.grade} {cls.level.level} - {cls.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Exam Period Segmented Control */}
          <div className="flex items-center gap-2 px-2 border-r border-[#dddddd] pr-4 shrink-0">
             <span className="text-xs font-semibold text-[#41454d] uppercase tracking-wider">{t.exams.period}</span>
             <div className="flex bg-[#e2e8f0] p-0.5 rounded-md gap-0.5">
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-4 py-1 rounded-[4px] text-xs font-medium transition-all ${
                      selectedPeriod === p 
                      ? 'bg-white text-[#181d26] shadow-sm' 
                      : 'text-[#41454d] hover:text-[#181d26] hover:bg-slate-200'
                    }`}
                  >
                    {t.exams.week} {p}
                  </button>
                ))}
             </div>
          </div>

          {/* Date Range */}
          <div className="flex items-center gap-3 px-2 shrink-0">
            <div className="flex items-center gap-2 relative group">
              <CalendarIcon size={14} className="text-[#9297a0] group-hover:text-indigo-600 transition-colors pointer-events-none absolute left-2 z-10" />
              <div className="absolute left-7 text-[11px] font-bold text-[#9297a0] uppercase tracking-wider pointer-events-none z-10">{t.exams.start}</div>
              <input 
                type="date" 
                value={localStartDate}
                min={toLocalISO(new Date())}
                max={localEndDate}
                onChange={(e) => setLocalStartDate(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
                disabled={!isEditMode}
                className={`pl-[68px] pr-2 py-1.5 bg-transparent hover:bg-slate-200/60 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded-md text-sm font-medium text-[#181d26] transition-all outline-none w-[165px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:cursor-text'}`}
              />
            </div>
            
            <span className="text-[#9297a0] text-xs font-medium">→</span>
            
            <div className="flex items-center gap-2 relative group">
              <div className="absolute left-3 text-[11px] font-bold text-[#9297a0] uppercase tracking-wider pointer-events-none z-10">{t.exams.end}</div>
              <input 
                type="date" 
                value={localEndDate}
                min={localStartDate || toLocalISO(new Date())}
                onChange={(e) => setLocalEndDate(e.target.value)}
                onClick={(e) => { try { e.currentTarget.showPicker(); } catch(err) {} }}
                disabled={!isEditMode}
                className={`pl-[42px] pr-2 py-1.5 bg-transparent hover:bg-slate-200/60 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 rounded-md text-sm font-medium text-[#181d26] transition-all outline-none w-[138px] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-2 [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer ${!isEditMode ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer focus:cursor-text'}`}
              />
            </div>

            {hasUnsavedDates && isEditMode && (
              <button
                onClick={handleSaveDates}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium hover:bg-indigo-700 transition-all flex items-center gap-1 shadow-sm active:scale-95"
              >
                <Check size={14} /> {t.exams.saveDates}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* PERIOD SELECTOR REMOVED - merged into top bar */}
      {/* TIMETABLE GRID */}
      {selectedClass && (
        <div className={(isPending || loading) ? "opacity-50 transition-opacity" : ""}>
          {loading ? (
             <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-slate-100 animate-pulse">
                <div className="w-16 h-16 border-[6px] border-slate-50 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                   {t.exams.syncing}
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
          title="Planificateur IA d'Examens"
          classContext={{
            id: selectedClass.id,
            name: selectedClass.name,
            level: selectedClass.level.level
          }}
          subjects={subjects}
          teachers={teachers}
          startDate={localStartDate}
          endDate={localEndDate}
          onSaveDates={async (sDate, eDate) => {
            setLocalStartDate(sDate);
            setLocalEndDate(eDate);
            const [yS, mS, dS] = sDate.split('-').map(Number);
            const start = new Date(yS, mS - 1, dS);
            let end: Date | undefined = undefined;
            if (eDate) {
              const [yE, mE, dE] = eDate.split('-').map(Number);
              end = new Date(yE, mE - 1, dE);
            }
            await upsertExamPeriodConfig(selectedPeriod, start, end, selectedClass.id);
          }}
          generateAction={(p, c, s, t) => generateExamsFromPrompt(p, c, s, t, selectedPeriod)}
          saveAction={(slots) => bulkUpdateExams(selectedClass.id, selectedPeriod, slots, isDraftView)}
        />
      )}
    </div>
  );
};

export default ExamTimetableClient;
