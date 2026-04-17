import React, { useEffect, useState, forwardRef } from "react";
import ScheduleSlot from "./ScheduleSlot";
import { Day } from "@prisma/client";

const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];

export const defaultSessions = [
  { id: 1, label: "Session 1", time: "08:00 - 10:00" },
  { id: 2, label: "Session 2", time: "10:00 - 12:00" },
  { id: 3, label: "Session 3", time: "12:00 - 14:00" },
];

interface ScheduleGridProps {
  slots?: any[];
  classId: number;
  subjects: any[];
  teachers: any[];
  isEditMode: boolean;
  refreshKey: number;
  type: "timetable" | "exam";
  examPeriod?: number;
  startDate?: Date;
  endDate?: Date;
  fetchDataAction?: (id: number) => Promise<{ success: boolean; data?: any[] }>;
  onMoveAction: (id: number, day: Day, slotNumber: number, examPeriod?: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  sessions?: { id: number; label: string; time: string }[];
}

const ScheduleGrid = forwardRef<HTMLDivElement, ScheduleGridProps>(({
  slots: propSlots,
  classId,
  subjects,
  teachers,
  isEditMode,
  refreshKey,
  type,
  examPeriod,
  startDate,
  endDate,
  fetchDataAction,
  onMoveAction,
  onUpdateAction,
  onDeleteAction,
  onRefresh,
  sessions: propSessions
}, ref) => {
  const [localSlots, setLocalSlots] = useState<any[]>(propSlots || []);
  const [isLoading, setIsLoading] = useState(!propSlots && !!fetchDataAction);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  const displaySessions = propSessions || defaultSessions;
  const displaySlots = propSlots || localSlots;

  useEffect(() => {
    if (fetchDataAction && classId) {
      const loadData = async () => {
        setIsLoading(true);
        const res = await fetchDataAction(classId);
        if (res.success && res.data) {
          setLocalSlots(res.data);
        }
        setIsLoading(false);
      };
      loadData();
    }
  }, [classId, fetchDataAction, refreshKey]);

  useEffect(() => {
    if (propSlots) {
      setLocalSlots(propSlots);
    }
  }, [propSlots]);

  const handleDragOver = (e: React.DragEvent, day: Day, period: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    setDraggedOver(`${day}-${period}`);
  };

  const handleDrop = async (e: React.DragEvent, targetDay: Day, targetPeriod: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    setDraggedOver(null);
    const slotIdStr = e.dataTransfer.getData("slotId");
    if (!slotIdStr) return;

    const slotId = parseInt(slotIdStr);
    const res = await onMoveAction(slotId, targetDay, targetPeriod, examPeriod);
    if (res.success) {
      onRefresh();
    }
  };

  const dayLabels: { [key in Day]: string } = {
    [Day.MONDAY]: "Lundi",
    [Day.TUESDAY]: "Mardi",
    [Day.WEDNESDAY]: "Mercredi",
    [Day.THURSDAY]: "Jeudi",
    [Day.FRIDAY]: "Vendredi",
    [Day.SATURDAY]: "Samedi",
  };

  // Determine which days to show
  const getDisplayDays = () => {
    if (type === 'timetable') return days;
    
    // If no dates at all, just return standard days
    if (!startDate) return days;

    // If we have a start date but no end date, default to a 6-day range
    const end = endDate || new Date(new Date(startDate).setDate(startDate.getDate() + 5));
    
    const diffTime = Math.abs(end.getTime() - startDate.getTime());
    const diffDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 14); // max 14 days
    
    // Create a list of day enums based on the start date + range
    const result: { day: Day; date: Date }[] = [];
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        // Map native day (0-6, Sun-Sat) to our Day enum
        const dayNames = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];
        const nativeDay = d.getDay(); 
        const mappedDay = nativeDay === 0 ? Day.SATURDAY : dayNames[nativeDay - 1] || Day.MONDAY;
        
        result.push({ day: mappedDay, date: d });
    }
    return result;
  };

  const displayDays = getDisplayDays();

  // Helper to find slot in array based on type
  const findSlot = (day: Day, sessionId: number, targetDate?: Date) => {
    return displaySlots.find(s => {
      if (!s || !s.startTime) return false;
      
      if (type === "timetable") {
        return s.day === day && s.slotNumber === sessionId;
      } else {
        const sDate = new Date(s.startTime);
        if (isNaN(sDate.getTime())) return false; // Skip invalid dates
        
        // Exact date matching (YYYY-MM-DD)
        const isSameDate = targetDate 
          ? sDate.toLocaleDateString('en-CA') === targetDate.toLocaleDateString('en-CA')
          : true;

        if (!isSameDate) return false;

        // Session matching by hour range
        const hour = sDate.getHours();
        const session = displaySessions.find(sess => sess.id === sessionId);
        if (!session || !session.time) return false;

        const [hStart] = session.time.split(" - ")[0].split(":").map(Number);
        const [hEnd] = session.time.split(" - ")[1].split(":").map(Number);
        
        // Match if the exam start hour falls within the session window
        const isCorrectSession = hour >= hStart && hour < hEnd;

        if (targetDate) {
          return isCorrectSession;
        } else {
          const nativeDay = sDate.getDay();
          const dayIdx = nativeDay === 0 ? 5 : nativeDay - 1;
          const mappedDay = days[dayIdx];
          return mappedDay === day && isCorrectSession;
        }
      }
    });
  };

  const usedSubjectIds = type === "exam" 
    ? displaySlots.map(s => s.lesson?.subjectId).filter(Boolean)
    : [];

  return (
    <div ref={ref} className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] p-6 lg:p-10 print:min-w-0 print:p-4">
          <div className={`grid gap-4 mb-6`} style={{ gridTemplateColumns: `100px repeat(${displayDays.length}, 1fr)` }}>
            <div className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Heure</span>
            </div>
            {displayDays.map((item) => {
              const d = typeof item === 'string' ? item : item.day;
              const date = typeof item === 'string' ? null : item.date;
              let label = dayLabels[d as Day] || String(d);
              if (date) {
                label += ` ${date.getDate()}`;
              }
              return (
                <div key={label} className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
                   <span className="text-sm font-black text-slate-700 tracking-tight leading-none uppercase whitespace-nowrap px-4 overflow-hidden text-ellipsis">
                     {label}
                   </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-4 relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[40px]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Loading...</span>
                </div>
              </div>
            )}
            {displaySessions.map((session, idx) => (
              <div key={session.id || idx} className={`grid gap-4 items-stretch`} style={{ gridTemplateColumns: `100px repeat(${displayDays.length}, 1fr)` }}>
                <div className="flex flex-col items-center justify-center bg-white p-4 rounded-3xl border border-slate-50 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-300 transition-colors"></div>
                   <span className="text-xl font-black text-slate-800 leading-none">{idx + 1}</span>
                   <span className="text-[9px] font-bold text-slate-400 mt-2 whitespace-nowrap tracking-tighter">{session.time}</span>
                </div>

                {displayDays.map((item) => {
                  const d = typeof item === 'string' ? item : item.day;
                  const dateObj = typeof item === 'string' ? undefined : item.date;
                  const s = findSlot(d as Day, idx + 1, dateObj);
                  const isDraggedOver = draggedOver === `${d}-${idx + 1}`;
                  return (
                    <div 
                      key={`${d}-${idx + 1}`} 
                      className={`min-h-[140px] flex items-stretch rounded-[30px] transition-all border-2 ${isDraggedOver ? 'border-indigo-400 bg-indigo-50/30 scale-[0.98]' : 'border-transparent'}`}
                      onDragOver={(e) => handleDragOver(e, d as Day, idx + 1)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, d as Day, idx + 1)}
                    >
                      <ScheduleSlot 
                        slot={s} 
                        classId={classId}
                        day={d as Day}
                        period={idx + 1}
                        startTime={session.time.split(" - ")[0]}
                        endTime={session.time.split(" - ")[1]}
                        subjects={subjects}
                        teachers={teachers}
                        usedSubjectIds={usedSubjectIds}
                        onUpdateAction={onUpdateAction}
                        onDeleteAction={onDeleteAction}
                        onRefresh={onRefresh}
                        isEditMode={isEditMode}
                        type={type}
                        examPeriod={examPeriod}
                        targetDate={dateObj}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

ScheduleGrid.displayName = "ScheduleGrid";

export default ScheduleGrid;
