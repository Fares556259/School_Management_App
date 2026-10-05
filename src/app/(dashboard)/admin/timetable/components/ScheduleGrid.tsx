import React, { useEffect, useState, forwardRef } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import ScheduleSlot from "./ScheduleSlot";
import { Day } from "@prisma/client";
import { Plus } from "lucide-react";
import { toast } from "react-toastify";

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
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string; data?: any }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  isDraft?: boolean;
  classNameStr?: string;
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
  isDraft = false,
  classNameStr = ""
}, ref) => {
  const [localSlots, setLocalSlots] = useState<any[]>(propSlots || []);
  const [isLoading, setIsLoading] = useState(!propSlots && !!fetchDataAction);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);
  const { t, locale } = useLanguage();
  const isRtl = locale === "ar";
  const hasPrefetchedSlots = Boolean(propSlots?.length);

  const displaySlots = localSlots.length > 0 ? localSlots : (propSlots || []);

  useEffect(() => {
    isInitialMount.current = true;
  }, [classId, isDraft]);

  useEffect(() => {
    if (fetchDataAction && classId) {
      if (hasPrefetchedSlots && isInitialMount.current) {
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
  }, [classId, fetchDataAction, refreshKey, isDraft, hasPrefetchedSlots]);

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

  const getSlotPosition = (timeStr: string, durationMins?: number) => {
    const offset = calcLeft(timeStr);
    const width = durationMins ? calcWidth(durationMins) : undefined;
    if (isRtl) {
      return {
        right: offset,
        ...(width ? { width } : {})
      };
    }
    return {
      left: offset,
      ...(width ? { width } : {})
    };
  };

  const handleOptimisticUpdate = async (data: any) => {
    const res = await onUpdateAction({ ...data, isDraft });
    if (res.success && res.data) {
      setLocalSlots(prev => {
        const exists = prev.find(p => p.id === res.data.id);
        if (exists) return prev.map(p => p.id === res.data.id ? res.data : p);
        return [...prev, res.data];
      });
    }
    return res;
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
        toast.error(res.error || t.toasts.timeSlotMoveFailed);
      } else {
        onRefresh(); // Trigger refresh to get recalculated cascading times
      }
    } catch (err) {
      setLocalSlots(currentSlots);
      toast.error(t.toasts.timeSlotMoveFailed);
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
    <div className="w-full flex flex-col relative gap-3" ref={ref}>
      {isLoading && (
        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-50 flex items-center justify-center rounded-[12px]">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{t.timetable.loading}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 print:hidden">
        <div>
          <p className="text-sm font-semibold text-slate-800">{classNameStr}</p>
          <p className="text-xs text-slate-500 mt-0.5">{displayDaysList.length} {t.timetable.daysScheduled}</p>
        </div>
        <div className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm">
          {dayStartTime} — {dayEndTime}
        </div>
      </div>

      <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)]">
        <div className="min-w-[800px]">
          {/* HEADER ROW */}
          <div className="flex h-14 border-b border-slate-200 bg-slate-50/95 sticky top-0 z-30 backdrop-blur-sm">
            <div className="w-28 flex-shrink-0 border-e border-slate-200 flex items-center justify-center font-bold text-[11px] text-slate-500 uppercase tracking-widest sticky start-0 z-40 bg-slate-50/95">
              {t.timetable.day || "Jour"}
            </div>
            <div className="flex-1 relative">
              {timeMarkers.map(hour => {
                if (hour < startHour || hour > endHour) return null;
                const pct = ((hour - startHour) / totalHours) * 100;
                return (
                  <div 
                    key={hour} 
                    className="absolute top-0 bottom-0"
                    style={isRtl ? { right: `${pct}%` } : { left: `${pct}%` }}
                  >
                    {/* Tick mark */}
                    <div className={`absolute bottom-0 w-[2px] h-3 bg-slate-300 rounded-t-[1px] ${isRtl ? "translate-x-1/2" : "-translate-x-1/2"}`} />
                    {/* Time Label */}
                    <span className={`absolute bottom-4 text-[13px] font-semibold text-slate-600 ${isRtl ? "translate-x-1/2" : "-translate-x-1/2"}`}>
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
            let rawDaySlots = displaySlots.filter(s => {
              if (type === "timetable") return s.day === d;
              if (!s.startTime) return false;
              const sDate = new Date(s.startTime);
              return dateObj ? sDate.toLocaleDateString('en-CA') === dateObj.toLocaleDateString('en-CA') : true;
            }).sort((a, b) => {
              const diff = parseTime(a.startTime || "00:00") - parseTime(b.startTime || "00:00");
              if (diff !== 0) return diff;
              return (a.slotNumber || 0) - (b.slotNumber || 0);
            });

            // Group by slotNumber
            const groupedSlots = new Map<number, any[]>();
            rawDaySlots.forEach(s => {
              if (!groupedSlots.has(s.slotNumber)) groupedSlots.set(s.slotNumber, []);
              groupedSlots.get(s.slotNumber)!.push(s);
            });
            const daySlots = Array.from(groupedSlots.values());

            const maxSlotNum = rawDaySlots.length > 0 ? Math.max(...rawDaySlots.map(s => s.slotNumber)) : 0;
            const appendSlotNumber = maxSlotNum + 1;

            // Compute empty hour slots for all free hours on this day
            const formatHour = (hourNum: number) => {
              const hh = Math.floor(hourNum);
              const mm = Math.round((hourNum - hh) * 60);
              return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
            };

            const emptyHourSlots: { hour: number; startTime: string; endTime: string }[] = [];
            const minH = Math.floor(startHour);
            const maxH = Math.ceil(endHour);

            for (let h = minH; h < maxH; h++) {
              const hStart = h;
              const hEnd = h + 1;
              const isOccupied = rawDaySlots.some(s => {
                if (!s.startTime) return false;
                const sStart = parseTime(s.startTime);
                const sEnd = s.endTime ? parseTime(s.endTime) : sStart + (s.duration || 120) / 60;
                return sStart < (hEnd - 0.01) && sEnd > (hStart + 0.01);
              });

              if (!isOccupied) {
                emptyHourSlots.push({
                  hour: h,
                  startTime: formatHour(h),
                  endTime: formatHour(h + 1),
                });
              }
            }

            return (
              <div key={d} className="flex h-[104px] border-b border-slate-200 last:border-b-0 group">
                {/* DAY LABEL */}
                <div className="w-28 flex-shrink-0 border-e border-slate-200 flex flex-col items-center justify-center bg-white group-hover:bg-blue-50/40 transition-colors sticky start-0 z-20">
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
                          className="absolute top-0 bottom-0 border-s border-slate-200 pointer-events-none z-0"
                          style={isRtl ? { right: `${pct}%` } : { left: `${pct}%` }}
                        />
                        {halfPct <= 100 && (
                          <div 
                            className="absolute top-0 bottom-0 border-s border-dashed border-slate-100 pointer-events-none z-0"
                            style={isRtl ? { right: `${halfPct}%` } : { left: `${halfPct}%` }}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Existing Slots */}
                  {daySlots.map(slotGroup => { const slot = slotGroup[0]; return (
                    <div 
                      key={slot.id}
                      className="absolute top-1 bottom-1 p-0.5 transition-all"
                      style={{ 
                        ...getSlotPosition(slot.startTime, slot.duration || 120),
                        zIndex: draggedOver === `slot-${slot.id}` ? 10 : 3
                      }}
                      onDragOver={(e) => handleDragOver(e, `slot-${slot.id}`)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, d, slot.slotNumber)}
                    >
                      <div className={`w-full h-full rounded-[8px] transition-all ${draggedOver === `slot-${slot.id}` ? 'ring-2 ring-indigo-500 scale-[1.02] opacity-70' : ''}`}>
                        <ScheduleSlot 
                          slot={slotGroup} 
                          classId={classId}
                          classNameStr={classNameStr}
                          day={d}
                          period={slot.slotNumber}
                          startTime={slot.startTime}
                          endTime={slot.endTime}
                          subjects={subjects}
                          teachers={teachers}
                          rooms={rooms}
                          allActiveSlots={allActiveSlots || []}
                          usedSubjectIds={rawDaySlots.map((s: any) => s.subjectId).filter(Boolean)}
                          onUpdateAction={handleOptimisticUpdate}
                          onDeleteAction={onDeleteAction}
                          onRefresh={onRefresh}
                          isEditMode={isEditMode}
                          type={type}
                          examPeriod={examPeriod}
                          targetDate={dateObj}
                        />
                      </div>
                    </div>
                  );})}

                  {/* Empty Slots (Add session buttons / dropzones across all free hours) */}
                  {isEditMode && emptyHourSlots.map((emptySlot) => (
                    <div 
                      key={`empty-${d}-${emptySlot.hour}`}
                      className="absolute top-1 bottom-1 p-0.5 transition-all group/empty"
                      style={{ 
                        ...getSlotPosition(emptySlot.startTime, 60),
                        zIndex: draggedOver === `empty-${d}-${emptySlot.hour}` ? 10 : 2
                      }}
                      onDragOver={(e) => handleDragOver(e, `empty-${d}-${emptySlot.hour}`)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, d, appendSlotNumber)}
                    >
                      <div className={`w-full h-full rounded-[8px] transition-all flex items-center justify-center
                        ${isEditMode 
                          ? 'border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/40 hover:bg-blue-50/30' 
                          : 'border border-dashed border-transparent hover:border-slate-300 hover:bg-slate-50/40'
                        }
                        ${draggedOver === `empty-${d}-${emptySlot.hour}` ? '!border-indigo-500 !bg-indigo-50/80 !scale-[1.02]' : ''}`}
                      >
                        <ScheduleSlot 
                          slot={undefined} 
                          classId={classId}
                          classNameStr={classNameStr}
                          day={d}
                          period={appendSlotNumber}
                          startTime={emptySlot.startTime}
                          endTime={emptySlot.endTime}
                          subjects={subjects}
                          teachers={teachers}
                          rooms={rooms}
                          allActiveSlots={allActiveSlots || []}
                          usedSubjectIds={rawDaySlots.map((s: any) => s.subjectId).filter(Boolean)}
                          onUpdateAction={handleOptimisticUpdate}
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
                  ))}
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
