import React, { useEffect, useState, forwardRef } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
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
  rooms: any[];
  isEditMode: boolean;
  refreshKey: number;
  type: "timetable" | "exam";
  examPeriod?: number;
  startDate?: Date;
  endDate?: Date;
  fetchDataAction?: (id: number, isDraft?: boolean) => Promise<{ success: boolean; data?: any[] }>;
  onMoveAction: (id: number, day: Day, slotNumber: number, examPeriod?: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  sessions?: { id: number; label: string; time: string }[];
  isDraft?: boolean;
}

const ScheduleGrid = forwardRef<HTMLDivElement, ScheduleGridProps>(({
  slots: propSlots,
  classId,
  subjects,
  teachers,
  rooms,
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
  sessions: propSessions,
  isDraft = false
}, ref) => {
  const [localSlots, setLocalSlots] = useState<any[]>(propSlots || []);
  const [isLoading, setIsLoading] = useState(!propSlots && !!fetchDataAction);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);
  const { t } = useLanguage();

  const displaySessions = propSessions || defaultSessions;
  const displaySlots = propSlots || localSlots;

  useEffect(() => {
    isInitialMount.current = true;
  }, [classId, isDraft]);

  useEffect(() => {
    if (fetchDataAction && classId) {
      const loadData = async () => {
        if (isInitialMount.current) {
          setIsLoading(true);
        }
        const res = await fetchDataAction(classId, isDraft);
        if (res.success && res.data) {
          setLocalSlots(res.data);
        }
        setIsLoading(false);
        isInitialMount.current = false;
      };
      loadData();
    }
  }, [classId, fetchDataAction, refreshKey, isDraft]);

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

    const slotId = parseInt(slotIdStr, 10);
    const currentSlots = propSlots || localSlots;
    const prevSlots = [...currentSlots];

    // 1. OPTIMISTIC UPDATE: Update UI instantly with zero lag
    const nextSlots = currentSlots.map((slot) => {
      const isMovedSlot = slot.id === slotId || slot.lessonId === slotId;
      if (isMovedSlot) {
        return {
          ...slot,
          day: targetDay,
          slotNumber: targetPeriod,
          lesson: slot.lesson ? { ...slot.lesson, day: targetDay } : slot.lesson,
        };
      }

      const isTargetSlot = (slot.day === targetDay || slot.lesson?.day === targetDay) && slot.slotNumber === targetPeriod;
      if (isTargetSlot) {
        const movedSlot = currentSlots.find((s) => s.id === slotId || s.lessonId === slotId);
        const sourceDay = movedSlot?.day || movedSlot?.lesson?.day || targetDay;
        const sourcePeriod = movedSlot?.slotNumber || 1;
        return {
          ...slot,
          day: sourceDay,
          slotNumber: sourcePeriod,
          lesson: slot.lesson ? { ...slot.lesson, day: sourceDay } : slot.lesson,
        };
      }

      return slot;
    });

    setLocalSlots(nextSlots);

    // 2. SILENT BACKGROUND SERVER UPDATE
    try {
      const res = await onMoveAction(slotId, targetDay, targetPeriod, examPeriod);
      if (res.success) {
        onRefresh();
      } else {
        setLocalSlots(prevSlots);
        alert(res.error || "Impossible de déplacer le créneau.");
      }
    } catch (err) {
      setLocalSlots(prevSlots);
      alert("Erreur lors du déplacement du créneau.");
    }
  };

  const dayLabels: { [key in Day]: string } = {
    [Day.MONDAY]: t.timetable.monday,
    [Day.TUESDAY]: t.timetable.tuesday,
    [Day.WEDNESDAY]: t.timetable.wednesday,
    [Day.THURSDAY]: t.timetable.thursday,
    [Day.FRIDAY]: t.timetable.friday,
    [Day.SATURDAY]: t.timetable.saturday,
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
        const nativeDay = d.getDay(); 
        
        // Skip Sunday (0)
        if (nativeDay === 0) continue;
        
        const dayNames = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];
        const mappedDay = dayNames[nativeDay - 1] || Day.MONDAY;
        
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
    <div ref={ref} className="bg-white overflow-hidden print:shadow-none print:border-none print:m-0 print:p-0">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] print:min-w-0 border border-[#dddddd] rounded-[8px] overflow-hidden bg-white shadow-sm">
          <div className={`grid border-b border-[#dddddd] bg-[#ffffff]`} style={{ gridTemplateColumns: `100px repeat(${displayDays.length}, minmax(0, 1fr))` }}>
            <div className="h-10 flex items-center justify-center border-r border-[#dddddd]">
               <span className="text-[12px] font-medium text-[#5a5a5a] capitalize tracking-wide">{t.timetable.time}</span>
            </div>
            {displayDays.map((item) => {
              const d = typeof item === 'string' ? item : item.day;
              const date = typeof item === 'string' ? null : item.date;
              let label = dayLabels[d as Day] || String(d);
              if (date) {
                label += ` ${date.getDate()}`;
              }
              return (
                <div key={label} className="h-10 flex items-center justify-center border-r border-[#dddddd] last:border-r-0">
                   <span className="text-[12px] font-medium text-[#181d26] capitalize tracking-wide whitespace-nowrap px-4 overflow-hidden text-ellipsis">
                     {label}
                   </span>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col relative">
            {isLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[40px]">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.timetable.loading}</span>
                </div>
              </div>
            )}
            {displaySessions.map((session, idx) => (
              <div key={session.id || idx} className={`grid items-stretch border-b border-[#dddddd] last:border-b-0 group/row`} style={{ gridTemplateColumns: `100px repeat(${displayDays.length}, minmax(0, 1fr))` }}>
                <div className="flex flex-col items-center justify-center bg-[#ffffff] p-4 relative border-r border-[#dddddd] group-hover/row:bg-[#f8fafc] transition-colors">
                   <span className="text-[13px] font-medium text-[#181d26] leading-none">{idx + 1}</span>
                   <span className="text-[11px] font-normal text-[#5a5a5a] mt-1.5 whitespace-nowrap">{session.time}</span>
                </div>

                {displayDays.map((item) => {
                  const d = typeof item === 'string' ? item : item.day;
                  const dateObj = typeof item === 'string' ? undefined : item.date;
                  const s = findSlot(d as Day, idx + 1, dateObj);
                  const isDraggedOver = draggedOver === `${d}-${idx + 1}`;
                  return (
                    <div 
                      key={`${d}-${idx + 1}`} 
                      className={`min-h-[140px] flex items-stretch transition-all border-r border-[#dddddd] last:border-r-0 ${isDraggedOver ? 'bg-[#f8fafc]' : 'bg-[#ffffff] p-2 hover:bg-[#f8fafc]'}`}
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
                        rooms={rooms}
                        usedSubjectIds={usedSubjectIds}
                        onUpdateAction={(data) => onUpdateAction({ ...data, isDraft })}
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
