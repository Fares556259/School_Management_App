"use client";

import { useEffect, useState } from "react";
import { getTimetableByClass, moveTimetableSlot } from "../../actions/timetableActions";
import TimetableSlotItem from "./TimetableSlot";
import { Day } from "@prisma/client";

const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY, Day.SATURDAY];

const sessions = [
  { id: 1, label: "Session 1", time: "08:00 - 10:00" },
  { id: 2, label: "Session 2", time: "10:00 - 12:00" },
  { id: 3, label: "Session 3", time: "12:00 - 14:00" },
];

const TimetableGrid = ({
  classId,
  className,
  subjects,
  teachers,
  isEditMode,
  refreshKey,
}: {
  classId: number;
  className: string;
  subjects: any[];
  teachers: any[];
  isEditMode: boolean;
  refreshKey: number;
}) => {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedOver, setDraggedOver] = useState<string | null>(null);

  const fetchSlots = async () => {
    setLoading(true);
    const res = await getTimetableByClass(classId);
    if (res.success && res.data) {
      setSlots(res.data as any[]);
    }
    setLoading(false);
  };

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
    const res = await moveTimetableSlot(slotId, targetDay, targetPeriod);
    if (res.success) {
      fetchSlots();
    }
  };

  useEffect(() => {
    fetchSlots();
  }, [classId, refreshKey]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-[40px] border border-slate-100 animate-pulse">
        <div className="w-16 h-16 border-[6px] border-slate-50 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Synchronizing Academic Schedule...</p>
      </div>
    );
  }

  const dayLabels: { [key in Day]: string } = {
    [Day.MONDAY]: "Lundi",
    [Day.TUESDAY]: "Mardi",
    [Day.WEDNESDAY]: "Mercredi",
    [Day.THURSDAY]: "Jeudi",
    [Day.FRIDAY]: "Vendredi",
    [Day.SATURDAY]: "Samedi",
  };

  return (
    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1200px] p-6 lg:p-10">
          <div className="grid grid-cols-[100px_repeat(6,1fr)] gap-4 mb-6">
            <div className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Heure</span>
            </div>
            {days.map((day) => (
              <div key={day} className="h-14 flex items-center justify-center bg-slate-50 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100/50">
                 <span className="text-sm font-black text-slate-700 tracking-tight leading-none uppercase whitespace-nowrap px-4 overflow-hidden text-ellipsis">
                   {dayLabels[day]}
                 </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-4">
            {sessions.map((session) => (
              <div key={session.id} className="grid grid-cols-[100px_repeat(6,1fr)] gap-4 items-stretch">
                <div className="flex flex-col items-center justify-center bg-white p-4 rounded-3xl border border-slate-50 relative overflow-hidden group">
                   <div className="absolute top-0 left-0 w-1 h-full bg-slate-100 group-hover:bg-indigo-300 transition-colors"></div>
                   <span className="text-xl font-black text-slate-800 leading-none">{session.id}</span>
                   <span className="text-[9px] font-bold text-slate-400 mt-2 whitespace-nowrap tracking-tighter">{session.time}</span>
                </div>

                {days.map((day) => {
                  const slot = slots.find(
                    (s) => s.day === day && s.slotNumber === session.id
                  );
                  const isDraggedOver = draggedOver === `${day}-${session.id}`;
                  return (
                    <div 
                      key={`${day}-${session.id}`} 
                      className={`min-h-[140px] flex items-stretch rounded-[30px] transition-all border-2 ${isDraggedOver ? 'border-indigo-400 bg-indigo-50/30 scale-[0.98]' : 'border-transparent'}`}
                      onDragOver={(e) => handleDragOver(e, day, session.id)}
                      onDragLeave={() => setDraggedOver(null)}
                      onDrop={(e) => handleDrop(e, day, session.id)}
                    >
                      <TimetableSlotItem 
                        slot={slot} 
                        classId={classId}
                        day={day}
                        period={session.id}
                        startTime={session.time.split(" - ")[0]}
                        endTime={session.time.split(" - ")[1]}
                        subjects={subjects}
                        teachers={teachers}
                        onUpdate={fetchSlots}
                        isEditMode={isEditMode}
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
};

export default TimetableGrid;
