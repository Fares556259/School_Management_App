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
  upsertExamPeriodConfig
} from "../../admin/actions/examActions";
import { generateExamsFromPrompt } from "../../admin/actions/examAiActions";
import ExamTimetablePrint from "../../admin/timetable/components/ExamTimetablePrint";
import { defaultSessions } from "../../admin/timetable/components/ScheduleGrid";
import { getSchoolConfig } from "../../admin/actions/schoolActions";

const ExamTimetableClient = ({ 
  classes, 
  subjects, 
  teachers, 
  rooms,
  role 
}: { 
  classes: any[]; 
  subjects: any[]; 
  teachers: any[]; 
  rooms: any[];
  role: string;
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
    const res = await getExamsByClass(selectedClass.id, selectedPeriod);
    if (res.success && res.data) {
      setSlots(res.data as any[]);
    }
    setLoading(false);
  }, [selectedClass, selectedPeriod]);

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
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
             <ClipboardCheck size={24} className="stroke-[2.5px]" />
          </div>
          <div>
            <div className="mb-1">
              <span className={`text-[8px] px-2.5 py-1 rounded-full uppercase tracking-[0.2em] font-black border whitespace-nowrap inline-flex items-center justify-center ${isEditMode ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                {isEditMode ? 'Edit Mode' : 'View Mode'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight uppercase leading-none">
              Academic Exams
            </h1>
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2 opacity-60">Manage and monitor examination calendars.</p>
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

          {(role === "admin" || role === "teacher") && (
            <>
              {/* AI GENERATE BUTTON */}
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
            </>
          )}

          {/* CLASS FILTER */}
          <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-3">Class</label>
            <select 
              className="bg-white border border-slate-100 rounded-lg px-4 py-2 text-xs font-black text-slate-700 shadow-sm focus:outline-none focus:border-indigo-500 transition-all cursor-pointer hover:bg-white uppercase tracking-wider"
              value={selectedClass?.id}
              onChange={(e) => {
                const params = new URLSearchParams(searchParams);
                params.set("classId", e.target.value);
                startTransition(() => {
                    router.push(`/list/exams?${params.toString()}`);
                });
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
              onUpdateAction={updateExamSlot}
              onDeleteAction={deleteExam}
              onRefresh={fetchSlots}
              sessions={dynamicSessions}
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
          saveAction={(slots) => bulkUpdateExams(selectedClass.id, selectedPeriod, slots)}
        />
      )}
    </div>
  );
};

export default ExamTimetableClient;
