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
  monthlyAbsences: number;
  parent: {
    name: string;
    surname: string;
    phone: string;
  };
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
  const [assignments, setAssignments] = useState<any[]>([]);
  const [resources, setResources] = useState<any[]>([]);
  const [canEdit, setCanEdit] = useState(false);

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
      const firstLessonId = String(fetchedLessons[0].id);
      if (selectedLesson === "ALL" || !fetchedLessons.find((l: any) => String(l.id) === selectedLesson)) {
        if (selectedLesson !== firstLessonId) {
          setSelectedLesson(firstLessonId);
        }
      }
    } else if (selectedLesson !== "") {
      setSelectedLesson("");
    }

    const studentsArray = Array.isArray(data?.students) ? data.students : Array.isArray(data) ? data : [];
    setStudents(studentsArray);
    setAssignments(data?.assignments || []);
    setResources(data?.resources || []);

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

  const filtered = (students || []).filter((s) => {
    const fullName = `${s.name || ""} ${s.surname || ""}`.toLowerCase();
    const matchesSearch = !search || fullName.includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" || statuses[s.id] === filter || (filter === null && !statuses[s.id]);
    return matchesSearch && matchesFilter;
  });

  return <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-200">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance & Absence Tracking</h1>
            <p className="text-sm text-slate-500 font-medium text-balance max-w-md">Real-time monitoring of session logs. Data is recorded exclusively by teachers via the SnapSchool mobile app.</p>
          </div>
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
                {l.subject?.name || l.name} {l.startTime ? `(${new Date(l.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ""}
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
 
       {/* Insights Section */}
       {filtered.some(s => s.monthlyAbsences > 2) && (
         <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-white border border-rose-100 rounded-[2.5rem] p-8 shadow-xl shadow-rose-100/20 overflow-hidden relative group">
             {/* Background Decoration */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50 rounded-full -mr-32 -mt-32 opacity-50 group-hover:scale-110 transition-transform duration-700" />
             
             <div className="relative flex flex-col lg:flex-row gap-8 items-start">
               <div className="flex-shrink-0">
                 <div className="w-16 h-16 rounded-[2rem] bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200">
                   <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                   </svg>
                 </div>
               </div>

               <div className="flex-1">
                 <div className="mb-6">
                   <h3 className="text-xl font-black text-rose-900 tracking-tight mb-2">Attention Required: High Absence Alerts</h3>
                   <p className="text-sm text-rose-600 font-semibold leading-relaxed max-w-2xl">
                     The following students have missed <span className="px-2 py-0.5 bg-rose-500 text-white rounded-lg mx-1">3 or more</span> sessions this month. Immediate parent contact is recommended to discuss their academic progress.
                   </p>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                   {filtered
                     .filter(s => s.monthlyAbsences > 2)
                     .map(s => (
                       <div key={s.id} className="bg-rose-50/50 border border-rose-100 rounded-3xl p-5 hover:bg-rose-50 transition-all group/item">
                         <div className="flex items-center gap-4 mb-4">
                           <div className="relative w-12 h-12 rounded-2xl overflow-hidden ring-4 ring-white shadow-sm flex-shrink-0">
                             <Image src={s.img || "/noavatar.png"} alt="" fill className="object-cover" />
                           </div>
                           <div className="min-w-0">
                             <p className="font-black text-rose-900 text-base truncate">{s.name} {s.surname}</p>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black bg-rose-500 text-white px-2 py-0.5 rounded-md uppercase tracking-wider">
                                 {s.monthlyAbsences} Absences
                               </span>
                             </div>
                           </div>
                         </div>
                         
                         <div className="space-y-3 pt-4 border-t border-rose-100/50">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm text-rose-400">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest leading-none mb-1">Parent</p>
                                  <p className="text-xs font-bold text-rose-800 truncate">{s.parent?.name} {s.parent?.surname}</p>
                                </div>
                              </div>
                            </div>

                            <a 
                              href={`tel:${s.parent?.phone}`}
                              className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-rose-500 rounded-2xl text-xs font-black text-rose-600 hover:text-white transition-all border border-rose-200 hover:border-rose-400 shadow-sm"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              CALL PARENT
                            </a>
                         </div>
                       </div>
                     ))}
                 </div>
               </div>
             </div>
           </div>
         </div>
       )}


      {/* Filter Tabs */}
      <div className="flex items-center gap-3 mb-4">
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
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden mb-8">
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
                          <div className="flex items-center gap-2 mt-0.5">
                            {config && (
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${config.light}`}>
                                {config.label}
                              </span>
                            )}
                            {student.attendance[0]?.id && !String(student.attendance[0]?.id).startsWith('v-') && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase tracking-tighter" title="Recorded by teacher during session">
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Mobile Log
                              </span>
                            )}
                            {student.monthlyAbsences > 0 && (
                               <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${student.monthlyAbsences > 2 ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                                 {student.monthlyAbsences} Abs/Month
                               </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center">
                        {status ? (
                          <div className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${config?.color} shadow-sm min-w-[100px] text-center`}>
                            {config?.label}
                          </div>
                        ) : (
                          <div className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 uppercase tracking-wider min-w-[100px] text-center">
                            Pending
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-1.5">
                        {(() => {
                          const validNotes = (notes[student.id] || []).filter(n => n.text.trim() !== "");
                          if (validNotes.length === 0) return <span className="text-xs text-slate-300 font-medium italic">No teacher remarks</span>;
                          return validNotes.map((n, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <span className="font-bold text-slate-400 shrink-0">{n.author}:</span>
                              <span className="text-slate-500 leading-relaxed">{n.text}</span>
                            </div>
                          ));
                        })()}
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
