"use client";

import { useState, useEffect } from "react";
import { Day } from "@prisma/client";
import { Edit2, BookOpen, X, Check } from "lucide-react";

interface SlotProps {
  slot: any;
  classId: number;
  day: Day;
  period: number;
  startTime: string;
  endTime: string;
  subjects: any[];
  teachers: any[];
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  isEditMode: boolean;
  type: "timetable" | "exam";
  usedSubjectIds: number[];
}

const ScheduleSlot = ({ 
  slot, 
  classId, 
  day, 
  period, 
  startTime, 
  endTime, 
  subjects, 
  teachers, 
  onUpdateAction,
  onRefresh,
  isEditMode,
  type,
  usedSubjectIds
}: SlotProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");

  // Sync state when slot prop changes
  useEffect(() => {
    if (type === "timetable") {
      setSubjectId(slot?.subjectId?.toString() || "");
      setTeacherId(slot?.teacherId || "");
    } else {
      setSubjectId(slot?.lesson?.subjectId?.toString() || "");
      setTeacherId(slot?.lesson?.teacherId || "");
    }
    setRoom(slot?.room || "");
  }, [slot, type]);

  const handleUpdate = async () => {
    setLoading(true);
    try {
        const res = await onUpdateAction({
          id: slot?.id ?? -1,
          subjectId: parseInt(subjectId) || null,
          teacherId: teacherId || null,
          classId: classId,
          day: day,
          slotNumber: period,
          startTime,
          endTime,
          room: room || null,
        });
        if (res.success) {
          setIsEditing(false);
          onRefresh();
        } else {
            console.error("Save failed:", res.error);
        }
    } catch (err) {
        console.error("Update error:", err);
    } finally {
        setLoading(false);
    }
  };

  if (!slot && !isEditMode) return null;

  if (!slot && isEditMode && !isEditing) return (
    <button 
        onClick={() => setIsEditing(true)}
        className="w-full h-full border-2 border-dashed border-slate-100 rounded-[24px] flex flex-col items-center justify-center text-slate-200 hover:border-indigo-100 hover:text-indigo-400 hover:bg-slate-50 transition-all group print:hidden"
    >
      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
         <BookOpen size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
      </div>
      <span className="text-[9px] font-black uppercase tracking-widest mt-3">Add {type === 'exam' ? 'Exam' : 'Session'}</span>
    </button>
  );

  if (isEditing) {
    return (
      <div className="w-full h-full bg-white p-4 rounded-[24px] border border-indigo-200 shadow-xl shadow-indigo-50/50 flex flex-col gap-3">
        <div className="flex flex-col gap-2">
           <select 
             className="text-[10px] h-9 px-3 border border-slate-110 rounded-xl bg-slate-50 font-black text-slate-700 w-full focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all uppercase tracking-widest"
             value={subjectId}
             onChange={(e) => setSubjectId(e.target.value)}
           >
             <option value="">Subject</option>
             {subjects
               .filter(s => type !== 'exam' || !usedSubjectIds.includes(s.id) || s.id.toString() === subjectId)
               .map(s => (
                 <option key={s.id} value={s.id}>{s.name}</option>
               ))
             }
           </select>
           <select 
             className="text-[10px] h-9 px-3 border border-slate-110 rounded-xl bg-slate-50 font-black text-slate-700 w-full focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all uppercase tracking-widest"
             value={teacherId}
             onChange={(e) => setTeacherId(e.target.value)}
           >
             <option value="">Teacher</option>
             {teachers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
           </select>
           <input 
             placeholder="Room (e.g. A1, Lab 5)"
             className="text-[10px] h-9 px-3 border border-slate-110 rounded-xl bg-slate-50 font-black text-slate-800 w-full focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all uppercase tracking-widest placeholder:text-slate-300"
             value={room}
             onChange={(e) => setRoom(e.target.value)}
           />
        </div>
        <div className="flex gap-2 mt-auto">
          <button 
            disabled={loading}
            onClick={handleUpdate}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center shadow-lg shadow-indigo-100"
          >
            {loading ? <div className="w-3 h-3 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <Check size={14} className="stroke-[3px]"/>}
          </button>
          <button 
            onClick={() => setIsEditing(false)}
            className="px-3 bg-slate-100 text-slate-600 py-2 rounded-xl hover:bg-slate-200 transition-all"
          >
            <X size={14} className="stroke-[3px]"/>
          </button>
        </div>
      </div>
    );
  }

  const handleDragStart = (e: React.DragEvent) => {
    if (slot?.id) {
       e.dataTransfer.setData("slotId", slot.id.toString());
       e.dataTransfer.effectAllowed = "move";
    }
  };

  const subjectName = type === "timetable" ? slot.subject?.name : slot.lesson?.subject?.name;
  const teacherName = type === "timetable" 
    ? (slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : "No Teacher Assigned")
    : (slot.lesson?.teacher ? `${slot.lesson.teacher.name} ${slot.lesson.teacher.surname}` : "No Teacher Assigned");

  return (
    <div 
      draggable={isEditMode && !!slot}
      onDragStart={handleDragStart}
      className={`w-full h-full bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 hover:border-indigo-100 transition-all flex flex-col relative group ${isEditMode && !!slot ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-start justify-between">
        <h3 className="text-sm font-black text-slate-800 leading-tight tracking-tight uppercase group-hover:text-indigo-600 transition-colors">
          {subjectName}
        </h3>
        {isEditMode && (
          <button 
            onClick={() => setIsEditing(true)}
            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-slate-50 rounded-lg transition-all text-slate-400 hover:text-indigo-600 print:hidden"
          >
            <Edit2 size={12} />
          </button>
        )}
      </div>
      
      <div className="mt-2 flex flex-col gap-1">
        <p className="text-[10px] italic font-medium text-slate-500 tracking-tight">
          {teacherName}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between pt-3">
         <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-100 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
            <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{slot.room || "Room TBA"}</span>
         </div>
         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-[8px] font-black tracking-tighter border border-emerald-100">TD</div>
            <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[8px] font-black tracking-tighter border border-amber-100">C</div>
         </div>
      </div>
    </div>
  );
};

export default ScheduleSlot;
