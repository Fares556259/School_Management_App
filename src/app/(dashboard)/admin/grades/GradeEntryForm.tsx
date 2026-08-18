"use client";

import React, { useState, useTransition, useMemo, useRef, useEffect, useCallback } from "react";
import { 
  User, CheckCircle2, AlertCircle, Save, FileText, ChevronLeft, 
  ChevronRight, Search, BookOpen, Check, GraduationCap, Cloud,
  CloudOff, Loader2, Award, TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { getGradeSubjects } from "@/lib/subject-utils";

interface Subject {
  id: number;
  name: string;
  domain: string;
  parentId: number | null;
}

interface Student {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  grades: {
    subjectId: number;
    score: number;
  }[];
}

/** Parse the Arabic segment of a pipe-separated trilingual subject name */
const parseArabicName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

/** Parse the French or secondary segment of a pipe-separated subject name */
const parseFrenchName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  if (parts.length >= 2) return parts[1].trim();
  return "";
};

/** Get mention / appreciation based on average */
const getMentionInfo = (avg: number | null) => {
  if (avg === null) return { label: "--", color: "text-slate-400 bg-slate-100 border-slate-200", dot: "bg-slate-300" };
  if (avg >= 16) return { label: "Très Bien", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" };
  if (avg >= 14) return { label: "Bien", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500" };
  if (avg >= 12) return { label: "Assez Bien", color: "text-sky-700 bg-sky-50 border-sky-200", dot: "bg-sky-500" };
  if (avg >= 10) return { label: "Passable", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" };
  return { label: "En Difficulté", color: "text-rose-700 bg-rose-50 border-rose-200", dot: "bg-rose-500" };
};

/** Color for a numeric score */
const getScoreColor = (score: number | undefined) => {
  if (score === undefined || score === null) return { card: "border-slate-200 bg-white", input: "border-slate-200 text-slate-700 focus:ring-blue-500/20 focus:border-blue-400" };
  if (score >= 16) return { card: "border-emerald-200 bg-emerald-50/40", input: "border-emerald-300 text-emerald-800 focus:ring-emerald-500/20" };
  if (score >= 10) return { card: "border-blue-200 bg-blue-50/40", input: "border-blue-300 text-blue-800 focus:ring-blue-500/20" };
  return { card: "border-rose-200 bg-rose-50/40", input: "border-rose-300 text-rose-800 focus:ring-rose-500/20" };
};

export default function GradeEntryForm({
  students,
  subjects,
  term,
  classId,
}: {
  students: Student[];
  subjects: Subject[];
  term: number;
  classId: number;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(
    students[0]?.id || null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Transform full subject list into gradeable targets
  const gradeableSubjects = useMemo(() => getGradeSubjects(subjects), [subjects]);

  const [localGrades, setLocalGrades] = useState<Record<string, Record<number, number>>>(() => {
    const initial: Record<string, Record<number, number>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      s.grades.forEach(g => {
        initial[s.id][g.subjectId] = g.score;
      });
    });
    return initial;
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const { t, locale } = useLanguage();
  const isRTL = locale === "ar";
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = students.findIndex(s => s.id === selectedStudentId);
  const selectedStudent = students[currentIndex] || students[0];

  // Group subjects by domain
  const domains = useMemo(() => Array.from(new Set(gradeableSubjects.map(s => s.domain || "General"))), [gradeableSubjects]);

  // Filter students by search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.surname.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const handleScoreChange = (studentId: string, subjectId: number, value: string) => {
    if (value === "") {
      setLocalGrades(prev => {
        const studentObj = { ...prev[studentId] };
        delete studentObj[subjectId];
        return { ...prev, [studentId]: studentObj };
      });
      setIsDirty(true);
      setSaveStatus("idle");
      return;
    }

    let num = parseFloat(value);
    if (isNaN(num)) return;
    if (num < 0) num = 0;
    if (num > 20) num = 20;

    setLocalGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [subjectId]: num
      }
    }));
    setSaveStatus("idle");
    setIsDirty(true);
  };

  const handleSave = useCallback(async (targetStudentId?: string) => {
    const idToSave = targetStudentId || selectedStudentId;
    if (!idToSave) return;

    setSaveStatus("saving");
    const scores = Object.entries(localGrades[idToSave] || {}).map(([subId, score]) => ({
      subjectId: parseInt(subId),
      score,
    }));

    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: idToSave,
          term,
          scores,
        }),
      });

      if (res.ok) {
        setSaveStatus("success");
        setIsDirty(false);
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    } catch (error) {
      setSaveStatus("error");
    }
  }, [selectedStudentId, localGrades, term]);

  // Auto-save 1.5s after last change
  useEffect(() => {
    if (!isDirty || !selectedStudentId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      handleSave(selectedStudentId);
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [localGrades, isDirty, selectedStudentId, handleSave]);

  // Switch student & auto-save dirty changes if any
  const handleSelectStudent = (newStudentId: string) => {
    if (isDirty && selectedStudentId) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      handleSave(selectedStudentId);
    }
    setIsTransitioning(true);
    setTimeout(() => {
      setSelectedStudentId(newStudentId);
      setIsTransitioning(false);
    }, 120);
  };

  const handlePrevStudent = () => {
    if (currentIndex > 0) handleSelectStudent(students[currentIndex - 1].id);
  };

  const handleNextStudent = () => {
    if (currentIndex < students.length - 1) handleSelectStudent(students[currentIndex + 1].id);
  };

  // Keyboard navigation for fast entry
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, subjectIndex: number, domainSubjects: Subject[]) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextSub = domainSubjects[subjectIndex + 1];
      if (nextSub && inputRefs.current[nextSub.id]) {
        inputRefs.current[nextSub.id]?.focus();
        inputRefs.current[nextSub.id]?.select();
      } else {
        const allFlattened = gradeableSubjects;
        const currentFlatIdx = allFlattened.findIndex(s => s.id === domainSubjects[subjectIndex].id);
        if (currentFlatIdx >= 0 && currentFlatIdx < allFlattened.length - 1) {
          const nextFlatSub = allFlattened[currentFlatIdx + 1];
          inputRefs.current[nextFlatSub.id]?.focus();
          inputRefs.current[nextFlatSub.id]?.select();
        } else if (currentIndex < students.length - 1) {
          handleNextStudent();
        }
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prevSub = domainSubjects[subjectIndex - 1];
      if (prevSub && inputRefs.current[prevSub.id]) {
        inputRefs.current[prevSub.id]?.focus();
        inputRefs.current[prevSub.id]?.select();
      }
    }
  };

  // Calculate Average & Completion metrics
  const getStudentMetrics = (studentId: string) => {
    const studentGrades = localGrades[studentId] || {};
    const enteredCount = Object.keys(studentGrades).filter(
      id => studentGrades[parseInt(id)] !== undefined && studentGrades[parseInt(id)] !== null
    ).length;

    const isComplete = gradeableSubjects.length > 0 && enteredCount === gradeableSubjects.length;

    const domainMap: Record<string, typeof gradeableSubjects> = {};
    gradeableSubjects.forEach((s) => {
      const d = s.domain || "General";
      if (!domainMap[d]) domainMap[d] = [];
      domainMap[d].push(s);
    });

    const domainAverages: number[] = [];

    Object.entries(domainMap).forEach(([, domainSubs]) => {
      const scores = domainSubs
        .filter(s => studentGrades[s.id] !== undefined && studentGrades[s.id] !== null)
        .map(s => studentGrades[s.id]);

      if (scores.length > 0) {
        domainAverages.push(scores.reduce((a, b) => a + b, 0) / scores.length);
      }
    });

    const numericAvg = domainAverages.length > 0
      ? domainAverages.reduce((a, b) => a + b, 0) / domainAverages.length
      : null;

    return {
      enteredCount,
      totalSubjects: gradeableSubjects.length,
      isComplete,
      numericAvg,
      avgDisplay: numericAvg !== null ? numericAvg.toFixed(2) : "--",
      completionPct: gradeableSubjects.length > 0 ? Math.round((enteredCount / gradeableSubjects.length) * 100) : 0,
    };
  };

  /** Compute domain-level average for selected student */
  const getDomainAvg = (domainSubs: Subject[], studentId: string): number | null => {
    const studentGrades = localGrades[studentId] || {};
    const scores = domainSubs
      .filter(s => studentGrades[s.id] !== undefined && studentGrades[s.id] !== null)
      .map(s => studentGrades[s.id]);
    if (scores.length === 0) return null;
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  };

  const currentMetrics = selectedStudent ? getStudentMetrics(selectedStudent.id) : null;
  const mention = getMentionInfo(currentMetrics?.numericAvg ?? null);

  // Overall class completion counter
  const classCompletionCount = useMemo(() => {
    return students.filter(s => {
      const g = localGrades[s.id] || {};
      return Object.keys(g).length === gradeableSubjects.length;
    }).length;
  }, [students, localGrades, gradeableSubjects]);

  if (students.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mb-5 text-blue-500">
          <GraduationCap size={36} />
        </div>
        <p className="text-slate-800 font-black text-lg mb-1">{t.gradeEntry.noStudents}</p>
        <p className="text-slate-400 text-sm font-medium">Aucun élève inscrit dans cette classe.</p>
      </div>
    );
  }

  // Auto-save cloud icon
  const SaveIcon = () => {
    if (saveStatus === "saving") return <Loader2 size={15} className="animate-spin text-blue-500" />;
    if (saveStatus === "success") return <Cloud size={15} className="text-emerald-500" />;
    if (saveStatus === "error") return <CloudOff size={15} className="text-rose-500" />;
    if (isDirty) return <Loader2 size={15} className="animate-spin text-slate-400" />;
    return <Cloud size={15} className="text-slate-400" />;
  };

  const saveLabel = saveStatus === "saving" ? "Enregistrement…"
    : saveStatus === "success" ? "Notes enregistrées"
    : saveStatus === "error" ? "Erreur d'enregistrement"
    : isDirty ? "En attente…"
    : "Sauvegarde auto";

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">
      {/* ─── LEFT SIDEBAR: STUDENT SELECTOR & SEARCH ─── */}
      <div className="w-full lg:w-72 xl:w-80 bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col shrink-0 overflow-hidden sticky top-4">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={14} className="text-blue-600" />
              {t.gradeEntry.students}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              classCompletionCount === students.length
                ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                : "text-slate-500 bg-slate-50 border-slate-200"
            }`}>
              {classCompletionCount}/{students.length}
            </span>
          </div>

          {/* Class progress bar */}
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${students.length > 0 ? (classCompletionCount / students.length) * 100 : 0}%` }}
            />
          </div>

          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un élève…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="max-h-[calc(100vh-260px)] min-h-[360px] overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {filteredStudents.map((student) => {
            const metrics = getStudentMetrics(student.id);
            const isSelected = selectedStudent?.id === student.id;
            const studentMention = getMentionInfo(metrics.numericAvg);

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleSelectStudent(student.id)}
                className={`w-full flex flex-col p-3 rounded-2xl transition-all text-left group ${
                  isSelected
                    ? "bg-[#0f1d33] text-white shadow-md shadow-slate-900/10"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-[11px] shrink-0 ${
                      isSelected
                        ? "bg-white/15 text-white"
                        : metrics.isComplete
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {student.name[0]?.toUpperCase()}{student.surname?.[0]?.toUpperCase() || ""}
                    </div>
                    <div className="min-w-0">
                      <span className={`text-[13px] font-bold block truncate ${isSelected ? "text-white" : "text-slate-800 group-hover:text-blue-600"}`}>
                        {student.name} {student.surname}
                      </span>
                      <span className={`text-[11px] font-medium truncate block ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                        {metrics.enteredCount}/{metrics.totalSubjects} notes
                      </span>
                    </div>
                  </div>
                  {/* Score pill */}
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg shrink-0 border ${
                    isSelected ? "bg-white/15 text-white border-white/20" : studentMention.color
                  }`}>
                    {metrics.avgDisplay}
                  </span>
                </div>

                {/* Per-student progress bar */}
                <div className={`h-1 rounded-full overflow-hidden ${isSelected ? "bg-white/20" : "bg-slate-100"}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isSelected
                        ? metrics.isComplete ? "bg-emerald-400" : "bg-blue-400"
                        : metrics.isComplete ? "bg-emerald-400" : "bg-blue-400"
                    }`}
                    style={{ width: `${metrics.completionPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── RIGHT MAIN: GRADE SHEET ─── */}
      <div className="flex-1 w-full min-w-0 bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
        {selectedStudent ? (
          <>
            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100 shadow-sm">
              {/* Student Identity Row */}
              <div className="px-6 pt-5 pb-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 font-black text-lg shrink-0">
                    {selectedStudent.name[0]?.toUpperCase()}{selectedStudent.surname?.[0]?.toUpperCase() || ""}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight">
                        {selectedStudent.name} {selectedStudent.surname}
                      </h2>
                      <span className="text-[10px] font-extrabold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100 uppercase">
                        Trimestre {term}
                      </span>
                      {currentMetrics?.isComplete && (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100 flex items-center gap-1">
                          <Check size={10} /> Complet
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      Élève {currentIndex + 1} / {students.length}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
                  {/* GPA display */}
                  <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border ${mention.color}`}>
                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">Moyenne</div>
                      <div className="text-xl font-black leading-none">
                        {currentMetrics?.avgDisplay}
                        <span className="text-xs font-bold opacity-60 ml-0.5">/ 20</span>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-current opacity-20" />
                    <span className="text-xs font-black">{mention.label}</span>
                  </div>

                  {/* Auto-save indicator */}
                  <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    saveStatus === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : saveStatus === "error" ? "bg-rose-50 border-rose-200 text-rose-700"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}>
                    <SaveIcon />
                    <span className="hidden sm:inline">{saveLabel}</span>
                  </div>

                  {/* Bulletin link */}
                  <Link
                    href={`/admin/grades/${selectedStudent.id}/report-card?term=${term}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                  >
                    <FileText size={13} className="text-blue-600" />
                    <span className="hidden sm:inline">{t.gradeEntry.viewReportCard}</span>
                  </Link>

                  {/* Manual save button */}
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={saveStatus === "saving" || !isDirty}
                    className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs transition-all shadow-sm ${
                      isDirty
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    <Save size={13} />
                    <span>{t.gradeEntry.saveGrades}</span>
                  </button>
                </div>
              </div>

              {/* Navigation & Keyboard Tip Row */}
              <div className="px-6 pb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevStudent}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={13} />
                    <span>Préc.</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleNextStudent}
                    disabled={currentIndex === students.length - 1}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <span>Suiv.</span>
                    <ChevronRight size={13} />
                  </button>

                  {/* Progress */}
                  <div className="flex items-center gap-2 ml-2">
                    <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${currentMetrics?.completionPct ?? 0}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-400">
                      {currentMetrics?.enteredCount}/{currentMetrics?.totalSubjects}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-400 hidden sm:flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-bold text-slate-600 shadow-sm">↵</kbd>
                  <span>matière suiv.</span>
                </div>
              </div>
            </div>

            {/* ── Domain Groups & Subject Input Matrix ── */}
            <div
              className={`p-6 overflow-y-auto space-y-6 custom-scrollbar flex-1 transition-opacity duration-150 ${
                isTransitioning ? "opacity-0" : "opacity-100"
              }`}
            >
              {domains.map((domain) => {
                const domainSubs = gradeableSubjects.filter(s => (s.domain || "General") === domain);
                if (domainSubs.length === 0) return null;

                const domainAvg = selectedStudent ? getDomainAvg(domainSubs, selectedStudent.id) : null;
                const domainMention = getMentionInfo(domainAvg);

                return (
                  <div key={domain} className="space-y-3">
                    {/* Domain Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-1 h-6 bg-blue-600 rounded-full" />
                        <div>
                          <h3 className="text-sm font-black text-slate-800 tracking-tight leading-tight" dir="rtl">
                            {domain}
                          </h3>
                          <span className="text-[11px] font-semibold text-slate-400">
                            {domainSubs.length} matière{domainSubs.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      {/* Domain live average */}
                      {domainAvg !== null && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border ${domainMention.color}`}>
                          <TrendingUp size={11} />
                          Moy. {domainAvg.toFixed(2)} / 20
                        </div>
                      )}
                    </div>

                    {/* Subject Cards — 2-column grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {domainSubs.map((subject, sIdx) => {
                        const score = localGrades[selectedStudent.id]?.[subject.id];
                        const arabicTitle = parseArabicName(subject.name);
                        const frenchTitle = parseFrenchName(subject.name);
                        const colors = getScoreColor(score);
                        const isScoreFilled = score !== undefined && score !== null;

                        return (
                          <div
                            key={subject.id}
                            className={`px-4 py-3.5 rounded-2xl border transition-all flex items-center justify-between gap-4 group hover:shadow-sm ${colors.card}`}
                          >
                            {/* Subject Info */}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-[15px] font-black text-slate-800 tracking-tight leading-snug" dir="rtl">
                                {arabicTitle}
                              </span>
                              {frenchTitle && (
                                <span className="text-[11px] font-semibold text-slate-400 mt-0.5">
                                  {frenchTitle}
                                </span>
                              )}
                            </div>

                            {/* Score Input */}
                            <div className="flex items-center gap-2 shrink-0">
                              <input
                                ref={(el) => { inputRefs.current[subject.id] = el; }}
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                placeholder="—"
                                value={score ?? ""}
                                onChange={(e) => handleScoreChange(selectedStudent.id, subject.id, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, sIdx, domainSubs)}
                                className={`w-20 h-11 text-center font-black text-lg rounded-xl border-2 outline-none transition-all focus:ring-2 bg-white ${colors.input}`}
                              />
                              <span className="text-xs font-bold text-slate-400 leading-none">/&nbsp;20</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Bottom Bar ── */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-between items-center gap-3">
              <span className="text-xs font-semibold text-slate-400">
                <strong className="text-slate-700">{currentMetrics?.enteredCount}</strong> / {currentMetrics?.totalSubjects} notes saisies
              </span>
              <button
                type="button"
                onClick={handleNextStudent}
                disabled={currentIndex === students.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all shadow-sm"
              >
                <span>Élève suivant</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-slate-400 font-bold">
            {t.gradeEntry.selectStudent}
          </div>
        )}
      </div>
    </div>
  );
}
