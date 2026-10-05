"use client";

import { useState, useEffect, useMemo, useId } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Day } from "@prisma/client";
import { Edit2, X, Check, Trash2, User, MapPin, Clock, Plus, AlertTriangle, ShieldCheck } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { toast } from "react-toastify";
import { describeTimetableConflict, findTimetableConflicts, minutesToTime, timeToMinutes, timesOverlap, validateTimetableTime, TimetableConflict } from "@/lib/timetableConflicts";
import type { TimetableBlockInput } from "@/lib/timetableEditor";

type EditResult = { success: boolean; error?: string; code?: string; conflicts?: TimetableConflict[]; slots?: any[] };
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
  onUpdateAction: (data: any) => Promise<EditResult>;
  onSaveSessionAction?: (data: TimetableBlockInput) => Promise<EditResult>;
  onDeleteAction?: (id: number) => Promise<EditResult>;
  onRefresh: () => void;
  isEditMode: boolean;
  type: "timetable" | "exam";
  usedSubjectIds: number[];
  examPeriod?: number;
  targetDate?: Date;
  compactMode?: boolean;
  classNameStr?: string;
  dayStartTime?: string;
  dayEndTime?: string;
  availableMinutes?: number;
  isDraft?: boolean;
}

const colors = ["bg-blue-50 border-blue-200", "bg-emerald-50 border-emerald-200", "bg-rose-50 border-rose-200", "bg-amber-50 border-amber-200", "bg-violet-50 border-violet-200", "bg-cyan-50 border-cyan-200"];
const selectStyle = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500";

export default function ScheduleSlot({ slot, classId, day, period, startTime, endTime, subjects, teachers, rooms, allActiveSlots = [], onUpdateAction, onSaveSessionAction, onDeleteAction, onRefresh, isEditMode, type, usedSubjectIds, examPeriod, targetDate, compactMode = false, classNameStr = "", dayStartTime = "08:00", dayEndTime = "18:00", availableMinutes = 120, isDraft = false }: SlotProps) {
  const { t, locale } = useLanguage();
  const labels = t.timetable;
  const isRtl = locale === "ar";
  const fieldPrefix = useId();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);
  const slotsArray = useMemo(() => Array.isArray(slot) ? slot : slot ? [slot] : [], [slot]);
  const firstSlot = slotsArray[0];
  const [sessions, setSessions] = useState<any[]>([]);
  const [duration, setDuration] = useState(firstSlot?.duration || (availableMinutes < 120 ? 60 : 120));
  const [slotStartTime, setSlotStartTime] = useState(startTime || "08:00");
  const [serverFailure, setServerFailure] = useState<{ message: string; conflicts?: TimetableConflict[] } | null>(null);

  const formatSubjectName = (name?: string) => {
    if (!name) return "";
    const parts = name.split("|").map(p => p.trim());
    return locale === "ar" ? parts.find(p => /[\u0600-\u06FF]/.test(p)) || parts[0] : locale === "fr" ? parts[1] || parts[0] : parts[2] || parts[1] || parts[0];
  };
  const dayLabel = labels[day.toLowerCase() as "monday"] || String(day);
  const finishTime = minutesToTime(timeToMinutes(slotStartTime) + duration);
  const errorMessage = (res: EditResult) => labels.validation[(res.code || res.error) as keyof typeof labels.validation] || res.error || labels.validation.saveFailed;
  const resetForm = () => {
    setSessions(slotsArray.length ? slotsArray.map(s => ({ id: s.id, groupId: s.groupId, subjectId: type === "timetable" ? s.subjectId == null ? "FREE" : String(s.subjectId) : String(s.lesson?.subjectId || ""), teacherId: type === "timetable" ? s.teacherId || "" : s.lesson?.teacherId || "", roomId: s.roomId ? String(s.roomId) : "" })) : [{ id: -1, subjectId: "", teacherId: "", roomId: "" }]);
    setDuration(firstSlot?.duration || (availableMinutes < 120 ? 60 : 120));
    setSlotStartTime(firstSlot?.startTime || startTime || "08:00");
    setServerFailure(null);
  };
  useEffect(() => {
    setSessions(slotsArray.length ? slotsArray.map(s => ({ id: s.id, groupId: s.groupId, subjectId: type === "timetable" ? s.subjectId == null ? "FREE" : String(s.subjectId) : String(s.lesson?.subjectId || ""), teacherId: type === "timetable" ? s.teacherId || "" : s.lesson?.teacherId || "", roomId: s.roomId ? String(s.roomId) : "" })) : [{ id: -1, subjectId: "", teacherId: "", roomId: "" }]);
    setDuration(slotsArray[0]?.duration || (availableMinutes < 120 ? 60 : 120));
    setSlotStartTime(slotsArray[0]?.startTime || startTime || "08:00");
  }, [slotsArray, startTime, type, availableMinutes]);

  const setOpen = (open: boolean) => { if (loading) return; if (open) resetForm(); setIsEditing(open); };
  const updateSession = (index: number, field: string, value: string) => {
    setServerFailure(null);
    setSessions(prev => prev.map((s, i) => i === index ? { ...s, [field]: value, ...(field === "subjectId" && type === "timetable" ? { teacherId: "", roomId: value === "FREE" ? "" : s.roomId } : {}) } : s));
  };
  const originalIds = slotsArray.map(s => s.id);
  const others = allActiveSlots.filter(s => !originalIds.includes(s.id));
  const overlapping = others.filter(s => s.day === day && timesOverlap(slotStartTime, finishTime, s.startTime, s.endTime));
  const proposed = sessions.map(s => ({ classId, day, slotNumber: firstSlot?.slotNumber || period, startTime: slotStartTime, endTime: finishTime, teacherId: s.subjectId === "FREE" ? null : s.teacherId || null, roomId: s.subjectId === "FREE" ? null : Number(s.roomId) || null, class: { name: classNameStr }, teacher: teachers.find(teacher => teacher.id === s.teacherId), room: rooms.find(room => room.id === Number(s.roomId)) }));
  const conflicts = type === "timetable" ? findTimetableConflicts(proposed, others) : [];
  const cardConflicts = type === "timetable" ? findTimetableConflicts(slotsArray, others) : [];
  const validationCode = type === "timetable" ? validateTimetableTime(slotStartTime, duration, dayStartTime, dayEndTime) : null;
  const invalidSubject = sessions.some(s => !s.subjectId);
  const canSave = !loading && !invalidSubject && !validationCode && !conflicts.length;
  const classSubjectIds = new Set(teachers.filter(teacher => teacher.classes?.some((c: any) => c.id === classId)).flatMap(teacher => teacher.subjects?.map((s: any) => s.id) || []));
  const timeOptions = Array.from({ length: 96 }, (_, i) => minutesToTime(i * 15)).filter(time => type !== "timetable" || (timeToMinutes(time) >= timeToMinutes(dayStartTime) && timeToMinutes(time) + duration <= timeToMinutes(dayEndTime)));
  if (!timeOptions.includes(slotStartTime)) timeOptions.push(slotStartTime);
  timeOptions.sort();

  const handleUpdate = async () => {
    if (!canSave) return;
    setLoading(true);
    setServerFailure(null);
    try {
      if (onSaveSessionAction && type === "timetable") {
        const res = await onSaveSessionAction({ id: firstSlot?.id, classId, day, slotNumber: period, startTime: slotStartTime, duration, isDraft, sessions: sessions.map(s => ({ id: s.id > 0 ? s.id : undefined, subjectId: s.subjectId === "FREE" ? null : Number(s.subjectId), teacherId: s.teacherId || null, roomId: Number(s.roomId) || null })) });
        if (!res.success) { setServerFailure({ message: errorMessage(res), conflicts: res.conflicts }); return; }
      } else {
        // Keep the existing exam action contract; timetable blocks use one atomic save.
        for (const original of slotsArray) {
          if (!sessions.some(s => s.id === original.id) && onDeleteAction) {
            const res = await onDeleteAction(original.id);
            if (!res.success) throw new Error(res.error || labels.validation.saveFailed);
          }
        }
        for (const s of sessions) {
          const free = s.subjectId === "FREE";
          const res = await onUpdateAction({ id: s.id || -1, groupId: s.groupId, subjectId: free ? null : Number(s.subjectId), teacherId: free ? null : s.teacherId || null, roomId: free ? null : Number(s.roomId) || null, classId, day, slotNumber: period, startTime: slotStartTime, endTime: finishTime, duration, examPeriod, targetDate: targetDate?.toISOString() });
          if (!res.success) throw new Error(res.error || labels.validation.saveFailed);
        }
      }
      setIsEditing(false);
      onRefresh();
    } catch (error) { setServerFailure({ message: error instanceof Error ? error.message : labels.validation.saveFailed }); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!onDeleteAction || !firstSlot?.id || loading) return;
    setLoading(true);
    try {
      // The timetable action removes a complete block in a single transaction.
      for (const s of type === "timetable" && onSaveSessionAction ? [firstSlot] : slotsArray) {
        const res = await onDeleteAction(s.id);
        if (!res.success) throw new Error(errorMessage(res));
      }
      setConfirmDelete(false); setIsEditing(false); onRefresh(); toast.success(t.toasts.timeSlotDeleted);
    } catch (error) { toast.error(error instanceof Error ? error.message : t.toasts.timeSlotDeleteFailed); }
    finally { setLoading(false); }
  };

  return <>
    {!firstSlot ? (
      <button type="button" onClick={() => setOpen(true)} className="h-full w-full flex flex-col items-center justify-center gap-1.5 rounded-xl text-slate-400 hover:text-blue-700 hover:bg-blue-50 transition-colors print:hidden" aria-label={`${labels.addSession} (${startTime})`}>
        <Plus size={19} /><span className="text-[11px] font-medium">{compactMode ? startTime : labels.addSession}</span>
      </button>
    ) : (
      <div draggable={isEditMode && !loading} onDragStart={e => { if ((e.target as HTMLElement).closest("button")) { e.preventDefault(); return; } e.dataTransfer.setData("slotId", String(firstSlot.id)); e.dataTransfer.effectAllowed = "move"; }} className={`h-full w-full relative rounded-xl overflow-hidden border ${cardConflicts.length ? "border-rose-300 ring-1 ring-rose-200" : "border-slate-200"} ${isEditMode ? "cursor-grab active:cursor-grabbing" : ""}`}>
        <div className="absolute top-2 start-3 end-3 flex items-center justify-between gap-1 z-10">
          <span dir="ltr" className="text-[10px] whitespace-nowrap font-semibold tabular-nums text-slate-600">{startTime}–{endTime}</span>
          {isEditMode && <div className="flex gap-1 print:hidden">
            <button type="button" draggable={false} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setOpen(true); }} aria-label={t.crud.edit} title={t.crud.edit} className="p-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-blue-50"><Edit2 size={12} /></button>
            {onDeleteAction && <button type="button" draggable={false} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); setConfirmDelete(true); }} aria-label={t.crud.delete} title={t.crud.delete} disabled={loading} className="p-1 rounded-md bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={12} /></button>}
          </div>}
          {!isEditMode && cardConflicts.length > 0 && <span title={cardConflicts.map(c => describeTimetableConflict(c, labels)).join("\n")} className="text-rose-600"><AlertTriangle size={15} /></span>}
        </div>
        <div className={`h-full flex flex-col pt-10 px-3 pb-2.5 ${colors[(firstSlot.subjectId || firstSlot.lesson?.subjectId || 0) % colors.length]}`}>
          {slotsArray.map((s, index) => {
            const subject = type === "timetable" ? s.subject : s.lesson?.subject;
            const teacher = type === "timetable" ? s.teacher : s.lesson?.teacher;
            return <div key={s.id || index} className={`min-w-0 flex-1 ${index > 0 ? "border-t border-slate-200/80 pt-1 mt-1" : ""}`}>
              <h3 title={formatSubjectName(subject?.name)} className="text-[13px] font-semibold leading-tight text-slate-900 line-clamp-2">
                {slotsArray.length > 1 && <span className="text-[10px] text-slate-500 me-1">G{index + 1}</span>}{subject ? formatSubjectName(subject.name) : labels.freeTime}
              </h3>
              {subject && <div className="mt-2 space-y-0.5 text-[11px] leading-tight text-slate-600">
                <p className="flex gap-1.5 items-center" title={teacher ? `${teacher.name} ${teacher.surname}` : labels.noTeacherAssigned}><User size={11} className="shrink-0" /><span className="truncate">{teacher ? `${teacher.name} ${teacher.surname}` : labels.noTeacherAssigned}</span></p>
                {s.room && <p className="flex gap-1.5 items-center" title={s.room.name}><MapPin size={11} className="shrink-0" /><span className="truncate">{s.room.name}</span></p>}
              </div>}
            </div>;
          })}
        </div>
      </div>
    )}

    <Dialog.Root open={isEditing} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[99998] bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content dir={isRtl ? "rtl" : "ltr"} onEscapeKeyDown={e => { if (loading) e.preventDefault(); }} onPointerDownOutside={e => e.preventDefault()} className="fixed z-[99999] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden focus:outline-none">
          <header className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-slate-200 shrink-0">
            <div><Dialog.Title className="text-xl font-semibold text-slate-900">{firstSlot ? labels.editSession : type === "exam" ? labels.addExam : labels.addSession}</Dialog.Title><Dialog.Description className="text-sm text-slate-500 mt-1">{classNameStr && `${labels.class} ${classNameStr} · `}{dayLabel} <span dir="ltr">· {slotStartTime}–{finishTime}</span></Dialog.Description></div>
            <Dialog.Close disabled={loading} aria-label={t.crud.cancel} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></Dialog.Close>
          </header>
          <div className="overflow-y-auto px-6 py-5 space-y-5">
            <section className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
                <div><label htmlFor={`${fieldPrefix}-time`} className="block text-sm font-medium text-slate-700 mb-1.5">{labels.startTime}</label><select id={`${fieldPrefix}-time`} aria-label={labels.startTime} dir="ltr" className={`${selectStyle} tabular-nums`} value={slotStartTime} onChange={e => { setSlotStartTime(e.target.value); setServerFailure(null); }}>{timeOptions.map(time => <option key={time} value={time}>{time}</option>)}</select></div>
                <div><label htmlFor={`${fieldPrefix}-duration`} className="block text-sm font-medium text-slate-700 mb-1.5">{labels.duration}</label><select id={`${fieldPrefix}-duration`} className={selectStyle} value={duration} onChange={e => { setDuration(Number(e.target.value)); setServerFailure(null); }}><option value={60}>{labels.oneHour}</option><option value={90}>{labels.oneHourThirty}</option><option value={120}>{labels.twoHours}</option></select></div>
                <div className="col-span-2 sm:col-span-1 flex sm:flex-col justify-between sm:justify-center gap-1 px-1 pb-1"><span className="text-xs font-medium text-slate-500">{labels.endTime}</span><strong dir="ltr" className="text-lg tabular-nums text-blue-900">{finishTime}</strong></div>
              </div>
              <p className="text-xs text-blue-700 mt-2.5 flex items-center gap-1.5"><Clock size={12} />{labels.hours24} · <span dir="ltr">{dayStartTime}–{dayEndTime}</span></p>
            </section>
            <div className="space-y-3">
              {sessions.map((sess, index) => {
                const availableSubjects = subjects.filter(s => type !== "exam" || !usedSubjectIds.includes(s.id) || String(s.id) === sess.subjectId);
                const classSubjects = availableSubjects.filter(s => classSubjectIds.has(s.id));
                const otherSubjects = availableSubjects.filter(s => !classSubjectIds.has(s.id));
                const eligibleTeachers = teachers.filter(teacher => !sess.subjectId || sess.subjectId === "FREE" || teacher.id === sess.teacherId || teacher.subjects?.some((s: any) => s.id === Number(sess.subjectId)));
                const busyTeacher = (id: string) => type === "timetable" && (overlapping.some(s => s.teacherId === id) || sessions.some((s, i) => i !== index && s.subjectId !== "FREE" && s.teacherId === id));
                const busyRoom = (id: number) => type === "timetable" && (overlapping.some(s => s.roomId === id) || sessions.some((s, i) => i !== index && s.subjectId !== "FREE" && Number(s.roomId) === id));
                return <section key={index} className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="flex items-center justify-between"><h4 className="text-sm font-semibold text-slate-700">{sessions.length > 1 ? `${labels.group} ${index + 1}` : labels.sessionDetails}</h4>{sessions.length > 1 && <button type="button" onClick={() => { setSessions(prev => prev.filter((_, i) => i !== index)); setServerFailure(null); }} aria-label={`${t.crud.delete} ${labels.group} ${index + 1}`} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 size={15} /></button>}</div>
                  <div><label htmlFor={`${fieldPrefix}-subject-${index}`} className="block text-sm text-slate-700 mb-1.5">{labels.subject} <span className="text-rose-500">*</span></label><select id={`${fieldPrefix}-subject-${index}`} className={selectStyle} value={sess.subjectId} onChange={e => updateSession(index, "subjectId", e.target.value)} required><option value="">{labels.selectSubject}</option><option value="FREE">{labels.freeBreak}</option>{classSubjects.length > 0 && <optgroup label={labels.classSubjects}>{classSubjects.map(s => <option key={s.id} value={s.id}>{formatSubjectName(s.name)}</option>)}</optgroup>}<optgroup label={classSubjects.length ? labels.otherSubjects : labels.allSubjects}>{otherSubjects.map(s => <option key={s.id} value={s.id}>{formatSubjectName(s.name)}</option>)}</optgroup></select></div>
                  {sess.subjectId !== "FREE" && <div className="grid sm:grid-cols-2 gap-3">
                    <div><label htmlFor={`${fieldPrefix}-teacher-${index}`} className="block text-sm text-slate-700 mb-1.5">{labels.teacher} <span className="text-xs text-slate-400">· {labels.optional}</span></label><select id={`${fieldPrefix}-teacher-${index}`} className={selectStyle} value={sess.teacherId} disabled={type === "exam"} onChange={e => updateSession(index, "teacherId", e.target.value)}><option value="">{labels.selectTeacher}</option>{eligibleTeachers.map(teacher => <option key={teacher.id} value={teacher.id} disabled={busyTeacher(teacher.id)}>{teacher.name} {teacher.surname}{busyTeacher(teacher.id) ? ` — ${labels.busy}` : ""}</option>)}</select></div>
                    <div><label htmlFor={`${fieldPrefix}-room-${index}`} className="block text-sm text-slate-700 mb-1.5">{labels.room} <span className="text-xs text-slate-400">· {labels.optional}</span></label><select id={`${fieldPrefix}-room-${index}`} className={selectStyle} value={sess.roomId} onChange={e => updateSession(index, "roomId", e.target.value)}><option value="">{labels.selectRoom}</option>{rooms.map(room => <option key={room.id} value={room.id} disabled={busyRoom(room.id)}>{room.name}{busyRoom(room.id) ? ` — ${labels.busy}` : ""}</option>)}</select></div>
                  </div>}
                </section>;
              })}
              {sessions.length < 12 && <button type="button" onClick={() => { setSessions(prev => [...prev, { id: -1, subjectId: "", teacherId: "", roomId: "" }]); setServerFailure(null); }} className="flex items-center gap-2 text-sm text-blue-700 font-medium py-1.5 hover:text-blue-900"><Plus size={16} />{labels.addGroup}</button>}
              {sessions.length > 1 && <p className="text-xs text-slate-500">{labels.groupHint}</p>}
            </div>
            {(validationCode || conflicts.length > 0 || serverFailure) ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold flex items-center gap-2"><AlertTriangle size={16} />{validationCode ? labels.validation[validationCode as keyof typeof labels.validation] : serverFailure?.message || labels.resolveConflicts}</p>{[...conflicts, ...(serverFailure?.conflicts || [])].map((c, i) => <p key={i} className="mt-1.5">{describeTimetableConflict(c, labels)}</p>)}</div> : !invalidSubject && type === "timetable" && <div className="flex items-center gap-2 text-sm text-emerald-700 rounded-lg bg-emerald-50 px-3 py-2.5"><ShieldCheck size={16} />{labels.noConflicts}</div>}
          </div>
          <footer className="border-t border-slate-200 px-6 py-4 flex flex-wrap gap-2.5 items-center bg-slate-50/60 shrink-0">
            {firstSlot && onDeleteAction && <button type="button" disabled={loading} onClick={() => setConfirmDelete(true)} className="text-rose-600 hover:bg-rose-50 p-2.5 rounded-lg flex items-center gap-1.5 text-sm font-medium"><Trash2 size={16} /><span className="hidden sm:inline">{t.crud.delete}</span></button>}
            <div className="flex-1" /><Dialog.Close disabled={loading} className="px-4 h-11 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700">{t.crud.cancel}</Dialog.Close><button type="button" disabled={!canSave} onClick={handleUpdate} className="px-5 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 disabled:bg-slate-200 disabled:text-slate-500"><Check size={16} />{loading ? labels.saving : labels.saveSession}</button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
    <Dialog.Root open={confirmDelete} onOpenChange={open => { if (!loading) setConfirmDelete(open); }}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[100000] bg-slate-950/50" /><Dialog.Content dir={isRtl ? "rtl" : "ltr"} className="fixed z-[100001] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%_-_2rem)] max-w-md rounded-2xl bg-white p-6 shadow-2xl focus:outline-none" onPointerDownOutside={e => e.preventDefault()} onEscapeKeyDown={e => { if (loading) e.preventDefault(); }}><Dialog.Title className="text-lg font-semibold text-slate-900">{labels.deleteSession}</Dialog.Title><Dialog.Description className="text-sm text-slate-600 mt-2 leading-relaxed">{type === "timetable" ? labels.deleteHint : t.confirmations.deleteTimeSlotMessage}</Dialog.Description><p className="my-4 text-sm font-semibold text-slate-700">{classNameStr} · {dayLabel} <span dir="ltr">· {startTime}–{endTime}</span></p><div className="flex justify-end gap-3"><Dialog.Close disabled={loading} className="h-11 px-4 rounded-lg border border-slate-300 text-sm">{t.crud.cancel}</Dialog.Close><button type="button" disabled={loading} onClick={handleDelete} className="h-11 px-4 rounded-lg bg-rose-600 text-white text-sm font-semibold disabled:opacity-50">{loading ? labels.saving : t.crud.delete}</button></div></Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
