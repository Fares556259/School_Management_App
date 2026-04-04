"use client";

import { useState } from "react";
import { updateTimetableSlot } from "../../actions/timetableActions";
import { Day } from "@prisma/client";
import { Edit2, MoreHorizontal, User, BookOpen, Clock, X, Check } from "lucide-react";

interface SlotProps {
  slot: any;
  classId: number;
  day: Day;
  period: number;
  subjects: any[];
  teachers: any[];
  onUpdate: () => void;
}

const TimetableSlotItem = ({ slot, classId, day, period, subjects, teachers, onUpdate }: SlotProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [subjectId, setSubjectId] = useState(slot?.subjectId || "");
  const [teacherId, setTeacherId] = useState(slot?.teacherId || "");
  const [startTime, setStartTime] = useState(slot?.startTime || "");
  const [endTime, setEndTime] = useState(slot?.endTime || "");

  const handleUpdate = async () => {
    setLoading(true);
    const res = await updateTimetableSlot({
      id: slot.id,
      subjectId: parseInt(subjectId) || null,
      teacherId: teacherId || null,
      startTime,
      endTime,
    });
    if (res.success) {
      setIsEditing(false);
      onUpdate();
    }
    setLoading(false);
  };

  const getSubjectColor = (name: string) => {
    if (!name) return "bg-slate-50 border-slate-200 text-slate-400";
    const colors: { [key: string]: string } = {
      Mathematics: "bg-blue-50 border-blue-200 text-blue-700",
      Science: "bg-emerald-50 border-emerald-200 text-emerald-700",
      Arabic: "bg-amber-50 border-amber-200 text-amber-700",
      French: "bg-pink-50 border-pink-200 text-pink-700",
      English: "bg-indigo-50 border-indigo-200 text-indigo-700",
      History: "bg-orange-50 border-orange-200 text-orange-700",
      Geography: "bg-cyan-50 border-cyan-200 text-cyan-700",
      "Physical Education": "bg-red-50 border-red-200 text-red-700",
      "Music / Arts": "bg-purple-50 border-purple-200 text-purple-700",
      "Computer Science": "bg-slate-100 border-slate-300 text-slate-800",
    };
    return colors[name] || "bg-indigo-50 border-indigo-100 text-indigo-600";
  };

  if (!slot) return (
    <button 
        onClick={() => setIsEditing(true)}
        className="group h-24 w-full border-2 border-dashed border-slate-100 rounded-xl flex items-center justify-center text-slate-300 hover:border-indigo-200 hover:text-indigo-400 hover:bg-slate-50 transition-all"
    >
      {!isEditing ? (
        <div className="flex flex-col items-center gap-1">
            <BookOpen size={16} className="opacity-40 group-hover:scale-110 transition-transform"/>
            <span className="text-[10px] font-black uppercase tracking-widest">+ Add</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 w-full p-2">
            <select 
                className="text-[10px] p-1 border rounded bg-white font-bold text-slate-700 w-full"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
            >
                <option value="">Subject</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select 
                className="text-[10px] p-1 border rounded bg-white font-bold text-slate-700 w-full"
                value={teacherId}
                onChange={(e) => setTeacherId(e.target.value)}
            >
                <option value="">Teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
            </select>
            <div className="flex gap-1">
                <button 
                    disabled={loading}
                    onClick={async () => {
                        setLoading(true);
                        // For a NEW slot, we need a special action or handle it in update
                        const res = await updateTimetableSlot({
                            id: -1, // Flag for new slot creation
                            subjectId: parseInt(subjectId) || null,
                            teacherId: teacherId || null,
                            classId: classId,
                            day: day,
                            slotNumber: period,
                        } as any);
                        if (res.success) {
                            setIsEditing(false);
                            onUpdate();
                        }
                        setLoading(false);
                    }}
                    className="flex-1 bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700 transition-colors flex items-center justify-center"
                >
                    {loading ? <div className="w-2 h-2 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <Check size={12}/>}
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsEditing(false); }}
                    className="bg-slate-200 text-slate-600 p-1 rounded hover:bg-slate-300 transition-colors"
                >
                    <X size={12}/>
                </button>
            </div>
        </div>
      )}
    </button>
  );

  return (
    <div className={`group relative h-24 p-3 rounded-xl border-2 transition-all duration-300 ${isEditing ? 'border-indigo-400 ring-4 ring-indigo-50 shadow-lg' : getSubjectColor(slot.subject?.name)}`}>
      {!isEditing ? (
        <div className="h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                {slot.subject?.name || "No Subject"}
              </span>
              <button 
                onClick={() => setIsEditing(true)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/50 rounded-lg transition-all"
              >
                <Edit2 size={12} />
              </button>
            </div>
            <h3 className="text-sm font-black leading-tight mt-1 truncate">
              {slot.subject?.name || "Free Period"}
            </h3>
          </div>
          
          <div className="flex items-center gap-1 opacity-80 overflow-hidden">
            <User size={10} className="shrink-0" />
            <span className="text-[10px] font-bold truncate">
              {slot.teacher ? `${slot.teacher.name} ${slot.teacher.surname}` : "No Teacher"}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 h-full justify-center">
            <div className="grid grid-cols-2 gap-2">
                <select 
                    className="text-[10px] p-1 border rounded bg-white font-bold"
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                >
                    <option value="">Subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select 
                    className="text-[10px] p-1 border rounded bg-white font-bold"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                >
                    <option value="">Teacher</option>
                    {teachers.map(t => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
                </select>
            </div>
            <div className="flex gap-1">
                <button 
                    disabled={loading}
                    onClick={handleUpdate}
                    className="flex-1 bg-indigo-600 text-white p-1 rounded hover:bg-indigo-700 transition-colors flex items-center justify-center"
                >
                    {loading ? <div className="w-2 h-2 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : <Check size={12}/>}
                </button>
                <button 
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-200 text-slate-600 p-1 rounded hover:bg-slate-300 transition-colors"
                >
                    <X size={12}/>
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default TimetableSlotItem;
