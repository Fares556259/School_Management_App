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
  Sparkles,
  CheckCircle2
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
  shortFr: string;
}[] = [
  { key: "MONDAY", labelFr: "Lundi", labelAr: "الإثنين", shortFr: "Lun" },
  { key: "TUESDAY", labelFr: "Mardi", labelAr: "الثلاثاء", shortFr: "Mar" },
  { key: "WEDNESDAY", labelFr: "Mercredi", labelAr: "الأربعاء", shortFr: "Mer" },
  { key: "THURSDAY", labelFr: "Jeudi", labelAr: "الخميس", shortFr: "Jeu" },
  { key: "FRIDAY", labelFr: "Vendredi", labelAr: "الجمعة", shortFr: "Ven" },
  { key: "SATURDAY", labelFr: "Samedi", labelAr: "السبت", shortFr: "Sam" },
];

// Standard 4 periods used in educational timetables
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

// Helper to determine which standard period a slot belongs to
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

export default function TeacherSchedule({
  items = [],
  teacherName = "",
}: {
  items: ScheduleItem[];
  teacherName?: string;
}) {
  const [viewMode, setViewMode] = useState<"grid" | "agenda">("grid");
  const [selectedDay, setSelectedDay] = useState<string>("ALL");

  // Normalize items defensively
  const safeItems: ScheduleItem[] = (items || []).filter(Boolean).map((item) => {
    const rawDay = (item.day || "MONDAY").toUpperCase();
    const validDay = (["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].includes(rawDay)
      ? rawDay
      : "MONDAY") as ScheduleItem["day"];
    return {
      ...item,
      id: item.id || Math.random(),
      day: validDay,
      startTime: typeof item.startTime === "string" && item.startTime.trim() ? item.startTime.trim() : "08:00",
      endTime: typeof item.endTime === "string" && item.endTime.trim() ? item.endTime.trim() : "10:00",
      subjectName: item.subjectName || "Matière",
      className: item.className || "Classe",
    };
  });

  // Group items by day
  const groupedByDay: Record<string, ScheduleItem[]> = {
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

  // Sort each day chronologically
  Object.keys(groupedByDay).forEach((dayKey) => {
    groupedByDay[dayKey].sort((a, b) => {
      const aTime = a?.startTime || "00:00";
      const bTime = b?.startTime || "00:00";
      return aTime.localeCompare(bTime);
    });
  });

  // Calculate total weekly hours
  const totalWeeklyMinutes = safeItems.reduce((acc, curr) => {
    if (curr.duration && !isNaN(curr.duration)) return acc + curr.duration;
    const [sh, sm] = (curr.startTime || "08:00").split(":").map(Number);
    const [eh, em] = (curr.endTime || "10:00").split(":").map(Number);
    const startMin = (isNaN(sh) ? 8 : sh) * 60 + (isNaN(sm) ? 0 : sm);
    const endMin = (isNaN(eh) ? 10 : eh) * 60 + (isNaN(em) ? 0 : em);
    const diff = endMin - startMin;
    return acc + (diff > 0 ? diff : 120);
  }, 0);

  const totalHours = Math.round(totalWeeklyMinutes / 60);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
      {/* 1. HEADER & ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <CalendarIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800">
                  Emploi du temps hebdomadaire
                </h2>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  items.length > 0 
                    ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                    : "bg-slate-50 text-slate-500 border-slate-200"
                }`}>
                  {totalHours > 0 ? `${totalHours}h / semaine` : `${items.length} séances`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Planning officiel des cours dispensés du Lundi au Samedi
              </p>
            </div>
          </div>
        </div>

        {/* CONTROLS */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Action button to schedule builder */}
          <Link
            href="/admin/timetable"
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors border border-indigo-100"
            title="Gérer les créneaux dans le planificateur d'emploi du temps"
          >
            <CalendarPlus size={14} />
            <span>Planificateur</span>
          </Link>

          {/* View switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "grid" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <LayoutGrid size={14} />
              <span>Grille</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "agenda" 
                  ? "bg-white text-slate-800 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <ListOrdered size={14} />
              <span>Agenda</span>
            </button>
          </div>

          {/* Print button */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors cursor-pointer"
            title="Imprimer l'emploi du temps"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {/* 2. SYNCHRONIZED MATRIX GRID VIEW */}
      {viewMode === "grid" ? (
        <div className="mt-5 overflow-x-auto pb-2">
          <div className="grid grid-cols-6 gap-3 min-w-[840px]">
            {DAYS_CONFIG.map((dayConfig) => {
              const daySlots = groupedByDay[dayConfig.key];
              const isToday = new Date().toLocaleDateString("en-US", { weekday: "long" }).toUpperCase() === dayConfig.key;

              return (
                <div 
                  key={dayConfig.key}
                  className={`flex flex-col rounded-2xl border transition-all ${
                    isToday 
                      ? "bg-indigo-50/20 border-indigo-200 shadow-xs" 
                      : "bg-slate-50/40 border-slate-100"
                  }`}
                >
                  {/* DAY HEADER */}
                  <div className={`p-3 border-b text-center rounded-t-2xl ${
                    isToday 
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-xs" 
                      : "bg-white text-slate-700 border-slate-100 font-semibold"
                  }`}>
                    <span className="text-xs font-bold uppercase tracking-wider block">
                      {dayConfig.labelFr}
                    </span>
                    <span className={`text-[10px] font-medium block mt-0.5 ${
                      isToday ? "text-indigo-100" : "text-slate-400"
                    }`}>
                      {daySlots.length > 0 
                        ? `${daySlots.length} ${daySlots.length > 1 ? "séances" : "séance"}`
                        : "Libre"}
                    </span>
                  </div>

                  {/* SYNCHRONIZED 4-PERIOD ROWS */}
                  <div className="p-2.5 flex flex-col gap-2.5 flex-1">
                    {STANDARD_PERIODS.map((period) => {
                      // Find any slots assigned to this standard period slot
                      const periodSlots = daySlots.filter(
                        (s) => getPeriodForSlot(s.startTime) === period.id
                      );

                      if (periodSlots.length === 0) {
                        // Empty slot: render subtle aligned placeholder
                        return (
                          <div
                            key={period.id}
                            className="rounded-xl border border-dashed border-slate-200/80 bg-white/50 p-2.5 flex flex-col justify-between min-h-[82px] transition-colors hover:bg-white/80 hover:border-slate-300"
                          >
                            <span className="text-[10px] font-semibold text-slate-300 flex items-center gap-1">
                              <Clock size={10} />
                              {period.label}
                            </span>
                            <div className="text-center py-1">
                              <span className="text-[10px] text-slate-300 font-medium">
                                —
                              </span>
                            </div>
                          </div>
                        );
                      }

                      // Scheduled slots: render colorful lesson cards
                      return (
                        <div key={period.id} className="flex flex-col gap-1.5">
                          {periodSlots.map((slot, index) => {
                            const theme = PASTEL_THEMES[(slot.subjectId || index) % PASTEL_THEMES.length];
                            return (
                              <div
                                key={slot.id || index}
                                className={`rounded-xl border p-2.5 flex flex-col justify-between min-h-[82px] transition-all group hover:shadow-md relative overflow-hidden ${theme.bg} ${theme.border}`}
                              >
                                {/* Left accent strip */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.accent}`} />

                                <div className="pl-1">
                                  {/* Time badge */}
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
                                      <Clock size={11} className="text-slate-400" />
                                      {slot.startTime} - {slot.endTime}
                                    </span>
                                    {slot.duration && (
                                      <span className="text-[9px] font-semibold text-slate-400">
                                        {slot.duration}m
                                      </span>
                                    )}
                                  </div>

                                  {/* Subject */}
                                  <h4 className={`text-xs font-bold leading-snug line-clamp-2 mb-1.5 ${theme.text}`} title={slot.subjectName}>
                                    {slot.subjectName}
                                  </h4>
                                </div>

                                {/* Class & Room pills */}
                                <div className="flex items-center gap-1.5 flex-wrap pl-1 pt-1.5 border-t border-slate-200/50">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${theme.badge}`}>
                                    <Users size={10} />
                                    {slot.className}
                                  </span>

                                  {slot.roomName && (
                                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/90 text-slate-600 border border-slate-200/60 flex items-center gap-1">
                                      <MapPin size={10} className="text-slate-400" />
                                      {slot.roomName}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* 3. AGENDA LIST VIEW */
        <div className="mt-5 flex flex-col gap-4">
          {/* Day tabs filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
            <button
              type="button"
              onClick={() => setSelectedDay("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedDay === "ALL" 
                  ? "bg-slate-800 text-white shadow-sm" 
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Tous les jours ({safeItems.length})
            </button>
            {DAYS_CONFIG.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setSelectedDay(d.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
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

          {/* Chronological list */}
          <div className="flex flex-col gap-3">
            {DAYS_CONFIG
              .filter((d) => selectedDay === "ALL" || selectedDay === d.key)
              .map((d) => {
                const daySlots = groupedByDay[d.key];
                
                return (
                  <div key={d.key} className="rounded-2xl border border-slate-100 overflow-hidden bg-white">
                    <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
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
                          Aucun cours dispensé le {d.labelFr}.
                        </div>
                      ) : (
                        daySlots.map((slot, idx) => {
                          const theme = PASTEL_THEMES[(slot.subjectId || idx) % PASTEL_THEMES.length];
                          return (
                            <div key={slot.id || idx} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="text-center min-w-[95px] bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/50">
                                  <span className="text-xs font-bold text-slate-800 block leading-tight">
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
                                      Classe {slot.className}
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
                              <span className={`text-xs font-bold px-3 py-1 rounded-xl border ${theme.bg} ${theme.border} ${theme.text}`}>
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
