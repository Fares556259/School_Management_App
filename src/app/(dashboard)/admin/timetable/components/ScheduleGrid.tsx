import React, { useEffect, useState, forwardRef } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import ScheduleSlot from "./ScheduleSlot";
import { Day } from "@prisma/client";
import { Plus } from "lucide-react";

const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];

interface ScheduleGridProps {
  slots?: any[];
  classId: number;
  subjects: any[];
  teachers: any[];
  rooms: any[];
  allActiveSlots?: any[];
  isEditMode: boolean;
  refreshKey: number;
  type: "timetable" | "exam";
  examPeriod?: number;
  startDate?: Date;
  endDate?: Date;
  dayStartTime?: string;
  dayEndTime?: string;
  fetchDataAction?: (id: number, isDraft?: boolean) => Promise<{ success: boolean; data?: any[] }>;
  onMoveAction: (id: number, day: Day, slotNumber: number, examPeriod?: number) => Promise<{ success: boolean; error?: string }>;
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  isDraft?: boolean;
}

const ScheduleGrid = forwardRef<HTMLDivElement, ScheduleGridProps>(({
  slots: propSlots,
  classId,
  subjects,
  teachers,
  rooms,
  allActiveSlots,
  isEditMode,
  refreshKey,
  type,
  examPeriod,
  startDate,
  endDate,
  dayStartTime = "08:00",
  dayEndTime = "18:00",
  fetchDataAction,
  onMoveAction,
  onUpdateAction,
  onDeleteAction,
  onRefresh,
  isDraft = false
}, ref) => {
  const [localSlots, setLocalSlots] = useState<any[]>(propSlots || []);
  const [isLoading, setIsLoading] = useState(!propSlots && !!fetchDataAction);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);
  const { t } = useLanguage();

  const displaySlots = localSlots.length > 0 ? localSlots : (propSlots || []);

  useEffect(() => {
    isInitialMount.current = true;
  }, [classId, isDraft]);

  useEffect(() => {
    if (fetchDataAction && classId) {
      if (propSlots && propSlots.length > 0 && isInitialMount.current) {
        isInitialMount.current = false;
        setIsLoading(false);
        return;
      }

      const loadData = async () => {
        if (isInitialMount.current) setIsLoading(true);
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

  // Helpers for time calculation
  const parseTime = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h + (m || 0) / 60;
  };
  
  const startHour = parseTime(dayStartTime);
  const endHour = parseTime(dayEndTime);
  const totalHours = Math.max(1, endHour - startHour);

  const calcLeft = (timeStr: string) => {
    if (!timeStr) return "0%";
    const t = parseTime(timeStr);
    const pct = ((t - startHour) / totalHours) * 100;
    return `${Math.max(0, Math.min(100, pct))}%`;
  };

  const calcWidth = (durationMins: number) => {
    if (!durationMins) return "0%";
    const hours = durationMins / 60;
    const pct = (hours / totalHours) * 100;
    return `${Math.min(100, pct)}%`;
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    if (!isEditMode) return;
    e.preventDefault();
    setDraggedOver(targetId);
  };

  const handleDrop = async (e: React.DragEvent, targetDay: Day, targetSlotNumber: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    setDraggedOver(null);
    const slotIdStr = e.dataTransfer.getData("slotId");
    if (!slotIdStr) return;

    const slotId = parseInt(slotIdStr, 10);
    const currentSlots = [...displaySlots];

    // Optimistic UI for visual snap
    const nextSlots = currentSlots.map((slot) => {
      const isMovedSlot = slot.id === slotId || slot.lessonId === slotId;
      if (isMovedSlot) {
        return {
          ...slot,
          day: targetDay,
          slotNumber: targetSlotNumber,
        };
      }
      return slot;
    });
    setLocalSlots(nextSlots);

    try {
      const res = await onMoveAction(slotId, targetDay, targetSlotNumber, examPeriod);
      if (!res.success) {
        setLocalSlots(currentSlots);
        alert(res.error || "Impossible de déplacer le créneau.");
      } else {
        onRefresh(); // Trigger refresh to get recalculated cascading times
      }
    } catch (err) {
      setLocalSlots(currentSlots);
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

  const getDisplayDays = () => {
    if (type === 'timetable') return days;
    if (!startDate) return days;
    const end = endDate || new Date(new Date(startDate).setDate(startDate.getDate() + 5));
    const diffTime = Math.abs(end.getTime() - startDate.getTime());
    const diffDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 14);
    
    const result: { day: Day; date: Date }[] = [];
    for (let i = 0; i < diffDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const nativeDay = d.getDay(); 
        if (nativeDay === 0) continue;
        const dayNames = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];
        const mappedDay = dayNames[nativeDay - 1] || Day.MONDAY;
        result.push({ day: mappedDay, date: d });
    }
    return result;
  };

  const displayDaysList = getDisplayDays();

  // Generate timeline markers (every hour)
  const timeMarkers: number[] = [];
  for (let i = Math.floor(startHour); i <= Math.ceil(endHour); i++) {
    timeMarkers.push(i);
  }

  return (
    <div className="w-full flex flex-col relative" ref={ref}>
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[12px]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.timetable.loading}</span>
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto rounded-[12px] border border-slate-200 bg-white shadow-sm">
        <div className="min-w-[800px]">
          {/* HEADER ROW */}
          <div className="flex h-12 border-b border-slate-200 bg-[#f8fafc]">
            <div className="w-28 flex-shrink-0 border-e border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-500 uppercase tracking-widest">
              Jour
            </div>
            <div className="flex-1 relative flex items-center">
              {timeMarkers.map(hour => {
                if (hour < startHour || hour > endHour) return null;
                const pct = ((hour - startHour) / totalHours) * 100;
                return (
                  <div 
                    key={hour} 
                    className="absolute top-0 bottom-0 border-l border-slate-200"
                    style={{ left: `${pct}%` }}
                  >
                    <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[11px] font-semibold text-slate-500 bg-[#f8fafc] px-2 z-10">
                      {hour.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DAY ROWS */}
          {displayDaysList.map((item) => {
            const d = typeof item === 'string' ? item : item.day;
            const dateObj = typeof item === 'string' ? undefined : item.date;
            
            // Filter slots for this day
            let daySlots = displaySlots.filter(s => {
              if (type === "timetable") return s.day === d;
              if (!s.startTime) return false;
              const sDate = new Date(s.startTime);
              return dateObj ? sDate.toLocaleDateString('en-CA') === dateObj.toLocaleDateString('en-CA') : true;
            }).sort((a, b) => (a.slotNumber || 0) - (b.slotNumber || 0));

            const maxSlotNum = daySlots.length > 0 ? Math.max(...daySlots.map(s => s.slotNumber)) : 0;
            const appendSlotNumber = maxSlotNum + 1;
            
            // Find the end time of the last slot to position the Add button
            const lastSlot = daySlots[daySlots.length - 1];
            const lastSlotEndTime = lastSlot ? lastSlot.endTime : dayStartTime;

            return (
              <div key={d} className="flex h-[110px] border-b border-slate-200 last:border-b-0 group">
                {/* DAY LABEL */}
                <div className="w-28 flex-shrink-0 border-e border-slate-200 flex flex-col items-center justify-center bg-slate-50/30 group-hover:bg-slate-50 transition-colors relative z-20">
                  <span className="font-bold text-[13px] text-slate-700 capitalize">{dayLabels[d]}</span>
                  {dateObj && (
                    <span className="text-[10px] font-medium text-slate-400 mt-1">
                      {dateObj.toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                {/* TIMELINE AREA */}
                <div className="flex-1 relative bg-white group-hover:bg-slate-50/20 transition-colors overflow-hidden">
                  {/* Background grid lines */}
                  {timeMarkers.map(hour => {
                    if (hour < startHour || hour > endHour) return null;
                    const pct = ((hour - startHour) / totalHours) * 100;
                    const halfPct = ((hour + 0.5 - startHour) / totalHours) * 100;
                    return (
                      <React.Fragment key={`line-group-${hour}`}>
                        <div 
                          className="absolute top-0 bottom-0 border-l border-slate-300 pointer-events-none z-0"
                          style={{ left: `${pct}%` }}
                        />
                        {hour < endHour && (
                          <div 
                            className="absolute top-0 bottom-0 border-l border-dashed border-slate-200 pointer-events-none z-0"
                            style={{ left: `${halfPct}%` }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Existing Slots */}
                  {daySlots.map(slot => (
                    <div 
                      key={slot.id}
                      className="absolute top-1 bottom-1 p-0.5 transition-all"
                      style={{ 
                        left: calcLeft(slot.startTime), 
                        width: calcWidth(slot.duration || 120),
                        zIndex: draggedOver === `slot-${slot.id}` ? 10 : 1
                      }}
                      onDragOver={(e) => handleDragOver(e, `slot-${slot.id}`)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, d, slot.slotNumber)}
                    >
                      <div className={`w-full h-full rounded-[8px] transition-all ${draggedOver === `slot-${slot.id}` ? 'ring-2 ring-indigo-500 scale-[1.02] opacity-70' : ''}`}>
                        <ScheduleSlot 
                          slot={slot} 
                          classId={classId}
                          day={d}
                          period={slot.slotNumber}
                          startTime={slot.startTime}
                          endTime={slot.endTime}
                          subjects={subjects}
                          teachers={teachers}
                          rooms={rooms}
                          allActiveSlots={allActiveSlots || []}
                          usedSubjectIds={daySlots.map(s => s.subjectId).filter(Boolean)}
                          onUpdateAction={(data) => onUpdateAction({ ...data, isDraft })}
                          onDeleteAction={onDeleteAction}
                          onRefresh={onRefresh}
                          isEditMode={isEditMode}
                          type={type}
                          examPeriod={examPeriod}
                          targetDate={dateObj}
                        />
                      </div>
                    </div>
                  ))}

                  {/* Add Slot Button / Dropzone at the end */}
                  {isEditMode && parseTime(lastSlotEndTime) < endHour && (
                    <div
                      className="absolute top-1 bottom-1 p-0.5 transition-all"
                      style={{ 
                        left: calcLeft(lastSlotEndTime), 
                        width: "80px",
                        zIndex: 1
                      }}
                      onDragOver={(e) => handleDragOver(e, `empty-${d}`)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, d, appendSlotNumber)}
                    >
                      <div className={`w-full h-full rounded-[8px] border-2 border-dashed transition-all flex items-center justify-center
                        ${draggedOver === `empty-${d}` ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-[#e2e8f0] bg-slate-50/50 text-slate-400 hover:bg-slate-100 hover:border-slate-300'}`}
                      >
                        <ScheduleSlot 
                          slot={undefined} 
                          classId={classId}
                          day={d}
                          period={appendSlotNumber}
                          startTime={lastSlotEndTime}
                          endTime=""
                          subjects={subjects}
                          teachers={teachers}
                          rooms={rooms}
                          allActiveSlots={allActiveSlots || []}
                          usedSubjectIds={daySlots.map(s => s.subjectId).filter(Boolean)}
                          onUpdateAction={(data) => onUpdateAction({ ...data, isDraft })}
                          onDeleteAction={onDeleteAction}
                          onRefresh={onRefresh}
                          isEditMode={isEditMode}
                          type={type}
                          examPeriod={examPeriod}
                          targetDate={dateObj}
                          compactMode={true}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

ScheduleGrid.displayName = "ScheduleGrid";
export default ScheduleGrid;
