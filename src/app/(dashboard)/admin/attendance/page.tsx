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
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">Attendance Monitoring & Management</h1>
            <p className="text-sm text-slate-500 font-medium text-balance max-w-md">Primary recording is managed by teachers via mobile. Admins can monitor logs and perform overrides if necessary.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Admin Override</span>
             <button 
               onClick={() => setCanEdit(!canEdit)}
               className={`w-12 h-6 rounded-full transition-all relative ${canEdit ? 'bg-indigo-600' : 'bg-slate-200'}`}
             >
               <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${canEdit ? 'left-7' : 'left-1'}`} />
             </button>
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
        {canEdit && (
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
        )}
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
         <div className="mb-6 animate-in fade-in slide-in-from-top-4 duration-500">
           <div className="bg-rose-50 border border-rose-100 rounded-3xl p-5 flex items-center gap-6">
             <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-200 shrink-0">
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
               </svg>
             </div>
             <div className="flex-1">
               <h3 className="text-sm font-black text-rose-800 uppercase tracking-tight mb-1">Attention Needed</h3>
               <p className="text-xs text-rose-600 font-semibold leading-relaxed">
                 The following students have missed 3 or more sessions this month. You may want to contact their parents.
               </p>
             </div>
             <div className="flex -space-x-3 overflow-hidden p-1">
               {filtered
                 .filter(s => s.monthlyAbsences > 2)
                 .slice(0, 5)
                 .map(s => (
                   <div key={s.id} className="inline-block h-10 w-10 rounded-xl ring-4 ring-rose-50 overflow-hidden relative" title={`${s.name}: ${s.monthlyAbsences} absences`}>
                     <Image src={s.img || "/noavatar.png"} alt="" fill className="object-cover" />
                   </div>
                 ))}
               {filtered.filter(s => s.monthlyAbsences > 2).length > 5 && (
                 <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-rose-200 text-rose-700 text-[10px] font-black ring-4 ring-rose-50">
                   +{filtered.filter(s => s.monthlyAbsences > 2).length - 5}
                 </div>
               )}
             </div>
           </div>
         </div>
       )}


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

                    {/* Status Buttons (Admin Override) */}
                    <td className="px-4 py-4">
                      <div className={`flex items-center justify-center gap-1.5 p-1 rounded-2xl border transition-all ${canEdit ? 'bg-slate-50 border-indigo-100' : 'bg-slate-50/50 border-slate-50 opacity-60'}`}>
                        {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => (
                          <button
                            key={s}
                            disabled={!canEdit}
                            onClick={() => {
                              setStatuses((prev) => ({ ...prev, [student.id]: prev[student.id] === s ? null : s }));
                              setIsDirty(true);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all duration-150 uppercase tracking-wider ${
                              statuses[student.id] === s
                                ? STATUS_CONFIG[s].color + " shadow-md"
                                : "text-slate-400 hover:text-slate-600 " + (canEdit ? "hover:bg-white" : "")
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

      {/* Lesson Activities Section (Moved to Bottom) */}
      {selectedLesson && selectedLesson !== "ALL" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Tasks Column */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/20 border border-slate-100 overflow-hidden flex flex-col group transition-all hover:shadow-2xl hover:shadow-indigo-100/40">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Lesson Tasks</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignments & Homework</p>
                </div>
              </div>
              <FormModal 
                table="assignment" 
                type="create" 
                data={{ 
                  lessonId: lessons.find(l => l.id === selectedLesson)?.realLessonId || -1,
                  classId: selectedClass
                }}
              />
            </div>
            <div className="p-6 flex-1 max-h-[500px] overflow-y-auto space-y-6">
              {assignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold">No tasks assigned yet.</p>
                </div>
              ) : (
                assignments.map((task) => (
                  <div key={task.id} className="relative bg-white border border-slate-100 rounded-3xl p-6 transition-all hover:border-amber-300 hover:shadow-lg group/item">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-black text-slate-800 mb-1 group-hover/item:text-amber-600 transition-colors">{task.title}</h3>
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                             Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "TBD"}
                           </span>
                        </div>
                      </div>
                    </div>
                    {task.description && (
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed line-clamp-3">{task.description}</p>
                    )}
                    {task.img && (
                      <a 
                        href={task.img} 
                        target="_blank" 
                        rel="noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-amber-500 rounded-2xl text-xs font-black text-slate-600 hover:text-white transition-all border border-slate-100 hover:border-amber-400 group/btn shadow-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        PREVIEW ATTACHMENT
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Resources Column */}
          <div className="bg-white rounded-[2rem] shadow-xl shadow-indigo-100/20 border border-slate-100 overflow-hidden flex flex-col group transition-all hover:shadow-2xl hover:shadow-indigo-100/40">
            <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 tracking-tight">Resources</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Documents & Materials</p>
                </div>
              </div>
              <FormModal 
                table="resource" 
                type="create" 
                data={{ 
                  lessonId: lessons.find(l => l.id === selectedLesson)?.realLessonId || -1,
                  classId: selectedClass
                }}
              />
            </div>
            <div className="p-6 flex-1 max-h-[500px] overflow-y-auto space-y-4">
              {resources.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-300">
                  <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold">No resources shared yet.</p>
                </div>
              ) : (
                resources.map((res) => (
                  <div key={res.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 rounded-[1.5rem] transition-all group/res">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shrink-0 shadow-sm border border-slate-100 group-hover/res:scale-110 transition-transform">
                         <span className="text-xl">📄</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-800 truncate leading-tight mb-0.5">{res.title}</p>
                        <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-tight">
                          {res.description || "Educational Material"}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={res.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center transition-all shadow-sm hover:shadow-md"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  ;
}
