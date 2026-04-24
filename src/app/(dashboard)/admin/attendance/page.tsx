"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import FormModal from "@/components/FormModal";

type Status = "PRESENT" | "ABSENT" | "LATE" | null;

interface StudentRow {
  id: string;
  name: string;
  surname: string;
  img: string | null;
  attendance: { id: number; status: string; note: string | null }[];
}

interface ClassOption {
  id: number;
  name: string;
}

const STATUS_CONFIG = {
  PRESENT: { label: "Present", color: "bg-emerald-500 text-white shadow-emerald-200", ring: "ring-emerald-400", light: "bg-emerald-50 text-emerald-700" },
  LATE:    { label: "Late",    color: "bg-amber-500 text-white shadow-amber-200",   ring: "ring-amber-400",   light: "bg-amber-50 text-amber-700" },
  ABSENT:  { label: "Absent",  color: "bg-rose-500 text-white shadow-rose-200",      ring: "ring-rose-400",    light: "bg-rose-50 text-rose-700" },
};

export default function AttendancePage() {
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string>("ALL");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, { author: string; text: string }[]>>({});
  const [editNotes, setEditNotes] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "ALL">("ALL");

  // Load classes on mount
  useEffect(() => {
    fetch("/api/attendance/classes")
      .then((r) => r.json())
      .then((data) => {
        const classesArray = Array.isArray(data) ? data : [];
        setClasses(classesArray);
        if (classesArray.length > 0) setSelectedClass(String(classesArray[0].id));
      })
      .catch((err) => {
        console.error("Failed to fetch classes:", err);
        setClasses([]);
      });
  }, []);

  // Load students when class, date, or lesson changes
  const loadStudents = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    setIsDirty(false);
    const res = await fetch(`/api/attendance?classId=${selectedClass}&date=${date}&lessonId=${selectedLesson}`);
    const data = await res.json().catch(() => ({}));
    const fetchedLessons = data?.lessons || [];
    setLessons(fetchedLessons);

    if (fetchedLessons.length > 0) {
      if (selectedLesson === "ALL" || !fetchedLessons.find((l: any) => l.id === selectedLesson)) {
        setSelectedLesson(fetchedLessons[0].id);
      }
    } else {
      setSelectedLesson("");
    }

    const studentsArray = Array.isArray(data?.students) ? data.students : Array.isArray(data) ? data : [];
    setStudents(studentsArray);

    const initialStatuses: Record<string, Status> = {};
    const initialNotes: Record<string, { author: string; text: string }[]> = {};
    
    studentsArray.forEach((s: any) => {
      initialStatuses[s.id] = (s.attendance[0]?.status as Status) ?? null;
      let rawText = s.attendance[0]?.note ?? "";
      
      let parsedNotes: { author: string; text: string }[] = [];
      try {
        const p = JSON.parse(rawText);
        if (Array.isArray(p)) parsedNotes = p;
      } catch (e) {
        if (rawText) {
          let author = "Admin";
          let text = rawText;
          if (text.startsWith("[") && text.includes("] ")) {
            author = text.substring(1, text.indexOf("]"));
            text = text.substring(text.indexOf("] ") + 2);
          }
          parsedNotes = [{ author, text }];
        }
      }
      
      // Always append an empty one for the UI to type into immediately
      parsedNotes.push({ author: "Admin", text: "" });
      initialNotes[s.id] = parsedNotes;
    });
    setStatuses(initialStatuses);
    setNotes(initialNotes);
    setLoading(false);
  }, [selectedClass, date, selectedLesson]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const setAll = (status: Status) => {
    const next: Record<string, Status> = {};
    if (Array.isArray(students)) {
      students.forEach((s) => (next[s.id] = status));
    }
    setStatuses((prev) => ({ ...prev, ...next }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    setSaved(false);
    const records = (Array.isArray(students) ? students : [])
      .filter((s) => statuses[s.id])
      .map((s) => {
        const studentNotes = (notes[s.id] || []).filter(n => n.text.trim() !== "");
        return { 
          studentId: s.id, 
          status: statuses[s.id]!, 
          note: studentNotes.length > 0 ? JSON.stringify(studentNotes) : null
        };
      });

    await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records, date, lessonId: selectedLesson }),
    });
    setSaving(false);
    setSaved(true);
    setIsDirty(false);
    setTimeout(() => setSaved(false), 3000);
  };

  // Stats
  const total = Array.isArray(students) ? students.length : 0;
  const presentCount = Object.values(statuses).filter((s) => s === "PRESENT").length;
  const absentCount = Object.values(statuses).filter((s) => s === "ABSENT").length;
  const lateCount = Object.values(statuses).filter((s) => s === "LATE").length;
  const unmarked = total - presentCount - absentCount - lateCount;

  const filtered = (Array.isArray(students) ? students : []).filter((s) => {
    const matchSearch =
      !search ||
      `${s.name} ${s.surname}`.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "ALL" || statuses[s.id] === filter || (filter === null && !statuses[s.id]);
    return matchSearch && matchFilter;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Tracker</h1>
            <p className="text-sm text-slate-500 font-medium">Mark daily student attendance per class</p>
          </div>
        </div>

        {/* Lesson Actions */}
        <div className="flex items-center gap-3 mt-4 md:mt-0">
          {selectedLesson && selectedLesson !== "ALL" && (
            <>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lesson Actions:</span>
                <div className="flex gap-2">
                   <FormModal 
                    table="assignment" 
                    type="create" 
                    data={{ lessonId: parseInt(selectedLesson) }}
                  />
                  <FormModal 
                    table="resource" 
                    type="create" 
                    data={{ lessonId: parseInt(selectedLesson) }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 mb-6 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
          />
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Session</label>
          <select
            value={selectedLesson}
            onChange={(e) => setSelectedLesson(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            disabled={lessons.length === 0}
          >
            {lessons.length === 0 && <option value="">No sessions today</option>}
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.subject?.name || l.name} ({new Date(l.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Search</label>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-slate-50"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !isDirty}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md shadow-indigo-200 transition-all disabled:opacity-60"
        >
          {saving ? (
            <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Saving...</>
          ) : (saved || !isDirty) ? (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg> Saved!</>
          ) : (
            <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg> Save Attendance</>
          )}
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: total, color: "bg-slate-100 text-slate-700", dot: "bg-slate-400" },
          { label: "Present", value: presentCount, color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
          { label: "Late", value: lateCount, color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
          { label: "Absent", value: absentCount, color: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-2xl p-4 flex items-center gap-3 shadow-sm`}>
            <div className={`w-3 h-3 rounded-full ${stat.dot} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-black">{stat.value}</p>
              <p className="text-xs font-bold opacity-70 uppercase tracking-wider">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Mark All Buttons */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mark all as:</span>
        {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setAll(s)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${STATUS_CONFIG[s].color} shadow-sm`}
          >
            {STATUS_CONFIG[s].label}
          </button>
        ))}
        <button
          onClick={() => setAll(null)}
          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
        >
          Clear All
        </button>

        {/* Filter Tabs */}
        <div className="ml-auto flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {(["ALL", "PRESENT", "LATE", "ABSENT"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                filter === f ? "bg-white text-slate-700 shadow-sm" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              {f === "ALL" ? "All" : STATUS_CONFIG[f].label}
            </button>
          ))}
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-8 h-8 animate-spin mb-4 text-indigo-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
            <span className="font-semibold">Loading students...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <svg className="w-12 h-12 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="font-semibold">No students found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Student</th>
                <th className="text-center px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-4 text-xs font-black text-slate-400 uppercase tracking-wider hidden lg:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => {
                const status = statuses[student.id];
                const config = status ? STATUS_CONFIG[status] : null;
                return (
                  <tr
                    key={student.id}
                    className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? "" : "bg-slate-50/50"}`}
                  >
                    {/* Student Info */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`relative w-10 h-10 rounded-full overflow-hidden ring-2 ${config?.ring ?? "ring-slate-200"} flex-shrink-0`}>
                          <Image
                            src={student.img || "/noavatar.png"}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 text-sm">{student.name} {student.surname}</p>
                          {config && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${config.light}`}>
                              {config.label}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status Buttons */}
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => (
                          <button
                            key={s}
                            onClick={() => {
                              setStatuses((prev) => ({ ...prev, [student.id]: prev[student.id] === s ? null : s }));
                              setIsDirty(true);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 shadow-sm ${
                              statuses[student.id] === s
                                ? STATUS_CONFIG[s].color + " shadow-md scale-105"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </div>
                    </td>

                    {/* Note */}
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-2">
                        {editNotes[student.id] ? (
                          (notes[student.id] || []).map((noteObj, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <select
                                value={noteObj.author}
                                onChange={(e) => {
                                  const newNotes = [...(notes[student.id] || [])];
                                  newNotes[idx].author = e.target.value;
                                  setNotes(prev => ({ ...prev, [student.id]: newNotes }));
                                  setIsDirty(true);
                                }}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-300 min-w-[110px]"
                              >
                                <option value="Admin">Admin (Fares)</option>
                                <option value="Tarek Ben Ali">T. Ben Ali (Math)</option>
                                <option value="Sarah Mabrouk">S. Mabrouk (French)</option>
                                <option value="Supervisor">Supervisor</option>
                              </select>
                              <input
                                type="text"
                                placeholder={idx === (notes[student.id]?.length || 0) - 1 ? "Add note..." : "Note content..."}
                                value={noteObj.text}
                                onChange={(e) => {
                                  const newNotes = [...(notes[student.id] || [])];
                                  newNotes[idx].text = e.target.value;
                                  setNotes(prev => ({ ...prev, [student.id]: newNotes }));
                                  setIsDirty(true);
                                }}
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-transparent"
                              />
                              {idx === (notes[student.id]?.length || 0) - 1 && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setNotes(prev => ({ ...prev, [student.id]: [...(notes[student.id] || []), { author: "Admin", text: "" }] }));
                                      setIsDirty(true);
                                    }}
                                    className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center border border-indigo-100 border-b-2 transition-all active:translate-y-[1px] active:border-b font-black"
                                  >
                                    +
                                  </button>
                                  <button
                                    onClick={() => setEditNotes(prev => ({ ...prev, [student.id]: false }))}
                                    className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center border border-emerald-100 border-b-2 transition-all active:translate-y-[1px] active:border-b"
                                    title="Done editing"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 min-h-[46px] group hover:border-indigo-100 transition-colors">
                            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                              {(() => {
                                const validNotes = (notes[student.id] || []).filter(n => n.text.trim() !== "");
                                if (validNotes.length === 0) return <span className="text-xs text-slate-400 font-medium italic">No notes</span>;
                                return validNotes.map((n, i) => (
                                  <div key={i} className="flex items-start gap-2 text-xs truncate">
                                    <span className="font-bold text-slate-500 shrink-0">{n.author}:</span>
                                    <span className="text-slate-600 truncate" title={n.text}>{n.text}</span>
                                  </div>
                                ));
                               })()}
                            </div>
                            <button
                              onClick={() => setEditNotes(prev => ({ ...prev, [student.id]: true }))}
                              className="w-8 h-8 rounded-lg bg-white text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center shrink-0 border border-slate-200 hover:border-indigo-200 transition-all shadow-sm opacity-0 group-hover:opacity-100 focus:opacity-100"
                              title="Edit Notes"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Footer progress bar */}
        {total > 0 && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-bold text-slate-500">Progress</span>
              <span className="text-xs text-slate-400">{total - unmarked}/{total} marked</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(presentCount / total) * 100}%` }} />
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${(lateCount / total) * 100}%` }} />
              <div className="bg-rose-500 h-full transition-all" style={{ width: `${(absentCount / total) * 100}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
