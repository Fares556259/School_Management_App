"use client";

import { useState, useEffect } from "react";
import { Day } from "@prisma/client";
import { Edit2, BookOpen, X, Check, Trash2, User, MapPin } from "lucide-react";

const dayLabels: { [key in Day]: string } = {
  [Day.MONDAY]: "Lundi",
  [Day.TUESDAY]: "Mardi",
  [Day.WEDNESDAY]: "Mercredi",
  [Day.THURSDAY]: "Jeudi",
  [Day.FRIDAY]: "Vendredi",
  [Day.SATURDAY]: "Samedi",
};

interface SlotProps {
  slot: any;
  classId: number;
  day: Day;
  period: number;
  startTime: string;
  endTime: string;
  subjects: any[];
  teachers: any[];
  rooms: any[];
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  isEditMode: boolean;
  type: "timetable" | "exam";
  usedSubjectIds: number[];
  examPeriod?: number;
  targetDate?: Date;
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
  rooms,
  onUpdateAction,
  onDeleteAction,
  onRefresh,
  isEditMode,
  type,
  usedSubjectIds,
  examPeriod,
  targetDate
}: SlotProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState("");

  // Sync state when slot prop changes
  useEffect(() => {
    if (type === "timetable") {
      setSubjectId(slot?.subjectId?.toString() || "");
      setTeacherId(slot?.teacherId || "");
    } else {
      setSubjectId(slot?.lesson?.subjectId?.toString() || "");
      setTeacherId(slot?.lesson?.teacherId || "");
    }
    setRoomId(slot?.roomId?.toString() || "");
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
          roomId: parseInt(roomId) || null,
          examPeriod: examPeriod,
          targetDate: targetDate?.toISOString(),
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
  
  const handleDelete = async () => {
    if (!onDeleteAction || !slot?.id) return;
    
    if (window.confirm("Are you sure you want to delete this session?")) {
      setLoading(true);
      try {
        const res = await onDeleteAction(slot.id);
        if (res.success) {
          setIsEditing(false);
          onRefresh();
        } else {
          console.error("Delete failed:", res.error);
        }
      } catch (err) {
        console.error("Delete error:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (!slot && !isEditMode) return null;

  const rawSubjectName = type === "timetable" ? slot?.subject?.name : slot?.lesson?.subject?.name;
  const subjectName = rawSubjectName ? rawSubjectName.split("|")[0].trim() : "";
  const teacherName = type === "timetable" 
    ? (slot?.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : "No Teacher Assigned")
    : (slot?.lesson?.teacher ? `${slot.lesson.teacher.name} ${slot.lesson.teacher.surname}` : "No Teacher Assigned");

  const handleDragStart = (e: React.DragEvent) => {
    if (slot?.id) {
       e.dataTransfer.setData("slotId", slot.id.toString());
       e.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <>
      {/* Background Cell Rendering */}
      {!slot ? (
        isEditMode && (
          <button 
              onClick={() => setIsEditing(true)}
              className="w-full h-full border-2 border-dashed border-slate-100 rounded-[24px] flex flex-col items-center justify-center text-slate-200 hover:border-indigo-100 hover:text-indigo-400 hover:bg-slate-50 transition-all group print:hidden"
          >
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
               <BookOpen size={16} className="opacity-40 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest mt-3">Add {type === 'exam' ? 'Exam' : 'Session'}</span>
          </button>
        )
      ) : (
        <div 
          draggable={isEditMode && !!slot}
          onDragStart={handleDragStart}
          className={`w-full h-full bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 hover:border-indigo-100 transition-all flex flex-col relative group ${isEditMode && !!slot ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
          <div className="flex items-start justify-between">
            <h3 className="text-sm font-black text-slate-800 leading-tight tracking-tight uppercase group-hover:text-indigo-600 transition-colors">
              {subjectName || "Unscheduled Subject"}
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
                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">{slot.room?.name || "Room TBA"}</span>
             </div>
             <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-5 h-5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center text-[8px] font-black tracking-tighter border border-emerald-100">TD</div>
                <div className="w-5 h-5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-[8px] font-black tracking-tighter border border-amber-100">C</div>
             </div>
          </div>
        </div>
      )}

      {/* Modern Fixed Popover Modal overlay */}
      {isEditing && (
        <div className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    {slot?.id ? "Modifier Session" : "Ajouter Session"}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                    {dayLabels[day] || String(day)} · {startTime} - {endTime}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="flex flex-col gap-4 py-6">
              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                <div className="relative">
                  <select 
                    className="text-xs h-11 pl-10 pr-4 border border-slate-200 rounded-2xl bg-slate-50/50 font-black text-slate-700 w-full focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all uppercase tracking-wider appearance-none cursor-pointer"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                  >
                    <option value="">Select Subject</option>
                    {subjects
                      .filter(s => type !== 'exam' || !usedSubjectIds.includes(s.id) || s.id.toString() === subjectId)
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name ? s.name.split("|")[0].trim() : ""}</option>
                      ))
                    }
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <BookOpen size={14} />
                  </div>
                </div>
              </div>

              {/* Teacher Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Teacher</label>
                <div className="relative">
                  <select 
                    className="text-xs h-11 pl-10 pr-4 border border-slate-200 rounded-2xl bg-slate-50/50 font-black text-slate-700 w-full focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all uppercase tracking-wider appearance-none cursor-pointer"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    <option value="">Select Teacher</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.surname}</option>
                    ))}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User size={14} />
                  </div>
                </div>
              </div>

              {/* Room Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Room</label>
                <div className="relative">
                  <select 
                    className="text-xs h-11 pl-10 pr-4 border border-slate-200 rounded-2xl bg-slate-50/50 font-black text-slate-700 w-full focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 transition-all uppercase tracking-wider appearance-none cursor-pointer"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  >
                    <option value="">Room (TBA)</option>
                    {rooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <MapPin size={14} />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-slate-100 shrink-0">
              {slot?.id && slot.id !== -1 && onDeleteAction && (
                <button 
                  disabled={loading}
                  onClick={handleDelete}
                  className="px-4 h-11 bg-rose-50 text-rose-600 hover:bg-rose-100 active:scale-95 transition-all border border-rose-200 rounded-2xl flex items-center justify-center shrink-0"
                  title="Supprimer la session"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 h-11 bg-slate-50 hover:bg-slate-100 active:scale-95 transition-all text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-200 text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                disabled={loading}
                onClick={handleUpdate}
                className="flex-[2] h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                ) : (
                  <>
                    <Check size={14} className="stroke-[3px]" />
                    Save Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScheduleSlot;
