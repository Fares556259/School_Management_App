"use client";

import React, { useState, useTransition, useMemo, useRef, useEffect } from "react";
import { 
  User, CheckCircle2, AlertCircle, Save, FileText, ChevronLeft, 
  ChevronRight, Search, Sparkles, BookOpen, Check, Calculator, 
  GraduationCap, Award, HelpCircle
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
  if (avg === null) return { label: "--", color: "text-slate-400 bg-slate-100 border-slate-200" };
  if (avg >= 16) return { label: "Très Bien", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  if (avg >= 14) return { label: "Bien", color: "text-blue-700 bg-blue-50 border-blue-200" };
  if (avg >= 12) return { label: "Assez Bien", color: "text-sky-700 bg-sky-50 border-sky-200" };
  if (avg >= 10) return { label: "Passable", color: "text-amber-700 bg-amber-50 border-amber-200" };
  return { label: "En Difficulté", color: "text-rose-700 bg-rose-50 border-rose-200" };
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

  const handleSave = async (targetStudentId?: string) => {
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
  };

  // Switch student & auto-save dirty changes if any
  const handleSelectStudent = (newStudentId: string) => {
    if (isDirty && selectedStudentId) {
      handleSave(selectedStudentId);
    }
    setSelectedStudentId(newStudentId);
  };

  const handlePrevStudent = () => {
    if (currentIndex > 0) {
      handleSelectStudent(students[currentIndex - 1].id);
    }
  };

  const handleNextStudent = () => {
    if (currentIndex < students.length - 1) {
      handleSelectStudent(students[currentIndex + 1].id);
    }
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
        // Move to next domain or save & next student
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

    // Group subjects by domain
    const domainMap: Record<string, typeof gradeableSubjects> = {};
    gradeableSubjects.forEach((s) => {
      const d = s.domain || "General";
      if (!domainMap[d]) domainMap[d] = [];
      domainMap[d].push(s);
    });

    const domainAverages: number[] = [];
    let totalPoints = 0;
    let totalMax = 0;

    Object.entries(domainMap).forEach(([domain, domainSubs]) => {
      const scores = domainSubs
        .filter(s => studentGrades[s.id] !== undefined && studentGrades[s.id] !== null)
        .map(s => studentGrades[s.id]);
        
      if (scores.length > 0) {
        domainAverages.push(scores.reduce((a, b) => a + b, 0) / scores.length);
        scores.forEach(sc => {
          totalPoints += sc;
          totalMax += 20;
        });
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
      totalPoints: totalPoints.toFixed(1),
      totalMax
    };
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
      <div className="flex-1 flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
          <GraduationCap size={32} />
        </div>
        <p className="text-slate-700 font-bold text-lg">{t.gradeEntry.noStudents}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ─── LEFT SIDEBAR: STUDENT SELECTOR & SEARCH ─── */}
      <div className="w-full lg:w-80 bg-white rounded-3xl shadow-sm border border-slate-200/80 flex flex-col shrink-0 overflow-hidden">
        {/* Header with Search */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap size={15} className="text-blue-600" />
              {t.gradeEntry.students} ({students.length})
            </span>
            <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              {classCompletionCount}/{students.length} complets
            </span>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="max-h-[calc(100vh-280px)] min-h-[400px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
          {filteredStudents.map((student, idx) => {
            const metrics = getStudentMetrics(student.id);
            const isSelected = selectedStudent?.id === student.id;
            const studentMention = getMentionInfo(metrics.numericAvg);

            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleSelectStudent(student.id)}
                className={`w-full flex items-center justify-between p-2.5 rounded-2xl transition-all text-left group ${
                  isSelected
                    ? "bg-[#0f1d33] text-white shadow-md shadow-slate-900/10 border border-slate-800"
                    : "hover:bg-slate-50 border border-transparent text-slate-700"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar Initials */}
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                    isSelected 
                      ? "bg-white/15 text-white" 
                      : metrics.isComplete 
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {student.name[0]?.toUpperCase()}{student.surname?.[0]?.toUpperCase() || ""}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className={`text-sm font-bold truncate ${isSelected ? "text-white" : "text-slate-800 group-hover:text-blue-600"}`}>
                      {student.name} {student.surname}
                    </span>
                    <span className={`text-[11px] font-medium truncate ${isSelected ? "text-slate-300" : "text-slate-400"}`}>
                      {metrics.isComplete 
                        ? `${metrics.enteredCount} notes saisies ✓` 
                        : `${metrics.enteredCount}/${metrics.totalSubjects} notes`}
                    </span>
                  </div>
                </div>

                {/* Score Pill */}
                <div className={`px-2 py-1 rounded-xl text-xs font-black shrink-0 ${
                  isSelected
                    ? "bg-white/20 text-white"
                    : studentMention.color
                }`}>
                  {metrics.avgDisplay}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── RIGHT MAIN: STUDENT REPORT CARD GRADE SHEET ─── */}
      <div className="flex-1 w-full bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden flex flex-col">
        {selectedStudent ? (
          <>
            {/* Top Workspace Header */}
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50/70 via-white to-blue-50/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              {/* Student Identity */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-blue-500/20 font-black text-xl">
                  {selectedStudent.name[0]?.toUpperCase()}{selectedStudent.surname?.[0]?.toUpperCase() || ""}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black text-slate-900 tracking-tight">
                      {selectedStudent.name} {selectedStudent.surname}
                    </h2>
                    <span className="text-[11px] font-extrabold bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase">
                      Trimestre {term}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-slate-500 mt-0.5">
                    Élève #{currentIndex + 1} sur {students.length} • Saisie des notes officielle
                  </p>
                </div>
              </div>

              {/* Live GPA & Quick Actions */}
              <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                {/* GPA Badge */}
                <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Moyenne Générale</span>
                    <span className="text-xl font-black text-slate-900 leading-none">
                      {currentMetrics?.avgDisplay} <span className="text-xs font-bold text-slate-400">/ 20</span>
                    </span>
                  </div>
                  <div className={`px-2.5 py-1 rounded-xl text-xs font-black border ${mention.color}`}>
                    {mention.label}
                  </div>
                </div>

                {/* View Bulletin PDF Link */}
                <Link
                  href={`/admin/grades/${selectedStudent.id}/report-card?term=${term}`}
                  target="_blank"
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                >
                  <FileText size={14} className="text-blue-600" />
                  <span>{t.gradeEntry.viewReportCard}</span>
                </Link>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={saveStatus === "saving"}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-md ${
                    saveStatus === "success" 
                      ? "bg-emerald-600 text-white shadow-emerald-500/20" 
                      : saveStatus === "error" 
                      ? "bg-rose-600 text-white shadow-rose-500/20" 
                      : isDirty
                      ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 animate-pulse"
                      : "bg-slate-800 text-white hover:bg-slate-900 shadow-slate-900/10"
                  }`}
                >
                  {saveStatus === "saving" ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : saveStatus === "success" ? (
                    <CheckCircle2 size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  <span>
                    {saveStatus === "saving" 
                      ? t.gradeEntry.saving 
                      : saveStatus === "success" 
                      ? t.gradeEntry.saved 
                      : t.gradeEntry.saveGrades}
                  </span>
                </button>
              </div>
            </div>

            {/* Sub-Header / Navigation Controls */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevStudent}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                >
                  <ChevronLeft size={14} />
                  <span>Précédent</span>
                </button>
                <button
                  type="button"
                  onClick={handleNextStudent}
                  disabled={currentIndex === students.length - 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs"
                >
                  <span>Suivant</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="text-xs font-medium text-slate-500 hidden sm:block">
                Astuce : Appuyez sur <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">Entrée</kbd> ou <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-bold text-slate-700 shadow-2xs">Tab</kbd> pour passer à la matière suivante.
              </div>
            </div>

            {/* Domain Groups & Subject Input Matrix */}
            <div className="p-6 overflow-y-auto space-y-8 custom-scrollbar max-h-[calc(100vh-360px)]">
              {domains.map((domain) => {
                const domainSubs = gradeableSubjects.filter(s => (s.domain || "General") === domain);
                if (domainSubs.length === 0) return null;

                return (
                  <div key={domain} className="space-y-3">
                    {/* Domain Header */}
                    <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
                      <div className="w-2 h-4 bg-blue-600 rounded-full" />
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        {domain}
                      </h3>
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {domainSubs.length} matières
                      </span>
                    </div>

                    {/* Subject Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                      {domainSubs.map((subject, sIdx) => {
                        const score = localGrades[selectedStudent.id]?.[subject.id];
                        const arabicTitle = parseArabicName(subject.name);
                        const frenchTitle = parseFrenchName(subject.name);

                        // Score Status Styling
                        const isScoreFilled = score !== undefined && score !== null;
                        const scoreColor = !isScoreFilled 
                          ? "border-slate-200 bg-slate-50/50" 
                          : score >= 16 
                          ? "border-emerald-200 bg-emerald-50/30" 
                          : score >= 10 
                          ? "border-blue-200 bg-blue-50/30" 
                          : "border-rose-200 bg-rose-50/30";

                        return (
                          <div
                            key={subject.id}
                            className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 group hover:bg-white hover:shadow-sm ${scoreColor}`}
                          >
                            {/* Subject Info */}
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-black text-slate-800 tracking-tight truncate" dir="rtl">
                                {arabicTitle}
                              </span>
                              {frenchTitle ? (
                                <span className="text-[11px] font-semibold text-slate-400 truncate">
                                  {frenchTitle}
                                </span>
                              ) : null}
                            </div>

                            {/* Score Input */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="relative">
                                <input
                                  ref={(el) => { inputRefs.current[subject.id] = el; }}
                                  type="number"
                                  min="0"
                                  max="20"
                                  step="0.25"
                                  placeholder="--"
                                  value={score ?? ""}
                                  onChange={(e) => handleScoreChange(selectedStudent.id, subject.id, e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, sIdx, domainSubs)}
                                  className={`w-16 h-10 text-center font-black text-base rounded-xl border outline-none transition-all shadow-2xs ${
                                    isScoreFilled
                                      ? score >= 16
                                        ? "border-emerald-300 text-emerald-800 bg-white focus:ring-2 focus:ring-emerald-500/20"
                                        : score >= 10
                                        ? "border-blue-300 text-blue-800 bg-white focus:ring-2 focus:ring-blue-500/20"
                                        : "border-rose-300 text-rose-800 bg-white focus:ring-2 focus:ring-rose-500/20"
                                      : "border-slate-300 text-slate-700 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                                  }`}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold text-slate-400">/ 20</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Summary Bar */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span>Notes saisies : <strong className="text-slate-800">{currentMetrics?.enteredCount} / {currentMetrics?.totalSubjects}</strong></span>
                <span>•</span>
                <span>Total points : <strong className="text-slate-800">{currentMetrics?.totalPoints} / {currentMetrics?.totalMax}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleNextStudent}
                  disabled={currentIndex === students.length - 1}
                  className="px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <span>Élève suivant</span>
                  <ChevronRight size={14} />
                </button>
              </div>
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
