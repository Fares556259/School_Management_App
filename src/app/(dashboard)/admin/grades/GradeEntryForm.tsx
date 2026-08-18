"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Search, GraduationCap,
  FileText, Save, CheckCircle2, Cloud, Loader2, CloudOff
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
  grades: { subjectId: number; score: number }[];
}

const parseArabicName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

const parseFrenchName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  return parts.length >= 2 ? parts[1].trim() : "";
};

const getMentionLabel = (avg: number | null): string => {
  if (avg === null) return "—";
  if (avg >= 16) return "Très Bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez Bien";
  if (avg >= 10) return "Passable";
  return "En Difficulté";
};

export default function GradeEntryForm({
  students, subjects, term, classId,
}: {
  students: Student[];
  subjects: Subject[];
  term: number;
  classId: number;
}) {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const gradeableSubjects = useMemo(() => getGradeSubjects(subjects), [subjects]);

  const [localGrades, setLocalGrades] = useState<Record<string, Record<number, number>>>(() => {
    const initial: Record<string, Record<number, number>> = {};
    students.forEach(s => {
      initial[s.id] = {};
      s.grades.forEach(g => { initial[s.id][g.subjectId] = g.score; });
    });
    return initial;
  });

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const { t } = useLanguage();
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentIndex = students.findIndex(s => s.id === selectedStudentId);
  const selectedStudent = students[currentIndex] ?? students[0];

  const domains = useMemo(
    () => Array.from(new Set(gradeableSubjects.map(s => s.domain || "General"))),
    [gradeableSubjects]
  );

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s =>
      s.name.toLowerCase().includes(q) || s.surname.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  const handleScoreChange = (studentId: string, subjectId: number, value: string) => {
    if (value === "") {
      setLocalGrades(prev => {
        const obj = { ...prev[studentId] };
        delete obj[subjectId];
        return { ...prev, [studentId]: obj };
      });
    } else {
      let num = parseFloat(value);
      if (isNaN(num)) return;
      num = Math.min(20, Math.max(0, num));
      setLocalGrades(prev => ({ ...prev, [studentId]: { ...prev[studentId], [subjectId]: num } }));
    }
    setSaveStatus("idle");
    setIsDirty(true);
  };

  const handleSave = useCallback(async (targetId?: string) => {
    const id = targetId ?? selectedStudentId;
    if (!id) return;
    setSaveStatus("saving");
    const scores = Object.entries(localGrades[id] || {}).map(([subId, score]) => ({
      subjectId: parseInt(subId), score,
    }));
    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: id, term, scores }),
      });
      if (res.ok) {
        setSaveStatus("success");
        setIsDirty(false);
        setTimeout(() => setSaveStatus("idle"), 2000);
      } else setSaveStatus("error");
    } catch { setSaveStatus("error"); }
  }, [selectedStudentId, localGrades, term]);

  // Auto-save 1.5s after last change
  useEffect(() => {
    if (!isDirty || !selectedStudentId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => handleSave(selectedStudentId), 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  }, [localGrades, isDirty, selectedStudentId, handleSave]);

  const handleSelectStudent = (newId: string) => {
    if (isDirty && selectedStudentId) {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      handleSave(selectedStudentId);
    }
    setIsTransitioning(true);
    setTimeout(() => { setSelectedStudentId(newId); setIsTransitioning(false); }, 100);
  };

  const handlePrev = () => { if (currentIndex > 0) handleSelectStudent(students[currentIndex - 1].id); };
  const handleNext = () => { if (currentIndex < students.length - 1) handleSelectStudent(students[currentIndex + 1].id); };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sIdx: number, domainSubs: Subject[]) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = domainSubs[sIdx + 1];
      if (next && inputRefs.current[next.id]) {
        inputRefs.current[next.id]?.focus();
        inputRefs.current[next.id]?.select();
      } else {
        const flat = gradeableSubjects;
        const flatIdx = flat.findIndex(s => s.id === domainSubs[sIdx].id);
        if (flatIdx < flat.length - 1) {
          const nextSub = flat[flatIdx + 1];
          inputRefs.current[nextSub.id]?.focus();
          inputRefs.current[nextSub.id]?.select();
        } else if (currentIndex < students.length - 1) handleNext();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = domainSubs[sIdx - 1];
      if (prev && inputRefs.current[prev.id]) {
        inputRefs.current[prev.id]?.focus();
        inputRefs.current[prev.id]?.select();
      }
    }
  };

  const getMetrics = (studentId: string) => {
    const g = localGrades[studentId] || {};
    const entered = gradeableSubjects.filter(s => g[s.id] !== undefined).length;
    const isComplete = gradeableSubjects.length > 0 && entered === gradeableSubjects.length;

    // Domain-averaged general average
    const domainMap: Record<string, typeof gradeableSubjects> = {};
    gradeableSubjects.forEach(s => {
      const d = s.domain || "General";
      if (!domainMap[d]) domainMap[d] = [];
      domainMap[d].push(s);
    });
    const domainAvgs = Object.values(domainMap)
      .map(subs => {
        const scores = subs.filter(s => g[s.id] !== undefined).map(s => g[s.id]);
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      })
      .filter((v): v is number => v !== null);

    const avg = domainAvgs.length ? domainAvgs.reduce((a, b) => a + b, 0) / domainAvgs.length : null;
    return { entered, total: gradeableSubjects.length, isComplete, avg, avgDisplay: avg !== null ? avg.toFixed(2) : "—" };
  };

  const currentMetrics = selectedStudent ? getMetrics(selectedStudent.id) : null;
  const completedCount = useMemo(
    () => students.filter(s => getMetrics(s.id).isComplete).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, localGrades, gradeableSubjects]
  );

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200">
        <GraduationCap size={32} className="text-slate-300 mb-3" />
        <p className="text-slate-500 font-semibold">{t.gradeEntry.noStudents}</p>
      </div>
    );
  }

  const saveIcon = saveStatus === "saving" ? <Loader2 size={13} className="animate-spin" />
    : saveStatus === "success" ? <Cloud size={13} />
    : saveStatus === "error" ? <CloudOff size={13} />
    : isDirty ? <Loader2 size={13} className="animate-spin opacity-40" />
    : <Cloud size={13} className="opacity-30" />;

  const saveLabel = saveStatus === "saving" ? "Enregistrement…"
    : saveStatus === "success" ? "Enregistré"
    : saveStatus === "error" ? "Erreur"
    : isDirty ? "En attente…"
    : "Auto-sauvegarde";

  return (
    <div className="flex gap-5 items-start">
      {/* ── SIDEBAR ── */}
      <div className="w-64 shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden sticky top-4">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Élèves
            </span>
            <span className="text-xs font-semibold text-slate-400">
              {completedCount}/{students.length}
            </span>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              placeholder="Rechercher…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all placeholder:text-slate-300 text-slate-700"
            />
          </div>
        </div>

        {/* Student list */}
        <div className="overflow-y-auto max-h-[calc(100vh-240px)] min-h-[320px] p-2 space-y-0.5 custom-scrollbar">
          {filteredStudents.map(student => {
            const m = getMetrics(student.id);
            const isSelected = selectedStudent?.id === student.id;
            return (
              <button
                key={student.id}
                type="button"
                onClick={() => handleSelectStudent(student.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left transition-all ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Completion dot */}
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    m.isComplete ? "bg-emerald-400" : isSelected ? "bg-white/30" : "bg-slate-200"
                  }`} />
                  <div className="min-w-0">
                    <div className={`text-[13px] font-semibold truncate ${isSelected ? "text-white" : "text-slate-800"}`}>
                      {student.name} {student.surname}
                    </div>
                    <div className={`text-[11px] truncate ${isSelected ? "text-white/50" : "text-slate-400"}`}>
                      {m.entered}/{m.total} notes
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-bold shrink-0 ${isSelected ? "text-white/70" : "text-slate-400"}`}>
                  {m.avgDisplay}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── MAIN PANEL ── */}
      <div className="flex-1 min-w-0 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col">
        {selectedStudent ? (
          <>
            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-white border-b border-slate-100">
              <div className="px-6 py-4 flex items-center justify-between gap-4">
                {/* Left: student info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600 shrink-0">
                    {selectedStudent.name[0]?.toUpperCase()}{selectedStudent.surname?.[0]?.toUpperCase() ?? ""}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-slate-900 truncate">
                        {selectedStudent.name} {selectedStudent.surname}
                      </h2>
                      <span className="text-[11px] text-slate-400 font-medium shrink-0">
                        T{term} · {currentIndex + 1}/{students.length}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Moyenne : <span className="font-bold text-slate-700">{currentMetrics?.avgDisplay} / 20</span>
                      {currentMetrics?.avg !== null && currentMetrics?.avg !== undefined && (
                        <span className="ml-1.5 text-slate-400">— {getMentionLabel(currentMetrics.avg)}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Auto-save indicator */}
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                    saveStatus === "success" ? "text-emerald-600 bg-emerald-50"
                    : saveStatus === "error" ? "text-rose-600 bg-rose-50"
                    : "text-slate-400 bg-slate-50"
                  }`}>
                    {saveIcon}
                    <span className="hidden sm:inline">{saveLabel}</span>
                  </div>

                  {/* Bulletin link */}
                  <Link
                    href={`/admin/grades/${selectedStudent.id}/report-card?term=${term}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 transition-all"
                  >
                    <FileText size={13} />
                    <span className="hidden sm:inline">Bulletin</span>
                  </Link>

                  {/* Save button */}
                  <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={!isDirty || saveStatus === "saving"}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      isDirty
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                    }`}
                  >
                    <Save size={13} />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </div>

              {/* Navigation row */}
              <div className="px-6 pb-3 flex items-center gap-2">
                <button onClick={handlePrev} disabled={currentIndex === 0}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                  <ChevronLeft size={13} /> Préc.
                </button>
                <button onClick={handleNext} disabled={currentIndex === students.length - 1}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                  Suiv. <ChevronRight size={13} />
                </button>
                <span className="text-[11px] text-slate-300 ml-1">
                  ↵ pour passer à la matière suivante
                </span>
              </div>
            </div>

            {/* Subject Grid */}
            <div className={`p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1 transition-opacity duration-100 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
              {domains.map(domain => {
                const domainSubs = gradeableSubjects.filter(s => (s.domain || "General") === domain);
                if (!domainSubs.length) return null;

                return (
                  <div key={domain}>
                    {/* Domain separator */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest" dir="rtl">
                        {domain}
                      </span>
                      <div className="flex-1 h-px bg-slate-100" />
                      <span className="text-[11px] text-slate-300">{domainSubs.length} matières</span>
                    </div>

                    {/* 2-column subject grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {domainSubs.map((subject, sIdx) => {
                        const score = localGrades[selectedStudent.id]?.[subject.id];
                        const filled = score !== undefined && score !== null;
                        const arabic = parseArabicName(subject.name);
                        const french = parseFrenchName(subject.name);

                        return (
                          <div
                            key={subject.id}
                            className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-white group"
                          >
                            {/* Subject name */}
                            <div className="min-w-0 flex-1">
                              <div className="text-[14px] font-semibold text-slate-800 leading-snug text-right" dir="rtl">
                                {arabic}
                              </div>
                              {french && (
                                <div className="text-[11px] text-slate-400 mt-0.5">{french}</div>
                              )}
                            </div>

                            {/* Score input */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                ref={el => { inputRefs.current[subject.id] = el; }}
                                type="number"
                                min="0"
                                max="20"
                                step="0.25"
                                placeholder="—"
                                value={score ?? ""}
                                onChange={e => handleScoreChange(selectedStudent.id, subject.id, e.target.value)}
                                onKeyDown={e => handleKeyDown(e, sIdx, domainSubs)}
                                className={`w-16 h-10 text-center font-bold text-base rounded-lg border-2 outline-none transition-all bg-white
                                  ${filled
                                    ? score >= 10
                                      ? "border-slate-300 text-slate-800 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                                      : "border-rose-200 text-rose-700 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10"
                                    : "border-slate-200 text-slate-600 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10"
                                  }`}
                              />
                              <span className="text-xs text-slate-300 font-medium">/ 20</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {currentMetrics?.entered} / {currentMetrics?.total} notes saisies
              </span>
              <button
                onClick={handleNext}
                disabled={currentIndex === students.length - 1}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition-all"
              >
                Élève suivant <ChevronRight size={13} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-slate-400 text-sm">
            {t.gradeEntry.selectStudent}
          </div>
        )}
      </div>
    </div>
  );
}
