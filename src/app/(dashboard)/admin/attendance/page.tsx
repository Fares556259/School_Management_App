"use client";

import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { 
  Check, 
  ChevronDown,
  Edit2,
  FileDown,
  Search,
  AlertTriangle,
  Info,
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  AlertCircle
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

type Status = "PRESENT" | "ABSENT" | "LATE" | null;

interface StudentRow {
  id: string;
  name: string;
  surname: string;
  img: string | null;
  recentAbsences: number;
  absenceHistory?: { date: string; lessonName: string; startTime?: string }[];
  hasRecentNotification?: boolean;
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

const getStatusConfig = (t: any) => ({
  PRESENT: { label: t.attendancePage?.present || "Present", pill: "bg-emerald-50 text-emerald-600 border border-emerald-200/50" },
  LATE:    { label: t.attendancePage?.late || "Late",    pill: "bg-amber-50 text-amber-600 border border-amber-200/50" },
  ABSENT:  { label: t.attendancePage?.absent || "Absent",  pill: "bg-rose-50 text-rose-600 border border-rose-200/50" },
});

export default function AttendancePage() {
  const { t } = useLanguage();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string>("ALL");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [notes, setNotes] = useState<Record<string, { author: string; text: string }[]>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [isEditMode, setIsEditMode] = useState(false);
  const [showAlerts, setShowAlerts] = useState(true);
  const [sendingAlertId, setSendingAlertId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const { data: classesData, isLoading: isClassesLoading } = useQuery({
    queryKey: ["attendanceClasses"],
    queryFn: async () => {
      const res = await fetch("/api/attendance/classes");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  useEffect(() => {
    if (classesData) {
      setClasses(classesData);
      if (classesData.length > 0 && !selectedClass) {
        setSelectedClass(String(classesData[0].id));
      }
    }
  }, [classesData, selectedClass]);

  const { data: studentsData, isLoading: isStudentsLoading, isFetching } = useQuery({
    queryKey: ["attendanceStudents", selectedClass, date, selectedLesson],
    queryFn: async () => {
      if (!selectedClass) return null;
      const res = await fetch(`/api/attendance?classId=${selectedClass}&date=${date}&lessonId=${selectedLesson}`);
      return await res.json();
    },
    enabled: !!selectedClass,
  });

  const resetState = useCallback(() => {
    if (!studentsData) return;
    setIsDirty(false);
    
    const fetchedLessons = studentsData?.lessons || [];
    setLessons(fetchedLessons);

    if (fetchedLessons.length > 0) {
      const firstLessonId = String(fetchedLessons[0].id);
      if (selectedLesson === "ALL" || !fetchedLessons.find((l: any) => String(l.id) === selectedLesson)) {
        if (selectedLesson !== firstLessonId) setSelectedLesson(firstLessonId);
      }
    } else if (selectedLesson !== "") {
      setSelectedLesson("");
    }

    const studentsArray = Array.isArray(studentsData?.students) ? studentsData.students : Array.isArray(studentsData) ? studentsData : [];
    setStudents(studentsArray);

    const initialStatuses: Record<string, Status> = {};
    const initialNotes: Record<string, { author: string; text: string }[]> = {};
    
    studentsArray.forEach((s: any) => {
      initialStatuses[s.id] = (s.attendance[0]?.status as Status) ?? null;
      let parsedNotes: { author: string; text: string }[] = [];
      try {
        if (s.attendance[0]?.note) parsedNotes = JSON.parse(s.attendance[0].note);
      } catch (e) {
        if (s.attendance[0]?.note) parsedNotes = [{ author: "Admin", text: s.attendance[0].note }];
      }
      parsedNotes.push({ author: "Admin", text: "" });
      initialNotes[s.id] = parsedNotes;
    });
    setStatuses(initialStatuses);
    setNotes(initialNotes);
  }, [studentsData, selectedLesson]);

  useEffect(() => {
    // Sync loading state for UI
    setLoading(isStudentsLoading || isFetching);
  }, [isStudentsLoading, isFetching]);

  useEffect(() => {
    resetState();
  }, [resetState]);


  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    const records = students.filter(s => statuses[s.id]).map(s => {
      const studentNotes = (notes[s.id] || []).filter(n => n.text.trim() !== "");
      return { 
        studentId: s.id, 
        status: statuses[s.id]!, 
        note: studentNotes.length > 0 ? JSON.stringify(studentNotes) : null
      };
    });

    try {
      await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ records, date, lessonId: selectedLesson }),
      });
      
      // Invalidate query to ensure fresh data next time
      queryClient.invalidateQueries({ queryKey: ["attendanceStudents", selectedClass, date, selectedLesson] });
      
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 3000);
      setIsEditMode(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const sendDetailedAlert = async (studentId: string, history: any[]) => {
    setSendingAlertId(studentId);
    try {
      await fetch("/api/admin/notifications/absence-alert", {
        method: "POST",
        body: JSON.stringify({ studentId, history }),
        headers: { "Content-Type": "application/json" }
      });
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, hasRecentNotification: true } : s));
    } catch (error) {
      console.error(error);
    } finally {
      setSendingAlertId(null);
    }
  };

  const total = students.length;
  const presentCount = Object.values(statuses).filter(s => s === "PRESENT").length;
  const absentCount = Object.values(statuses).filter(s => s === "ABSENT").length;
  const lateCount = Object.values(statuses).filter(s => s === "LATE").length;

  const filtered = students.filter((s) => {
    const fullName = `${s.name} ${s.surname}`.toLowerCase();
    const matchesSearch = !search || fullName.includes(search.toLowerCase());
    const matchesFilter = filter === "ALL" || statuses[s.id] === filter || (filter === null && !statuses[s.id]);
    return matchesSearch && matchesFilter;
  });

  const highAbsenceStudents = filtered.filter(s => s.recentAbsences > 2);

  return (
    <div className="p-6 flex flex-col gap-8 flex-1 bg-white rounded-[16px] border border-[#dddddd] shadow-sm">
      
      {/* Header Section */}
      <div className="flex flex-col gap-6 w-full mb-2">
        
        {/* Top Row: Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-[10px] bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
              <Users size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-[28px] font-semibold text-[#181d26] leading-none tracking-tight mb-2">{t.attendancePage?.title || "Attendance"}</h1>
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#5a5a5a]">
                <span>{t.attendancePage?.dailyLogs || "Daily Logs"}</span>
                <span className="w-1 h-1 rounded-full bg-[#dddddd]"></span>
                <span className={`flex items-center gap-1.5 ${isEditMode ? 'text-amber-600' : 'text-emerald-600'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isEditMode ? 'bg-amber-600 animate-pulse' : 'bg-emerald-600'}`}></span>
                  {isEditMode ? (t.attendancePage?.editMode || "Edit Mode") : (t.attendancePage?.viewMode || "View Mode")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isEditMode ? (
              <>
                <button 
                  onClick={() => setIsEditMode(true)}
                  className="px-4 py-2.5 rounded-[6px] bg-[#181d26] text-white hover:bg-[#0d1218] border border-transparent font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 shadow-sm"
                >
                  <Edit2 size={14} className="text-white/80" /> {t.attendancePage?.overrideRecords || "Override Records"}
                </button>
                <button 
                  className="flex items-center gap-2 px-4 py-2.5 text-[13px] active:scale-[0.98] font-medium rounded-[6px] transition-all border border-[#dddddd] bg-[#ffffff] text-[#181d26] hover:bg-[#f8fafc] shadow-sm"
                >
                  <FileDown size={14} className="text-[#41454d]" /> {t.attendancePage?.exportPdf || "Export PDF"}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => {
                    setIsEditMode(false);
                    resetState(); // Discard changes
                  }}
                  className="px-4 py-2.5 rounded-[6px] font-medium text-[13px] active:scale-[0.98] transition-all border border-[#dddddd] bg-[#ffffff] text-[#181d26] hover:bg-[#f8fafc] shadow-sm"
                >
                  {t.attendancePage?.cancel || "Cancel"}
                </button>
                <button 
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="px-4 py-2.5 rounded-[6px] font-medium text-[13px] active:scale-[0.98] transition-all flex items-center gap-2 bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (t.attendancePage?.saving || "Saving...") : saved ? (t.attendancePage?.saved || "Saved!") : <><Check size={14} /> {t.attendancePage?.saveChanges || "Save Changes"}</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Filter Bar */}
        <div className="flex flex-wrap items-center bg-[#f8fafc] border border-[#dddddd] rounded-[8px] px-3 py-2 gap-4 w-fit">
          
          {/* Class */}
          <div className="flex items-center gap-3 px-2 border-r border-[#dddddd] pr-6">
            <span className="text-[13px] font-medium text-[#41454d]">{t.attendancePage?.class || "Class"}</span>
            <div className="relative inline-flex items-center">
              <select 
                className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none cursor-pointer pr-5 appearance-none"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
              >
                {classes.map(c => <option key={c.id} value={c.id} className="bg-white">{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none" />
            </div>
          </div>

          {/* Date */}
          <div className="flex items-center gap-3 px-2 border-r border-[#dddddd] pr-6">
            <span className="text-[13px] font-medium text-[#41454d]">{t.attendancePage?.date || "Date"}</span>
            <input 
              type="date" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none"
            />
          </div>

          {/* Session */}
          <div className="flex items-center gap-3 px-2">
            <span className="text-[13px] font-medium text-[#41454d]">{t.attendancePage?.session || "Session"}</span>
            <div className="relative inline-flex items-center">
              <select 
                className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none cursor-pointer pr-5 appearance-none disabled:opacity-50"
                value={selectedLesson}
                onChange={(e) => setSelectedLesson(e.target.value)}
                disabled={lessons.length === 0}
              >
                {lessons.length === 0 && <option value="">{t.attendancePage?.noSessions || "No sessions"}</option>}
                {lessons.map((l) => {
                  const fullName = l.subject?.name || l.name || "";
                  const arabicName = fullName.split("|")[0].trim();
                  const timeStr = l.startTime ? `(${new Date(l.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : "";
                  return (
                    <option key={l.id} value={l.id} className="bg-white">
                      {arabicName} {timeStr}
                    </option>
                  );
                })}
              </select>
              <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none" />
            </div>
          </div>

        </div>
      </div>

      {lessons.length === 0 && !loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-[#f8fafc] border border-[#dddddd] rounded-[12px] mt-2 flex-1">
          <div className="w-16 h-16 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-4 shadow-sm">
            <Clock size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-[20px] font-semibold text-[#181d26] mb-2 tracking-tight">{t.attendancePage?.noClassToday || "No class today"}</h2>
          <p className="text-[13px] text-[#5a5a5a] text-center max-w-[320px] leading-relaxed">
            {t.attendancePage?.noScheduledLessons || "You don't have any scheduled sessions for this class on this date."}
          </p>
        </div>
      ) : (
        <>
          {/* KPI Stats Section with Elegant Colors */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6 mt-2">
            {[
              { title: t.attendancePage?.totalEnrolled || "Total Enrolled", value: total, icon: <Users size={16} />, iconBg: "bg-slate-100 text-slate-600" },
              { title: t.attendancePage?.present || "Present", value: presentCount, color: "text-emerald-700 bg-emerald-50", icon: <CheckCircle2 size={16} />, iconBg: "bg-emerald-100 text-emerald-600 border border-emerald-200/50" },
              { title: t.attendancePage?.late || "Late", value: lateCount, color: "text-amber-700 bg-amber-50", icon: <Clock size={16} />, iconBg: "bg-amber-100 text-amber-600 border border-amber-200/50" },
              { title: t.attendancePage?.absent || "Absent", value: absentCount, color: "text-rose-700 bg-rose-50", icon: <AlertCircle size={16} />, iconBg: "bg-rose-100 text-rose-600 border border-rose-200/50" },
            ].map((stat, i) => (
              <div key={i} className="bg-[#ffffff] p-5 rounded-[12px] border border-[#dddddd] shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[13px] font-medium text-[#5a5a5a] group-hover:text-[#181d26] transition-colors">{stat.title}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${stat.iconBg}`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="flex items-end justify-between">
                  <h3 className="text-[32px] font-semibold text-[#181d26] leading-none tracking-tight">{stat.value}</h3>
                  {stat.color && (
                    <div className={`px-2.5 py-1 rounded-[6px] text-[12px] font-semibold ${stat.color}`}>
                      {Math.round((stat.value / (total || 1)) * 100)}%
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* High Absence Alerts */}
          {showAlerts && highAbsenceStudents.length > 0 && (
            <div className="bg-rose-50 border border-rose-200 rounded-[8px] overflow-hidden">
              <div className="px-5 py-3 border-b border-rose-200 flex items-center justify-between">
                <div className="flex items-center gap-2 text-rose-800">
                  <AlertTriangle size={16} />
                  <h3 className="text-[13px] font-semibold">{t.attendancePage?.interventionRequired || "Intervention Required"}</h3>
                  <span className="text-[13px] font-medium opacity-80">
                    {(t.attendancePage?.absencesWarning || "— {count} students have 3+ absences").replace('{count}', highAbsenceStudents.length.toString())}
                  </span>
                </div>
                <button onClick={() => setShowAlerts(false)} className="text-[11px] font-medium text-rose-600 hover:text-rose-800 uppercase tracking-wider">
                  {t.attendancePage?.dismiss || "Dismiss"}
                </button>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {highAbsenceStudents.map(s => (
                  <div key={s.id} className="bg-white border border-rose-100 rounded-[6px] p-3 flex justify-between items-center shadow-sm">
                    <div>
                      <p className="text-[13px] font-semibold text-[#181d26]">{s.name} {s.surname}</p>
                      <p className="text-[12px] text-[#5a5a5a]">{s.parent?.name} ({s.parent?.phone})</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[12px] font-semibold text-rose-600">{s.recentAbsences} {t.attendancePage?.absences || "Absences (Past 7 Days)"}</span>
                      <button
                        disabled={sendingAlertId === s.id || s.hasRecentNotification}
                        onClick={() => sendDetailedAlert(s.id, s.absenceHistory || [])}
                        className="bg-[#ffffff] border border-[#dddddd] hover:bg-[#f8fafc] text-[#181d26] px-3 py-1.5 rounded-[4px] text-[11px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingAlertId === s.id ? (t.attendancePage?.sending || "Sending...") : (s.hasRecentNotification ? "Notified" : (t.attendancePage?.notify || "Notify"))}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Table Area */}
          <div className="flex flex-col gap-4">
            {/* Sub-filters & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="relative max-w-sm w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9297a0]" />
                <input
                  type="text"
                  placeholder={t.attendancePage?.searchStudent || "Search student..."}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#ffffff] border border-[#dddddd] rounded-[6px] text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#181d26] transition-colors"
                />
              </div>
              <div className="flex items-center bg-[#f8fafc] border border-[#dddddd] rounded-[6px] p-1 gap-1">
                {(["ALL", "PRESENT", "LATE", "ABSENT"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 rounded-[4px] text-[12px] font-medium transition-all ${
                      filter === f 
                        ? "bg-[#ffffff] text-[#181d26] shadow-sm border border-[#dddddd]" 
                        : "text-[#5a5a5a] hover:text-[#181d26] border border-transparent"
                    }`}
                  >
                    {f === "ALL" ? (t.attendancePage?.all || "All") : getStatusConfig(t)[f].label}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Table */}
            <div className="bg-[#ffffff] border border-[#dddddd] rounded-[8px] overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#dddddd] bg-[#f8fafc]">
                    <th className="px-4 py-3 text-[12px] font-medium text-[#41454d] w-[30%]">{t.attendancePage?.student || "Student"}</th>
                    <th className="px-4 py-3 text-[12px] font-medium text-[#41454d] w-[30%]">{t.attendancePage?.status || "Status"}</th>
                    <th className="px-4 py-3 text-[12px] font-medium text-[#41454d]">{t.attendancePage?.notes || "Notes"}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-[13px] text-[#9297a0]">
                        {t.attendancePage?.loadingRecords || "Loading records..."}
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-[13px] text-[#9297a0]">
                        {t.attendancePage?.noStudentsFound || "No students found."}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((student) => {
                      const status = statuses[student.id];
                      const config = status ? getStatusConfig(t)[status] : null;

                      return (
                        <tr key={student.id} className="border-b border-[#f0f0f0] last:border-none hover:bg-[#fafafa]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#dddddd] bg-slate-100 relative">
                                <Image src={student.img || "/noavatar.png"} alt="" fill className="object-cover" />
                              </div>
                              <div>
                                <p className="text-[13px] font-medium text-[#181d26]">{student.name} {student.surname}</p>
                                <p className="text-[11px] text-[#9297a0]">ID: {student.id.slice(-6)}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isEditMode ? (
                              <div className="flex items-center gap-1.5">
                                {(["PRESENT", "LATE", "ABSENT"] as const).map((s) => {
                                  const isSelected = statuses[student.id] === s;
                                  return (
                                    <button
                                      key={s}
                                      onClick={() => {
                                        setStatuses(prev => ({ ...prev, [student.id]: prev[student.id] === s ? null : s }));
                                        setIsDirty(true);
                                      }}
                                      className={`px-3 py-1.5 rounded-[4px] text-[11px] font-medium transition-all border ${
                                        isSelected 
                                          ? getStatusConfig(t)[s].pill
                                          : "bg-[#ffffff] text-[#5a5a5a] border-[#dddddd] hover:bg-[#f8fafc]"
                                      }`}
                                    >
                                      {getStatusConfig(t)[s].label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              config ? (
                                <span className={`inline-block px-2.5 py-1 rounded-[4px] text-[11px] font-medium ${config.pill}`}>
                                  {config.label}
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-1 rounded-[4px] text-[11px] font-medium bg-[#f8fafc] text-[#9297a0] border border-[#dddddd]">
                                  {t.attendancePage?.unmarked || "Unmarked"}
                                </span>
                              )
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditMode ? (
                              <input
                                type="text"
                                placeholder={t.attendancePage?.addRemark || "Add remark..."}
                                value={notes[student.id]?.[0]?.text || ""}
                                onChange={(e) => {
                                  const newNotes = [{ author: "Admin", text: e.target.value }];
                                  setNotes(prev => ({ ...prev, [student.id]: newNotes }));
                                  setIsDirty(true);
                                }}
                                className="w-full bg-[#ffffff] border border-[#dddddd] rounded-[4px] px-3 py-1.5 text-[12px] font-medium text-[#181d26] focus:outline-none focus:border-[#181d26] transition-colors"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5 text-[#5a5a5a] text-[12px]">
                                {notes[student.id]?.some(n => n.text.trim()) ? (
                                  <><Info size={14} className="text-[#9297a0] shrink-0" /> {notes[student.id].filter(n => n.text.trim()).map(n => n.text).join(", ")}</>
                                ) : (
                                  <span className="text-[#9297a0">—</span>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
    </div>
  );
}
