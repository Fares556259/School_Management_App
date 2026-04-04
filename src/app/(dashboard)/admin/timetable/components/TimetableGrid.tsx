"use client";

import { useEffect, useState } from "react";
import { getTimetableByClass } from "../../actions/timetableActions";
import TimetableSlotItem from "./TimetableSlot";
import { Day } from "@prisma/client";

const days = [Day.MONDAY, Day.TUESDAY, Day.WEDNESDAY, Day.THURSDAY, Day.FRIDAY];
const periods = [1, 2, 3, 4, 5, 6];

const TimetableGrid = ({
  classId,
  className,
  subjects,
  teachers
}: {
  classId: number;
  className: string;
  subjects: any[];
  teachers: any[];
}) => {
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSlots = async () => {
    setLoading(true);
    console.log(`[Timetable] Fetching slots for classId: ${classId}`);
    const res = await getTimetableByClass(classId);
    if (res.success && res.data) {
      console.log(`[Timetable] Found ${res.data.length} slots`);
      setSlots(res.data as any[]);
    } else {
      console.error(`[Timetable] Fetch failed:`, res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSlots();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 bg-white rounded-2xl border border-slate-100 animate-pulse">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4 shadow-sm"></div>
        <p className="text-slate-400 font-bold tracking-tight">Syncing Schedule...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="p-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-r border-slate-100 w-32">
                Period
              </th>
              {days.map((day) => (
                <th key={day} className="p-4 text-center text-xs font-black text-slate-600 uppercase tracking-widest min-w-[200px]">
                  {day}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((periodNum) => (
              <tr key={periodNum} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                <td className="p-4 border-r border-slate-50 bg-slate-50/30">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-slate-700">P{periodNum}</span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                      {slots.find(s => s.slotNumber === periodNum)?.startTime || "--:--"}
                    </span>
                  </div>
                </td>
                {days.map((day) => {
                  const slot = slots.find(
                    (s) => s.day === day && s.slotNumber === periodNum
                  );
                  return (
                    <td key={day} className="p-2 align-top">
                      <TimetableSlotItem 
                        slot={slot} 
                        classId={classId}
                        day={day}
                        period={periodNum}
                        subjects={subjects}
                        teachers={teachers}
                        onUpdate={fetchSlots}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TimetableGrid;
