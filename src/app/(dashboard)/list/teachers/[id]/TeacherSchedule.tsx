"use client";

import { useState } from "react";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  Users, 
  Printer, 
  LayoutGrid, 
  ListOrdered, 
  CalendarPlus,
  Sparkles
} from "lucide-react";
import Link from "next/link";

export interface ScheduleItem {
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
}

const DAYS_CONFIG: {
  key: "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY";
  labelFr: string;
  labelAr: string;
  labelEn: string;
  shortFr: string;
}[] = [
  { key: "MONDAY", labelFr: "Lundi", labelAr: "الإثنين", labelEn: "Monday", shortFr: "Lun" },
  { key: "TUESDAY", labelFr: "Mardi", labelAr: "الثلاثاء", labelEn: "Tuesday", shortFr: "Mar" },
  { key: "WEDNESDAY", labelFr: "Mercredi", labelAr: "الأربعاء", labelEn: "Wednesday", shortFr: "Mer" },
  { key: "THURSDAY", labelFr: "Jeudi", labelAr: "الخميس", labelEn: "Thursday", shortFr: "Jeu" },
  { key: "FRIDAY", labelFr: "Vendredi", labelAr: "الجمعة", labelEn: "Friday", shortFr: "Ven" },
  { key: "SATURDAY", labelFr: "Samedi", labelAr: "السبت", labelEn: "Saturday", shortFr: "Sam" },
];

const STANDARD_PERIODS = [
  { startTime: "08:00", endTime: "10:00" },
  { startTime: "10:00", endTime: "12:00" },
  { startTime: "14:00", endTime: "16:00" },
  { startTime: "16:00", endTime: "18:00" },
];

const PASTEL_THEMES = [
  { bg: "bg-blue-50/80 hover:bg-blue-50", border: "border-blue-200", text: "text-blue-900", accent: "bg-blue-500", badge: "bg-blue-100/80 text-blue-700" },
  { bg: "bg-emerald-50/80 hover:bg-emerald-50", border: "border-emerald-200", text: "text-emerald-900", accent: "bg-emerald-500", badge: "bg-emerald-100/80 text-emerald-700" },
  { bg: "bg-purple-50/80 hover:bg-purple-50", border: "border-purple-200", text: "text-purple-900", accent: "bg-purple-500", badge: "bg-purple-100/80 text-purple-700" },
  { bg: "bg-amber-50/80 hover:bg-amber-50", border: "border-amber-200", text: "text-amber-900", accent: "bg-amber-500", badge: "bg-amber-100/80 text-amber-700" },
  { bg: "bg-rose-50/80 hover:bg-rose-50", border: "border-rose-200", text: "text-rose-900", accent: "bg-rose-500", badge: "bg-rose-100/80 text-rose-700" },
  { bg: "bg-teal-50/80 hover:bg-teal-50", border: "border-teal-200", text: "text-teal-900", accent: "bg-teal-500", badge: "bg-teal-100/80 text-teal-700" },
];

export default function TeacherSchedule({
  items = [],
  teacherName = "",
}: {
  items: ScheduleItem[];
  teacherName?: string;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "agenda">("grid");
  const [selectedDay, setSelectedDay] = useState<string>("ALL");

  // Group items by day
  const groupedByDay: Record<string, ScheduleItem[]> = {
    MONDAY: [],
    TUESDAY: [],
    WEDNESDAY: [],
    THURSDAY: [],
    FRIDAY: [],
    SATURDAY: [],
  };

  items.forEach((item) => {
    if (groupedByDay[item.day]) {
      groupedByDay[item.day].push(item);
    }
  });

  // Sort each day chronologically
  Object.keys(groupedByDay).forEach((dayKey) => {
    groupedByDay[dayKey].sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  // Always show Monday through Saturday for a complete weekly view
  const activeDays = DAYS_CONFIG;

  // Calculate total weekly hours
  const totalWeeklyMinutes = items.reduce((acc, curr) => {
    if (curr.duration) return acc + curr.duration;
    const [sh, sm] = curr.startTime.split(":").map(Number);
    const [eh, em] = curr.endTime.split(":").map(Number);
    const diff = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalHours = Math.round(totalWeeklyMinutes / 60);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
              <CalendarIcon size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">
              Emploi du temps
            </h2>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              items.length > 0 
                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : "bg-slate-50 text-slate-500 border-slate-200"
            }`}>
              {totalHours > 0 ? `${totalHours}h / semaine` : `${items.length} séances`}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Planning hebdomadaire officiel des cours et séances
          </p>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* ACTION BUTTON TO SCHEDULE */}
          <Link
            href="/admin/timetable"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors border border-indigo-100"
            title="Gérer les créneaux dans le planificateur d'emploi du temps"
          >
            <CalendarPlus size={14} />
            <span>Gérer l&apos;emploi du temps</span>
          </Link>

          {/* VIEW SWITCHER */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "grid" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutGrid size={14} />
              <span className="hidden md:inline">Grille</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "agenda" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ListOrdered size={14} />
              <span className="hidden md:inline">Agenda</span>
            </button>
          </div>

          {/* PRINT BUTTON */}
          <button
            onClick={handlePrint}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors"
            title="Imprimer l'emploi du temps"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* CONTENT: ALWAYS DISPLAY THE SCHEDULE GRID (NEVER EMPTY BLANK VOID) */}
      {viewMode === "grid" ? (
        /* WEEKLY GRID MATRIX */
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="grid grid-cols-6 gap-3 min-w-[760px]">
            {activeDays.map((dayConfig) => {
              const daySlots = groupedByDay[dayConfig.key];
              const isToday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase() === dayConfig.key;

              return (
                <div 
                  key={dayConfig.key}
                  className={`flex flex-col rounded-xl border transition-all ${
                    isToday 
                      ? "bg-slate-50/70 border-indigo-200 shadow-sm" 
                      : "bg-slate-50/40 border-slate-100"
                  }`}
                >
                  {/* DAY HEADER */}
                  <div className={`p-3 border-b text-center rounded-t-xl ${
                    isToday 
                      ? "bg-indigo-600 text-white border-indigo-600" 
                      : "bg-white text-slate-700 border-slate-100 font-semibold"
                  }`}>
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {dayConfig.labelFr}
                    </span>
                    <span className={`text-[10px] font-medium block mt-0.5 ${isToday ? "text-indigo-100" : "text-slate-400"}`}>
                      {daySlots.length > 0 
                        ? `${daySlots.length} ${daySlots.length > 1 ? "séances" : "séance"}`
                        : "0 séance"}
                    </span>
                  </div>

                  {/* SLOTS LIST */}
                  <div className="p-2 flex flex-col gap-2 flex-1 min-h-[300px]">
                    {daySlots.length === 0 ? (
                      /* If no classes on this day, show the clean standard periods with subtle empty slots */
                      STANDARD_PERIODS.map((period, pIdx) => (
                        <div
                          key={pIdx}
                          className="rounded-xl border border-dashed border-slate-200/90 bg-white/60 p-2.5 flex flex-col justify-between min-h-[64px] transition-colors hover:bg-white hover:border-slate-300"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                              <Clock size={10} />
                              {period.startTime} - {period.endTime}
                            </span>
                          </div>
                          <div className="text-center py-1">
                            <span className="text-[10px] text-slate-300 font-medium">
                              Libre
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      /* If classes are scheduled, display the vibrant subject cards */
                      daySlots.map((slot, index) => {
                        const theme = PASTEL_THEMES[(slot.subjectId || index) % PASTEL_THEMES.length];
                        return (
                          <div
                            key={slot.id || index}
                            className={`rounded-xl border p-2.5 flex flex-col justify-between transition-all group hover:shadow-md relative overflow-hidden ${theme.bg} ${theme.border}`}
                          >
                            {/* Color accent bar on left */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />

                            <div className="pl-1">
                              {/* TIME BADGE */}
                              <div className="flex items-center justify-between gap-1 mb-1.5">
                                <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                  <Clock size={11} className="text-slate-400" />
                                  {slot.startTime} - {slot.endTime}
                                </span>
                              </div>

                              {/* SUBJECT NAME */}
                              <h4 className={`text-xs font-bold leading-snug line-clamp-2 mb-2 ${theme.text}`} title={slot.subjectName}>
                                {slot.subjectName}
                              </h4>
                            </div>

                            {/* CLASS & ROOM BADGES */}
                            <div className="flex items-center gap-1.5 flex-wrap pl-1 pt-1.5 border-t border-slate-200/50">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${theme.badge}`}>
                                <Users size={10} />
                                {slot.className}
                              </span>

                              {slot.roomName && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/80 text-slate-600 border border-slate-200/60 flex items-center gap-1">
                                  <MapPin size={10} className="text-slate-400" />
                                  {slot.roomName}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* AGENDA / DAY LIST VIEW */
        <div className="mt-5 flex flex-col gap-4">
          {/* DAY TABS FILTER */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedDay("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedDay === "ALL" 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tous les jours ({items.length})
            </button>
            {activeDays.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelectedDay(d.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  selectedDay === d.key 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                <span>{d.labelFr}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  selectedDay === d.key ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                }`}>
                  {groupedByDay[d.key].length}
                </span>
              </button>
            ))}
          </div>

          {/* AGENDA CARDS */}
          <div className="flex flex-col gap-3">
            {activeDays
              .filter((d) => selectedDay === "ALL" || selectedDay === d.key)
              .map((d) => {
                const daySlots = groupedByDay[d.key];
                
                return (
                  <div key={d.key} className="rounded-xl border border-slate-100 overflow-hidden bg-white">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {d.labelFr}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {daySlots.length} séance{daySlots.length > 1 ? "s" : ""}
                      </span>
                    </div>

                    <div className="p-3 divide-y divide-slate-100">
                      {daySlots.length === 0 ? (
                        <div className="py-4 text-center text-slate-400 text-xs italic">
                          Aucune séance programmée le {d.labelFr}.
                        </div>
                      ) : (
                        daySlots.map((slot, idx) => {
                          const theme = PASTEL_THEMES[(slot.subjectId || idx) % PASTEL_THEMES.length];
                          return (
                            <div key={slot.id || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="text-center min-w-[90px] bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200/50">
                                  <span className="text-xs font-bold text-slate-700 block leading-tight">
                                    {slot.startTime}
                                  </span>
                                  <span className="text-[10px] text-slate-400 block leading-tight">
                                    {slot.endTime}
                                  </span>
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-slate-800">
                                    {slot.subjectName}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                      {slot.className}
                                    </span>
                                    {slot.roomName && (
                                      <span className="text-xs text-slate-400 flex items-center gap-1">
                                        <MapPin size={11} />
                                        {slot.roomName}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${theme.bg} ${theme.border} ${theme.text}`}>
                                {slot.duration ? `${slot.duration} min` : "Séance"}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
