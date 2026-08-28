"use client";

import { useState, useEffect } from "react";
import { Day } from "@prisma/client";
import { Edit2, BookOpen, X, Check, Trash2, User, MapPin, Clock } from "lucide-react";

const dayLabels: { [key in Day]: string } = {
  [Day.MONDAY]: "Lundi",
  [Day.TUESDAY]: "Mardi",
  [Day.WEDNESDAY]: "Mercredi",
  [Day.THURSDAY]: "Jeudi",
  [Day.FRIDAY]: "Vendredi",
  [Day.SATURDAY]: "Samedi",
};

// Add minutes to "HH:MM", returns "HH:MM"
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

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
  allActiveSlots?: any[];
  onUpdateAction: (data: any) => Promise<{ success: boolean; error?: string }>;
  onDeleteAction?: (id: number) => Promise<{ success: boolean; error?: string }>;
  onRefresh: () => void;
  isEditMode: boolean;
  type: "timetable" | "exam";
  usedSubjectIds: number[];
  examPeriod?: number;
  targetDate?: Date;
  compactMode?: boolean;
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
  allActiveSlots = [],
  onUpdateAction,
  onDeleteAction,
  onRefresh,
  isEditMode,
  type,
  usedSubjectIds,
  examPeriod,
  targetDate,
  compactMode = false
}: SlotProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [duration, setDuration] = useState<number>(slot?.duration || 120);

  const pastelColors = [
    "bg-[#F0F4FF] border-[#D6E4FF]", // Blue
    "bg-[#F0FDF4] border-[#DCFCE7]", // Green
    "bg-[#FEF2F2] border-[#FEE2E2]", // Red
    "bg-[#FFFBEB] border-[#FEF3C7]", // Yellow
    "bg-[#FAF5FF] border-[#F3E8FF]", // Purple
    "bg-[#F0FDFB] border-[#CCFBF1]"  // Teal
  ];

  const getSlotColor = (subjectId: number) => {
    return pastelColors[subjectId % pastelColors.length];
  };

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
    setDuration(slot?.duration || 120);
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
          endTime: addMinutes(startTime, duration),
          duration,
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

  // 1. Filter Teachers
  const filteredTeachers = teachers.filter((t) => {
    // Check if teacher is assigned to this class
    const teachesClass = t.classes?.some((c: any) => c.id === classId);
    
    // If a subject is selected, also check if the teacher teaches that subject
    if (subjectId) {
      const teachesSubject = t.subjects?.some((s: any) => s.id === parseInt(subjectId));
      return teachesClass && teachesSubject;
    }
    
    // If no subject is selected, just return teachers for this class
    return teachesClass;
  });

  // 2. Filter Rooms
  const occupiedRoomIds = allActiveSlots
    .filter((s: any) => s.day === day && s.slotNumber === period && s.classId !== classId && s.roomId)
    .map((s: any) => s.roomId);

  const filteredRooms = rooms.filter((r) => !occupiedRoomIds.includes(r.id));

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
              className="w-full h-full border-none bg-transparent flex flex-col items-center justify-center text-[#9297a0] hover:text-[#181d26] transition-all group print:hidden"
          >
            <div className="w-8 h-8 rounded-full bg-[#ffffff] border border-[#dddddd] flex items-center justify-center transition-colors hover:shadow-sm">
               <BookOpen size={14} className="opacity-60 group-hover:opacity-100 transition-opacity" />
            </div>
            {!compactMode && <span className="text-[12px] font-medium mt-3 capitalize text-[#41454d]">Add {type === 'exam' ? 'Exam' : 'Session'}</span>}
          </button>
        )
      ) : (
        <div 
          draggable={isEditMode && !!slot}
          onDragStart={handleDragStart}
          className={`w-full h-full ${getSlotColor(parseInt(subjectId) || 0)} border p-3.5 rounded-[6px] transition-all flex flex-col relative group ${isEditMode && !!slot ? 'cursor-grab active:cursor-grabbing hover:shadow-sm' : ''} overflow-hidden`}
        >
          {/* Subtle gradient overlay for depth */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none"></div>
          
          <div className="flex items-start justify-between relative z-10 mb-2">
            <h3 className="text-[14px] font-medium text-[#181d26] leading-snug group-hover:text-[#1b61c9] transition-colors line-clamp-2">
              {subjectName || "Unscheduled Subject"}
            </h3>
            {isEditMode && (
              <button 
                onClick={() => setIsEditing(true)}
                className="p-1.5 opacity-0 group-hover:opacity-100 bg-white/80 hover:bg-white rounded-lg shadow-sm border border-[#e5e7eb] transition-all text-[#181d26] print:hidden"
              >
                <Edit2 size={14} />
              </button>
            )}
          </div>
          
          <div className="mt-1 flex flex-col gap-1">
            <p className="text-[12px] font-medium text-[#41454d] opacity-80">
              {teacherName}
            </p>
          </div>

          <div className="mt-auto flex items-center justify-between pt-3 relative z-10">
             <div className="flex items-center gap-2">
               <div className="bg-[#ffffff]/80 px-2 py-1 rounded-[4px] border border-[#dddddd]/50 flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#41454d]">{slot.room?.name || "Room TBA"}</span>
               </div>
               {slot?.startTime && (
                 <div className="bg-[#ffffff]/80 px-2 py-1 rounded-[4px] border border-[#dddddd]/50 flex items-center gap-1">
                    <Clock size={11} className="text-[#5a5a5a]" />
                    <span className="text-[11px] font-semibold text-[#181d26]">{slot.startTime} - {slot.endTime}</span>
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {/* Modern Fixed Popover Modal overlay */}
      {isEditing && (
        <div className="fixed inset-0 z-[150] bg-[#181d26]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg border border-[#dddddd] overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#dddddd]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-[#f8fafc] flex items-center justify-center text-[#181d26] border border-[#dddddd]">
                  <BookOpen size={18} />
                </div>
                <div>
                  <h3 className="text-[20px] font-medium text-[#181d26]">
                    {slot?.id ? "Modifier Session" : "Ajouter Session"}
                  </h3>
                  <p className="text-sm text-[#41454d] mt-1">
                    {dayLabels[day] || String(day)} · {startTime ? `${startTime} - ${endTime}` : `Créneau ${period}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsEditing(false)}
                className="p-2 hover:bg-[#f8fafc] rounded-full text-[#9297a0] hover:text-[#181d26] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="flex flex-col gap-5 py-6">
              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#181d26] ml-1">Subject</label>
                <div className="relative">
                  <select 
                    className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
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
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                    <BookOpen size={16} />
                  </div>
                </div>
              </div>

              {/* Teacher Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#181d26] ml-1">Teacher</label>
                <div className="relative">
                  <select 
                    className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
                    value={teacherId}
                    onChange={(e) => setTeacherId(e.target.value)}
                  >
                    <option value="">Select Teacher</option>
                    {filteredTeachers.map(t => (
                      <option key={t.id} value={t.id}>{t.name} {t.surname}</option>
                    ))}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                    <User size={16} />
                  </div>
                </div>
              </div>

              {/* Room Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#181d26] ml-1">Room</label>
                <div className="relative">
                  <select 
                    className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                  >
                    <option value="">Room (TBA)</option>
                    {filteredRooms.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                    <MapPin size={16} />
                  </div>
                </div>
              </div>

              {/* Duration Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#181d26] ml-1">Durée (Duration)</label>
                <div className="relative">
                  <select 
                    className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  >
                    <option value={60}>1 Heure</option>
                    <option value={90}>1 Heure 30</option>
                    <option value={120}>2 Heures</option>
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                    <Clock size={16} />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-[#dddddd] shrink-0">
              {slot?.id && slot.id !== -1 && onDeleteAction && (
                <button 
                  disabled={loading}
                  onClick={handleDelete}
                  className="px-4 h-11 bg-white text-[#aa2d00] hover:bg-rose-50 active:scale-95 transition-all border border-[#dddddd] rounded-md flex items-center justify-center shrink-0"
                  title="Supprimer la session"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button 
                onClick={() => setIsEditing(false)}
                className="flex-1 h-11 bg-white hover:bg-[#f8fafc] active:scale-95 transition-all text-[#181d26] rounded-md text-sm font-medium border border-[#dddddd] text-center flex items-center justify-center"
              >
                Cancel
              </button>
              <button 
                disabled={loading}
                onClick={handleUpdate}
                className="flex-[2] h-11 bg-[#181d26] hover:bg-[#0d1218] text-white rounded-md text-sm font-medium flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                ) : (
                  <>
                    <Check size={16} />
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
