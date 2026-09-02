"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Day } from "@prisma/client";
import { Edit2, BookOpen, X, Check, Trash2, User, MapPin, Clock, Plus } from "lucide-react";

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
  classNameStr?: string;
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
  compactMode = false,
  classNameStr = ""
}: SlotProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const slotsArray = Array.isArray(slot) ? slot : (slot ? [slot] : []);
  const firstSlot = slotsArray[0];
  const [sessions, setSessions] = useState<any[]>([]);
  const [duration, setDuration] = useState<number>(firstSlot?.duration || 120);

  const addSession = () => setSessions([...sessions, { id: -1, subjectId: "", teacherId: "", roomId: "" }]);
  const removeSession = (index: number) => setSessions(sessions.filter((_, i) => i !== index));
  const updateSession = (index: number, field: string, value: any) => {
    const newSessions = [...sessions];
    newSessions[index] = { ...newSessions[index], [field]: value };
    setSessions(newSessions);
  };

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
    if (slotsArray.length > 0) {
      setSessions(slotsArray.map(s => {
        const sid = type === "timetable" 
          ? (s.subjectId === null ? "FREE" : (s.subjectId?.toString() || "")) 
          : (s.lesson?.subjectId?.toString() || "");
        const tid = type === "timetable" ? (s.teacherId || "") : (s.lesson?.teacherId || "");
        return {
          id: s.id,
          subjectId: sid,
          teacherId: tid,
          roomId: s.roomId?.toString() || ""
        };
      }));
      setDuration(slotsArray[0].duration || 120);
    } else {
      setSessions([{ id: -1, subjectId: "", teacherId: "", roomId: "" }]);
      setDuration(120);
    }
  }, [slot, type]);


  const handleUpdate = async () => {
    setLoading(true);
    try {
      let allSuccess = true;
      
      // Find deleted sessions
      if (slotsArray && slotsArray.length > 0) {
        const currentSessionIds = sessions.map(s => s.id).filter(id => id && id !== -1);
        const originalSessionIds = slotsArray.map((s: any) => s.id);
        
        for (const originalId of originalSessionIds) {
          if (!currentSessionIds.includes(originalId)) {
            if (onDeleteAction) {
              const delRes = await onDeleteAction(originalId);
              if (!delRes.success) allSuccess = false;
            }
          }
        }
      }

      let currentMaxGroupId = slotsArray && slotsArray.length > 0 ? Math.max(...slotsArray.map((s: any) => s.groupId || 1)) : 0;

      for (const sess of sessions) {
        const isFree = sess.subjectId === "FREE";
        const res = await onUpdateAction({
          id: sess.id ?? -1,
          groupId: sess.id === -1 ? (++currentMaxGroupId) : (sess.groupId || undefined),
          subjectId: isFree ? null : (parseInt(sess.subjectId) || null),
          teacherId: isFree ? null : (sess.teacherId || null),
          classId: classId,
          day: day,
          slotNumber: period,
          startTime,
          endTime: addMinutes(startTime, duration),
          duration,
          roomId: isFree ? null : (parseInt(sess.roomId) || null),
          examPeriod: examPeriod,
          targetDate: targetDate?.toISOString(),
        });
        if (!res.success) {
          console.error("Save failed:", res.error);
          alert("Save failed: " + (res.error || "Unknown error"));
          allSuccess = false;
        }
      }
      if (allSuccess) {
        setIsEditing(false);
        onRefresh();
      }
    } catch (err) {
        console.error("Update error:", err);
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDeleteAction) return;
    if (window.confirm("Voulez-vous vraiment supprimer ce créneau et tous ses groupes ?")) {
      setLoading(true);
      try {
        let allSuccess = true;
        for (const s of slotsArray) {
          if (!s.id) continue;
          const res = await onDeleteAction(s.id);
          if (!res.success) {
            console.error("Delete failed:", res.error);
            allSuccess = false;
          }
        }
        if (allSuccess) {
          setIsEditing(false);
          onRefresh();
        }
      } catch (err) {
        console.error("Delete error:", err);
      } finally {
        setLoading(false);
      }
    }
  };



  // Group Rooms based on active slots
  const occupiedRoomIds = allActiveSlots
    .filter((s: any) => s.day === day && s.slotNumber === period && s.classId !== classId && s.roomId)
    .map((s: any) => s.roomId);

  const availableRooms = rooms.filter((r) => !occupiedRoomIds.includes(r.id));
  const occupiedRooms = rooms.filter((r) => occupiedRoomIds.includes(r.id));

  if (!firstSlot && !isEditMode) return null;



  const handleDragStart = (e: React.DragEvent) => {
    if (firstSlot?.id) {
       e.dataTransfer.setData("slotId", firstSlot.id.toString());
       e.dataTransfer.effectAllowed = "move";
    }
  };

  return (
    <>
      {/* Background Cell Rendering */}
      {!firstSlot ? (
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
          draggable={isEditMode && !!firstSlot}
          onDragStart={handleDragStart}
          className={`w-full h-full rounded-[8px] transition-all relative group ${isEditMode && !!firstSlot ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''} overflow-hidden`}
        >
          {/* Edit button */}
          {isEditMode && (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-1 right-1 z-20 p-1 bg-white/90 hover:bg-white rounded-md shadow-sm border border-[#e5e7eb] transition-all text-[#181d26] print:hidden"
            >
              <Edit2 size={12} />
            </button>
          )}

          {slotsArray.length === 1 ? (
            /* Single group: original card */
            (() => {
              const s = slotsArray[0];
              const rawSubjectName = type === "timetable" ? s?.subject?.name : s?.lesson?.subject?.name;
              const subjectName = rawSubjectName ? rawSubjectName.split("|")[0].trim() : "";
              const teacherName = type === "timetable"
                ? (s?.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "No Teacher Assigned")
                : (s?.lesson?.teacher ? `${s.lesson.teacher.name} ${s.lesson.teacher.surname}` : "No Teacher Assigned");
              const colorSubject = type === "timetable" ? s.subjectId : s.lesson?.subjectId;
              return (
                <div className={`w-full h-full border border-slate-200/50 ${getSlotColor(colorSubject || 0)} p-1.5 px-2 rounded-[8px] flex flex-col justify-between overflow-hidden relative`}>
                  <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                  <h3 title={rawSubjectName} className={`text-[11px] font-bold leading-snug line-clamp-2 relative z-10 pr-6 ${!colorSubject ? 'text-slate-600' : 'text-[#181d26]'}`}>
                    {colorSubject ? (subjectName || "Unscheduled") : "☕ Libre"}
                  </h3>
                  {colorSubject && (
                    <p className="text-[9px] font-medium text-[#41454d] opacity-80 truncate relative z-10 mt-1">
                      {teacherName} • {s.room?.name || "TBA"}
                    </p>
                  )}
                </div>
              );
            })()
          ) : slotsArray.length === 2 ? (
            /* Two groups: side-by-side split */
            <div className="w-full h-full flex border border-slate-200/60 rounded-[8px] overflow-hidden relative">
              {slotsArray.map((s, idx) => {
                const rawSubjectName = type === "timetable" ? s?.subject?.name : s?.lesson?.subject?.name;
                const subjectName = rawSubjectName ? rawSubjectName.split("|")[0].trim() : "";
                const teacherName = type === "timetable"
                  ? (s?.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "")
                  : (s?.lesson?.teacher ? `${s.lesson.teacher.name} ${s.lesson.teacher.surname}` : "");
                const colorSubject = type === "timetable" ? s.subjectId : s.lesson?.subjectId;
                return (
                  <div key={s.id || idx} className={`flex-1 ${getSlotColor(colorSubject || 0)} flex flex-col justify-between p-1.5 overflow-hidden relative ${idx === 0 ? 'border-r-2 border-slate-200' : ''}`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
                    <span className="text-[8px] font-bold uppercase tracking-wide opacity-40 relative z-10">G{idx + 1}</span>
                    <h3 title={rawSubjectName} className={`text-[10px] font-bold leading-snug line-clamp-2 relative z-10 ${!colorSubject ? 'text-slate-500' : 'text-[#181d26]'}`}>
                      {colorSubject ? (subjectName || "—") : "☕ Libre"}
                    </h3>
                    {colorSubject && (
                      <p className="text-[8px] font-medium text-[#41454d] opacity-70 truncate relative z-10 mt-0.5">
                        {teacherName}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* 3+ groups: compact numbered list */
            <div className={`w-full h-full border border-slate-200/50 ${getSlotColor(slotsArray[0]?.subjectId || 0)} rounded-[8px] flex flex-col gap-0.5 p-1.5 overflow-hidden relative`}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent pointer-events-none" />
              {slotsArray.map((s, idx) => {
                const rawSubjectName = type === "timetable" ? s?.subject?.name : s?.lesson?.subject?.name;
                const subjectName = rawSubjectName ? rawSubjectName.split("|")[0].trim() : "";
                const colorSubject = type === "timetable" ? s.subjectId : s.lesson?.subjectId;
                return (
                  <div key={s.id || idx} className="flex items-center gap-1 relative z-10">
                    <span className="text-[7px] font-bold bg-white/60 rounded px-0.5 text-slate-500 flex-shrink-0">G{idx + 1}</span>
                    <span className={`text-[9px] font-semibold truncate ${!colorSubject ? 'text-slate-500' : 'text-[#181d26]'}`}>
                      {colorSubject ? (subjectName || "—") : "Libre"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modern Fixed Popover Modal overlay */}
      {isEditing && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[99999] bg-[#181d26]/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#dddddd] overflow-hidden flex flex-col p-6 animate-in fade-in zoom-in-95 duration-200">
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
            <div className="flex flex-col gap-4 py-4 max-h-[60vh] overflow-y-auto px-2">
              {sessions.map((sess, index) => {
                  
                // Recompute filtered lists for this session
                const classTeacherSubjectIds = new Set<number>();
                teachers.forEach(t => {
                  if (t.classes?.some((c: any) => c.id === classId)) {
                    t.subjects?.forEach((s: any) => classTeacherSubjectIds.add(s.id));
                  }
                });

                const availableSubjects = subjects.filter(s => type !== 'exam' || !usedSubjectIds.includes(s.id) || s.id.toString() === sess.subjectId);
                const classSubjects = availableSubjects.filter(s => classTeacherSubjectIds.has(s.id));
                const otherSubjects = availableSubjects.filter(s => !classTeacherSubjectIds.has(s.id));

                const filterBySubject = (tArr: any[]) => {
                  if (!sess.subjectId || sess.subjectId === "FREE") return tArr;
                  return tArr.filter(t => t.subjects?.some((s: any) => s.id === parseInt(sess.subjectId)));
                };
                
                const classTeachers = filterBySubject(teachers.filter(t => t.classes?.some((c: any) => c.id === classId)));
                const otherTeachers = filterBySubject(teachers.filter(t => !t.classes?.some((c: any) => c.id === classId)));

                return (
                <div key={index} className="flex flex-col gap-4 p-4 border border-slate-200 rounded-xl bg-slate-50 relative">
                  {sessions.length > 1 && (
                    <button 
                      onClick={() => removeSession(index)}
                      className="absolute top-2 right-2 p-1 text-slate-400 hover:text-rose-500 bg-white rounded-md border border-slate-200 shadow-sm"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Groupe {index + 1}</div>
              
              {/* Subject Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-[#181d26] ml-1">Matière</label>
                <div className="relative">
                  <select 
                    className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
                    value={sess.subjectId}
                    onChange={(e) => updateSession(index, "subjectId", e.target.value)}
                  >
                    <option value="">Sélectionner une matière</option>
                    <option value="FREE" className="font-semibold text-amber-700 bg-amber-50">☕ Pause / Temps Libre (راحة)</option>
                    {classSubjects.length > 0 && (
                      <optgroup label={classNameStr ? `Matières de la classe ${classNameStr}` : "Matières de la classe"}>
                        {classSubjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name ? s.name.split("|")[0].trim() : ""}</option>
                        ))}
                      </optgroup>
                    )}
                    {otherSubjects.length > 0 && (
                      <optgroup label={classSubjects.length > 0 ? "Autres Matières" : "Toutes les Matières"}>
                        {otherSubjects.map(s => (
                          <option key={s.id} value={s.id}>{s.name ? s.name.split("|")[0].trim() : ""}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                    <BookOpen size={16} />
                  </div>
                </div>
              </div>

              {/* Teacher Input */}
              {sess.subjectId !== "FREE" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#181d26] ml-1">Enseignant</label>
                  <div className="relative">
                    <select 
                      className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer disabled:opacity-50"
                      value={sess.teacherId}
                      onChange={(e) => updateSession(index, "teacherId", e.target.value)}
                      disabled={type === 'exam'}
                    >
                      <option value="">Sélectionner un enseignant</option>
                      {classTeachers.length > 0 && (
                        <optgroup label={classNameStr ? `Enseignants de la classe ${classNameStr}` : "Enseignants de la classe"}>
                          {classTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name} {t.surname}</option>
                          ))}
                        </optgroup>
                      )}
                      {otherTeachers.length > 0 && (
                        <optgroup label={classTeachers.length > 0 ? "Autres Enseignants" : "Tous les Enseignants"}>
                          {otherTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.name} {t.surname}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                      <User size={16} />
                    </div>
                  </div>
                </div>
              )}

              {/* Room Input */}
              {sess.subjectId !== "FREE" && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#181d26] ml-1">Salle</label>
                  <div className="relative">
                    <select 
                      className="text-sm h-11 pl-10 pr-4 border border-[#dddddd] rounded-md bg-white text-[#181d26] w-full focus:outline-none focus:border-[#458fff] transition-all appearance-none cursor-pointer"
                      value={sess.roomId}
                      onChange={(e) => updateSession(index, "roomId", e.target.value)}
                    >
                    <option value="">Sélectionner une salle</option>
                    {availableRooms.length > 0 && (
                      <optgroup label="Salles Disponibles">
                        {availableRooms.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {occupiedRooms.length > 0 && (
                      <optgroup label="Salles Occupées (Conflit possible)">
                        {occupiedRooms.map(r => (
                          <option key={r.id} value={r.id} className="text-red-500 bg-red-50 font-medium">⚠️ {r.name} (Déjà occupée)</option>
                        ))}
                      </optgroup>
                    )}
                    </select>
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none">
                      <MapPin size={16} />
                    </div>
                  </div>
                </div>
              )}
                </div>
              )})}

              <button 
                onClick={addSession}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-xl text-slate-500 font-medium hover:bg-slate-50 hover:border-indigo-400 hover:text-indigo-600 transition-colors flex items-center justify-center gap-2 text-sm mt-2"
              >
                <Plus size={16} />
                Ajouter un groupe (Sous-session)
              </button>

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
        </div>,
        document.body
      )}
    </>
  );
};

export default ScheduleSlot;
