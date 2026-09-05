"use client";

import { useState } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  User, 
  Printer, 
  LayoutGrid, 
  ListOrdered,
  BookOpen,
  GraduationCap
} from "lucide-react";

export interface StudentScheduleItem {
  id: number | string;
  day: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  startTime: string; // "08:00"
  endTime: string;   // "10:00"
  duration?: number;
  subjectName: string;
  subjectId?: number;
  className: string;
  classId?: number;
  roomName?: string;
  teacherName?: string;
}

const DAYS_CONFIG: {
  key: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  labelFr: string;
  labelAr: string;
  shortFr: string;
}[] = [
  { key: "MONDAY", labelFr: "Lundi", labelAr: "الإثنين", shortFr: "Lun" },
  { key: "TUESDAY", labelFr: "Mardi", labelAr: "الثلاثاء", shortFr: "Mar" },
  { key: "WEDNESDAY", labelFr: "Mercredi", labelAr: "الأربعاء", shortFr: "Mer" },
  { key: "THURSDAY", labelFr: "Jeudi", labelAr: "الخميس", shortFr: "Jeu" },
  { key: "FRIDAY", labelFr: "Vendredi", labelAr: "الجمعة", shortFr: "Ven" },
  { key: "SATURDAY", labelFr: "Samedi", labelAr: "السبت", shortFr: "Sam" },
];

const STANDARD_PERIODS = [
  { id: 1, label: "08:00 - 10:00", startHour: 8, endHour: 10, title: "Matinée 1" },
  { id: 2, label: "10:00 - 12:00", startHour: 10, endHour: 12, title: "Matinée 2" },
  { id: 3, label: "14:00 - 16:00", startHour: 14, endHour: 16, title: "Après-midi 1" },
  { id: 4, label: "16:00 - 18:00", startHour: 16, endHour: 18, title: "Après-midi 2" },
];

const PASTEL_THEMES = [
  { bg: "bg-blue-50/90 hover:bg-blue-50", border: "border-blue-200", text: "text-blue-900", accent: "bg-blue-500", badge: "bg-blue-100/90 text-blue-800" },
  { bg: "bg-emerald-50/90 hover:bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", accent: "bg-emerald-500", badge: "bg-emerald-100/90 text-emerald-800" },
  { bg: "bg-purple-50/90 hover:bg-purple-50", border: "border-purple-200", text: "text-purple-900", accent: "bg-purple-500", badge: "bg-purple-100/90 text-purple-800" },
  { bg: "bg-amber-50/90 hover:bg-amber-50", border: "border-amber-200", text: "text-amber-900", accent: "bg-amber-500", badge: "bg-amber-100/90 text-amber-800" },
  { bg: "bg-rose-50/90 hover:bg-rose-50", border: "border-rose-200", text: "text-rose-900", accent: "bg-rose-500", badge: "bg-rose-100/90 text-rose-800" },
  { bg: "bg-teal-50/90 hover:bg-teal-50", border: "border-teal-200", text: "text-teal-900", accent: "bg-teal-500", badge: "bg-teal-100/90 text-teal-800" },
];

function getPeriodForSlot(startTime?: string): number {
  if (!startTime || typeof startTime !== "string") return 1;
  const parts = startTime.split(":");
  const h = Number(parts[0]);
  if (isNaN(h)) return 1;
  if (h < 10) return 1;
  if (h < 13) return 2;
  if (h < 16) return 3;
  return 4;
}

export default function StudentScheduleTab({
  items = [],
  studentName = "",
  className = "",
}: {
  items: StudentScheduleItem[];
  studentName?: string;
  className?: string;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "agenda">("grid");
  const [selectedDay, setSelectedDay] = useState<string>("ALL");

  const safeItems: StudentScheduleItem[] = (items || []).filter(Boolean).map((item) => {
    const rawDay = (item.day || "MONDAY").toUpperCase();
    const validDay = (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].includes(rawDay)
      ? rawDay
      : "MONDAY") as StudentScheduleItem["day"];
    return {
      ...item,
      id: item.id || Math.random(),
      day: validDay,
      startTime: typeof item.startTime === "string" && item.startTime.trim() ? item.startTime.trim() : "08:00",
      endTime: typeof item.endTime === "string" && item.endTime.trim() ? item.endTime.trim() : "10:00",
      subjectName: item.subjectName || "Matière",
      className: item.className || className || "Classe",
    };
  });

  const groupedByDay: Record<string, StudentScheduleItem[]> = {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
  };

  safeItems.forEach((item) => {
    if (groupedByDay[item.day]) {
      groupedByDay[item.day].push(item);
    }
  });

  Object.keys(groupedByDay).forEach((dayKey) => {
    groupedByDay[dayKey].sort((a, b) => {
      const aTime = a?.startTime || "00:00";
      const bTime = b?.startTime || "00:00";
      return aTime.localeCompare(bTime);
    });
  });

  const totalWeeklyMinutes = safeItems.reduce((acc, curr) => {
    if (curr.duration) return acc + curr.duration;
    const [sh, sm] = curr.startTime.split(":").map(Number);
    const [eh, em] = curr.endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalWeeklyHours = Math.round(totalWeeklyMinutes / 60);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
              <CalendarIcon size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Emploi du Temps Hebdomadaire
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Planning officiel des cours de la classe {className || ""}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "grid"}
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid size={13} />
              <span>Grille</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "agenda"}
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === "agenda"
                  ? "bg-white text-indigo-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <ListOrdered size={13} />
              <span>Agenda</span>
            </button>
          </div>

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <Printer size={14} />
            <span>Imprimer</span>
          </button>
        </div>
      </div>

      {/* 2. STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
          <div>
            <span className="text-xl font-black text-slate-800">{totalWeeklyHours}h</span>
            <span className="text-[11px] text-slate-400 block font-medium">Volume hebdomadaire</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <BookOpen size={18} />
          </div>
          <div>
            <span className="text-xl font-black text-slate-800">{safeItems.length}</span>
            <span className="text-[11px] text-slate-400 block font-medium">Séances par semaine</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex items-center gap-3 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <GraduationCap size={18} />
          </div>
          <div>
            <span className="text-xl font-black text-slate-800">{className || "Classe"}</span>
            <span className="text-[11px] text-slate-400 block font-medium">Classe assignée</span>
          </div>
        </div>
      </div>

      {/* 3. SCHEDULE CONTENT (GRID OR AGENDA) */}
      {safeItems.length > 0 ? (
        viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="bg-white rounded-2xl border border-slate-100 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left min-w-[750px]">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80">
                    <th className="p-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-32">
                      Créneau
                    </th>
                    {DAYS_CONFIG.map((day) => (
                      <th key={day.key} className="p-3 text-center border-l border-slate-200/50">
                        <span className="text-xs font-bold text-slate-800 block">{day.labelFr}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{day.labelAr}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {STANDARD_PERIODS.map((period) => (
                    <tr key={period.id} className="hover:bg-slate-50/40 transition-colors">
                      <td className="p-3 bg-slate-50/40 font-mono text-xs text-slate-600 border-r border-slate-100 align-top">
                        <span className="font-bold text-slate-800 block">{period.label}</span>
                        <span className="text-[10px] text-slate-400 font-sans">{period.title}</span>
                      </td>

                      {DAYS_CONFIG.map((day) => {
                        const slotsInPeriod = (groupedByDay[day.key] || []).filter(
                          (item) => getPeriodForSlot(item.startTime) === period.id
                        );

                        return (
                          <td key={day.key} className="p-2 border-l border-slate-100 align-top h-24 w-1/6">
                            {slotsInPeriod.length > 0 ? (
                              <div className="flex flex-col gap-1.5 h-full">
                                {slotsInPeriod.map((slot, sIdx) => {
                                  const theme = PASTEL_THEMES[(Number(slot.subjectId || sIdx)) % PASTEL_THEMES.length];
                                  return (
                                    <div
                                      key={slot.id}
                                      className={`p-2.5 rounded-xl border transition-all flex flex-col justify-between gap-1 shadow-2xs ${theme.bg} ${theme.border}`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className={`text-xs font-black truncate block ${theme.text}`}>
                                            {slot.subjectName}
                                          </span>
                                        </div>
                                        <span className="text-[10px] text-slate-500 font-mono block">
                                          {slot.startTime} - {slot.endTime}
                                        </span>
                                      </div>

                                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-200/40 mt-1">
                                        {slot.teacherName && (
                                          <span className="truncate flex items-center gap-1 font-medium">
                                            <User size={10} className="shrink-0 text-slate-400" />
                                            {slot.teacherName}
                                          </span>
                                        )}
                                        {slot.roomName && (
                                          <span className="truncate flex items-center gap-0.5 text-slate-400 ml-auto">
                                            <MapPin size={10} className="shrink-0" />
                                            {slot.roomName}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="h-full min-h-[70px] rounded-lg border border-dashed border-slate-100 flex items-center justify-center">
                                <span className="text-[11px] text-slate-300 font-medium">-</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* AGENDA VIEW */
          <div className="flex flex-col gap-4">
            {/* Day Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedDay("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedDay === "ALL" ? "bg-slate-900 text-white" : "bg-white text-slate-600 border border-slate-200/60"
                }`}
              >
                Tous les jours
              </button>
              {DAYS_CONFIG.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setSelectedDay(d.key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    selectedDay === d.key ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200/60"
                  }`}
                >
                  {d.labelFr} ({(groupedByDay[d.key] || []).length})
                </button>
              ))}
            </div>

            {/* Day Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DAYS_CONFIG.filter((d) => selectedDay === "ALL" || selectedDay === d.key).map((day) => {
                const daySlots = groupedByDay[day.key] || [];
                return (
                  <div key={day.key} className="bg-white rounded-2xl border border-slate-100 p-4 shadow-xs flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{day.labelFr}</span>
                        <span className="text-xs text-slate-400 font-arabic">{day.labelAr}</span>
                      </div>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {daySlots.length} cours
                      </span>
                    </div>

                    {daySlots.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {daySlots.map((slot, sIdx) => {
                          const theme = PASTEL_THEMES[(Number(slot.subjectId || sIdx)) % PASTEL_THEMES.length];
                          return (
                            <div
                              key={slot.id}
                              className={`p-3 rounded-xl border flex flex-col gap-1.5 ${theme.bg} ${theme.border}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${theme.text}`}>
                                  {slot.subjectName}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                  {slot.startTime} - {slot.endTime}
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/40">
                                {slot.teacherName ? (
                                  <span className="flex items-center gap-1 font-medium">
                                    <User size={11} className="text-slate-400" />
                                    {slot.teacherName}
                                  </span>
                                ) : (
                                  <span className="italic text-slate-400">Enseignant non spécifié</span>
                                )}
                                {slot.roomName && (
                                  <span className="flex items-center gap-1 text-slate-500 font-medium">
                                    <MapPin size={11} className="text-slate-400" />
                                    {slot.roomName}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-300 text-xs italic">
                        Aucun cours prévu ce jour
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
            <CalendarIcon size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-800">
            Aucun emploi du temps configuré
          </h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Aucun créneau d&apos;emploi du temps n&apos;a encore été créé pour la classe de cet élève.
          </p>
        </div>
      )}
    </div>
  );
}
