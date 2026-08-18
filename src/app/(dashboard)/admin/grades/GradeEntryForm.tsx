"use client";

import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Search, GraduationCap,
  FileText, Save, CheckCircle2, Loader2, AlertCircle,
  LayoutGrid, User, ArrowDown, ArrowUp, Table as TableIcon,
  TrendingUp, Printer
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

const getMentionColor = (avg: number | null): string => {
  if (avg === null) return "text-slate-400";
  if (avg >= 16) return "text-emerald-600 font-bold";
  if (avg >= 14) return "text-blue-600 font-bold";
  if (avg >= 12) return "text-sky-600 font-bold";
  if (avg >= 10) return "text-amber-600 font-bold";
  return "text-rose-600 font-bold";
};

export default function GradeEntryForm({
  students, subjects, term, classId,
}: {
  students: Student[];
  subjects: Subject[];
  term: number;
  classId: number;
}) {
  const [viewMode, setViewMode] = useState<"table" | "student">("table");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(students[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const gradeableSubjects = useMemo(() => {
    const DOMAIN_PRIORITY: Record<string, number> = {
      "مجال العربية": 1,
      "اللغة العربية": 1,
      "اللغة الفرنسية": 2,
      "French": 2,
      "اللغات الأجنبية": 3,
      "اللغات الاجنية": 3,
      "مجال اللغات": 3,
      "مجال العلوم": 4,
      "مجال التنشئة": 5,
    };
    const raw = getGradeSubjects(subjects);
    return raw.sort((a, b) => {
      const pA = DOMAIN_PRIORITY[a.domain || "General"] ?? 90;
      const pB = DOMAIN_PRIORITY[b.domain || "General"] ?? 90;
      if (pA !== pB) return pA - pB;
      return a.id - b.id;
    });
  }, [subjects]);

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

  // 2D Ref grid for keyboard spreadsheet navigation: gridRefs[studentIdx][subjectIdx]
  const tableInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const cardInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const currentIndex = students.findIndex(s => s.id === selectedStudentId);
  const selectedStudent = students[currentIndex] ?? students[0];

  // Group subjects by domain with official ordering
  const domains = useMemo(() => {
    const DOMAIN_PRIORITY: Record<string, number> = {
      "مجال العربية": 1,
      "اللغة العربية": 1,
      "اللغة الفرنسية": 2,
      "French": 2,
      "اللغات الأجنبية": 3,
      "اللغات الاجنية": 3,
      "مجال اللغات": 3,
      "مجال العلوم": 4,
      "مجال التنشئة": 5,
    };
    const unique = Array.from(new Set(gradeableSubjects.map(s => s.domain || "General")));
    return unique.sort((a, b) => {
      const pA = DOMAIN_PRIORITY[a] ?? 90;
      const pB = DOMAIN_PRIORITY[b] ?? 90;
      return pA - pB;
    });
  }, [gradeableSubjects]);

  const domainMap = useMemo(() => {
    const map: Record<string, Subject[]> = {};
    gradeableSubjects.forEach(s => {
      const d = s.domain || "General";
      if (!map[d]) map[d] = [];
      map[d].push(s);
    });
    return map;
  }, [gradeableSubjects]);

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

  // Save all modified grades to server
  const handleSave = useCallback(async () => {
    setSaveStatus("saving");
    try {
      const savePromises = students.map(s => {
        const scores = Object.entries(localGrades[s.id] || {}).map(([subId, score]) => ({
          subjectId: parseInt(subId), score,
        }));
        return fetch("/api/grades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId: s.id, term, scores }),
        });
      });

      const responses = await Promise.all(savePromises);
      const allOk = responses.every(r => r.ok);

      if (allOk) {
        setSaveStatus("success");
        setIsDirty(false);
        setTimeout(() => setSaveStatus("idle"), 2500);
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [students, localGrades, term]);

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleSave]);

  const handleSelectStudent = (newId: string) => {
    setIsTransitioning(true);
    setTimeout(() => { setSelectedStudentId(newId); setIsTransitioning(false); }, 100);
  };

  const handlePrev = () => { if (currentIndex > 0) handleSelectStudent(students[currentIndex - 1].id); };
  const handleNext = () => { if (currentIndex < students.length - 1) handleSelectStudent(students[currentIndex + 1].id); };

  // Spreadsheet keyboard navigation (Arrow keys, Enter)
  const handleTableKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    studentIdx: number,
    subjectIdx: number
  ) => {
    const totalStudents = filteredStudents.length;
    const totalSubjects = gradeableSubjects.length;

    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (studentIdx < totalStudents - 1) {
        const nextInput = tableInputRefs.current[`${studentIdx + 1}-${subjectIdx}`];
        nextInput?.focus();
        nextInput?.select();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (studentIdx > 0) {
        const prevInput = tableInputRefs.current[`${studentIdx - 1}-${subjectIdx}`];
        prevInput?.focus();
        prevInput?.select();
      }
    } else if (e.key === "ArrowRight") {
      if (e.currentTarget.selectionStart === e.currentTarget.value.length) {
        if (subjectIdx < totalSubjects - 1) {
          e.preventDefault();
          const nextInput = tableInputRefs.current[`${studentIdx}-${subjectIdx + 1}`];
          nextInput?.focus();
          nextInput?.select();
        }
      }
    } else if (e.key === "ArrowLeft") {
      if (e.currentTarget.selectionStart === 0) {
        if (subjectIdx > 0) {
          e.preventDefault();
          const prevInput = tableInputRefs.current[`${studentIdx}-${subjectIdx - 1}`];
          prevInput?.focus();
          prevInput?.select();
        }
      }
    }
  };

  // Card view keyboard navigation
  const handleCardKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, sIdx: number, domainSubs: Subject[]) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = domainSubs[sIdx + 1];
      if (next && cardInputRefs.current[next.id]) {
        cardInputRefs.current[next.id]?.focus();
        cardInputRefs.current[next.id]?.select();
      } else {
        const flat = gradeableSubjects;
        const flatIdx = flat.findIndex(s => s.id === domainSubs[sIdx].id);
        if (flatIdx < flat.length - 1) {
          const nextSub = flat[flatIdx + 1];
          cardInputRefs.current[nextSub.id]?.focus();
          cardInputRefs.current[nextSub.id]?.select();
        } else if (currentIndex < students.length - 1) handleNext();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = domainSubs[sIdx - 1];
      if (prev && cardInputRefs.current[prev.id]) {
        cardInputRefs.current[prev.id]?.focus();
        cardInputRefs.current[prev.id]?.select();
      }
    }
  };

  // Calculate metrics per student
  const getMetrics = (studentId: string) => {
    const g = localGrades[studentId] || {};
    const entered = gradeableSubjects.filter(s => g[s.id] !== undefined).length;
    const isComplete = gradeableSubjects.length > 0 && entered === gradeableSubjects.length;

    const domainAvgs = Object.values(domainMap)
      .map(subs => {
        const scores = subs.filter(s => g[s.id] !== undefined).map(s => g[s.id]);
        return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      })
      .filter((v): v is number => v !== null);

    const avg = domainAvgs.length ? domainAvgs.reduce((a, b) => a + b, 0) / domainAvgs.length : null;
    return { entered, total: gradeableSubjects.length, isComplete, avg, avgDisplay: avg !== null ? avg.toFixed(2) : "—" };
  };

  // Compute subject average across the entire class
  const getSubjectClassAvg = (subjectId: number): string => {
    const scores = students
      .map(s => localGrades[s.id]?.[subjectId])
      .filter((sc): sc is number => sc !== undefined && sc !== null);
    if (scores.length === 0) return "—";
    return (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2);
  };

  // Overall class average
  const classOverallAvg = useMemo(() => {
    const studentAvgs = students
      .map(s => getMetrics(s.id).avg)
      .filter((a): a is number => a !== null);
    if (studentAvgs.length === 0) return "—";
    return (studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length).toFixed(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, localGrades, gradeableSubjects]);

  const currentMetrics = selectedStudent ? getMetrics(selectedStudent.id) : null;
  const completedCount = useMemo(
    () => students.filter(s => getMetrics(s.id).isComplete).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, localGrades, gradeableSubjects]
  );

  if (students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <GraduationCap size={36} className="text-slate-300 mb-3" />
        <p className="text-slate-700 font-bold text-base">{t.gradeEntry.noStudents}</p>
        <p className="text-slate-400 text-xs mt-1">Aucun élève trouvé dans cette classe.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ─── TOP CONTROL TOOLBAR ─── */}
      <div className="w-full bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: View Mode Toggle & Search */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* View Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "table"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon size={14} />
              <span>Grille Classe</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("student")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === "student"
                  ? "bg-white text-blue-700 shadow-2xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <User size={14} />
              <span>Par Élève</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un élève..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all text-slate-700 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Right: Stats & Main Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* Completion Counter */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 px-2.5 py-1 bg-slate-50 border border-slate-200/80 rounded-xl">
            <span>Complétés :</span>
            <strong className="text-slate-800 font-bold">{completedCount}/{students.length}</strong>
            <span className="text-slate-300">•</span>
            <span>Moy. classe :</span>
            <strong className="text-blue-600 font-bold">{classOverallAvg}/20</strong>
          </div>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === "saving"}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-2xs ${
              saveStatus === "success"
                ? "bg-emerald-600 text-white"
                : saveStatus === "error"
                ? "bg-rose-600 text-white"
                : isDirty
                ? "bg-blue-600 text-white hover:bg-blue-700 shadow-blue-500/20 active:scale-95"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200/70"
            }`}
          >
            {saveStatus === "saving" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : saveStatus === "success" ? (
              <CheckCircle2 size={14} />
            ) : saveStatus === "error" ? (
              <AlertCircle size={14} />
            ) : (
              <Save size={14} />
            )}
            <span>
              {saveStatus === "saving"
                ? "Enregistrement..."
                : saveStatus === "success"
                ? "Enregistré !"
                : saveStatus === "error"
                ? "Erreur"
                : isDirty
                ? "Enregistrer tout"
                : "Enregistrer"}
            </span>
          </button>
        </div>
      </div>

      {/* ─── SPREADSHEET MATRIX VIEW (DEFAULT) ─── */}
      {viewMode === "table" ? (
        <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          {/* Keyboard tip */}
          <div className="px-5 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Astuce : Utilisez les touches <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-600">↑</kbd> <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-600">↓</kbd> ou <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-bold text-slate-600">Entrée</kbd> pour naviguer rapidement de haut en bas.
            </span>
            <span className="font-semibold text-slate-500">
              {filteredStudents.length} élèves • {gradeableSubjects.length} matières
            </span>
          </div>

          {/* Full-width Responsive Table */}
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse text-left">
              <thead>
                {/* Domain Grouping Row */}
                <tr className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                  <th className="py-2.5 px-4 sticky left-0 z-20 bg-slate-50 border-r border-slate-200 min-w-[200px]">
                    Élève ({students.length})
                  </th>
                  {domains.map(domain => {
                    const subs = domainMap[domain] || [];
                    if (subs.length === 0) return null;
                    return (
                      <th
                        key={domain}
                        colSpan={subs.length}
                        className="py-2 px-3 text-center border-r border-slate-200/80 bg-slate-100/60 tracking-wider uppercase text-[10px] font-black text-slate-600"
                        dir="rtl"
                      >
                        {domain} ({subs.length})
                      </th>
                    );
                  })}
                  <th className="py-2.5 px-3 text-center min-w-[100px] border-r border-slate-200 bg-blue-50/50 text-blue-900 font-bold">
                    Moyenne
                  </th>
                  <th className="py-2.5 px-3 text-center min-w-[80px] bg-slate-50 font-bold text-slate-600">
                    Bulletin
                  </th>
                </tr>

                {/* Subject Names Sub-Header Row */}
                <tr className="bg-white border-b border-slate-200 text-xs font-semibold text-slate-700">
                  <th className="py-2 px-4 sticky left-0 z-20 bg-white border-r border-slate-200 text-[11px] text-slate-400 font-medium">
                    Nom & Prénom
                  </th>
                  {gradeableSubjects.map(sub => {
                    const ar = parseArabicName(sub.name);
                    const fr = parseFrenchName(sub.name);
                    return (
                      <th
                        key={sub.id}
                        className="py-2 px-2 text-center border-r border-slate-100 min-w-[85px] max-w-[110px]"
                      >
                        <div className="text-[12px] font-bold text-slate-800 truncate" dir="rtl" title={ar}>
                          {ar}
                        </div>
                        {fr ? (
                          <div className="text-[10px] text-slate-400 truncate font-normal" title={fr}>
                            {fr}
                          </div>
                        ) : null}
                      </th>
                    );
                  })}
                  <th className="py-2 px-3 text-center border-r border-slate-200 text-[11px] text-blue-700 font-bold bg-blue-50/30">
                    / 20
                  </th>
                  <th className="py-2 px-3 text-center text-[11px] text-slate-400 font-medium">
                    PDF
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStudents.map((student, stIdx) => {
                  const m = getMetrics(student.id);
                  const mentionColor = getMentionColor(m.avg);

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Student Info (Sticky Left) */}
                      <td className="py-2.5 px-4 sticky left-0 z-10 bg-white group-hover:bg-slate-50/90 border-r border-slate-200 font-medium transition-colors">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${
                            m.isComplete
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {student.name[0]?.toUpperCase()}{student.surname?.[0]?.toUpperCase() || ""}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[13px] font-bold text-slate-800 block truncate">
                              {student.name} {student.surname}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              {m.entered}/{m.total} saisies
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Subject Input Cells */}
                      {gradeableSubjects.map((sub, sbIdx) => {
                        const score = localGrades[student.id]?.[sub.id];
                        const filled = score !== undefined && score !== null;

                        return (
                          <td
                            key={sub.id}
                            className="py-2 px-2 text-center border-r border-slate-100"
                          >
                            <input
                              ref={el => { tableInputRefs.current[`${stIdx}-${sbIdx}`] = el; }}
                              type="number"
                              min="0"
                              max="20"
                              step="0.25"
                              placeholder="—"
                              value={score ?? ""}
                              onChange={e => handleScoreChange(student.id, sub.id, e.target.value)}
                              onKeyDown={e => handleTableKeyDown(e, stIdx, sbIdx)}
                              className={`w-14 h-9 text-center font-bold text-sm rounded-lg border outline-none transition-all ${
                                filled
                                  ? score >= 10
                                    ? "border-slate-200 text-slate-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                    : "border-rose-200 text-rose-700 bg-rose-50/20 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15"
                                  : "border-slate-200/80 text-slate-400 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                              }`}
                            />
                          </td>
                        );
                      })}

                      {/* Row GPA */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 bg-blue-50/20">
                        <span className={`text-sm ${mentionColor}`}>
                          {m.avgDisplay}
                        </span>
                        {m.avg !== null && (
                          <span className="block text-[9px] text-slate-400 font-semibold">
                            {getMentionLabel(m.avg)}
                          </span>
                        )}
                      </td>

                      {/* Individual Bulletin Action */}
                      <td className="py-2.5 px-3 text-center">
                        <Link
                          href={`/admin/grades/${student.id}/report-card?term=${term}`}
                          target="_blank"
                          className="inline-flex items-center justify-center p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Imprimer le bulletin de cet élève"
                        >
                          <FileText size={15} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Class Averages Summary Footer */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs font-bold text-slate-700">
                  <td className="py-3 px-4 sticky left-0 z-10 bg-slate-50 border-r border-slate-200 text-[11px] font-black uppercase text-slate-600">
                    Moyenne de la classe
                  </td>
                  {gradeableSubjects.map(sub => (
                    <td
                      key={sub.id}
                      className="py-3 px-2 text-center border-r border-slate-200/80 text-xs font-extrabold text-slate-700"
                    >
                      {getSubjectClassAvg(sub.id)}
                    </td>
                  ))}
                  <td className="py-3 px-3 text-center border-r border-slate-200 bg-blue-50/60 text-sm font-black text-blue-700">
                    {classOverallAvg}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => window.open(`/admin/grades/bulk/${classId}?term=${term}`, "_blank")}
                      className="text-xs font-bold text-blue-600 hover:underline flex items-center justify-center gap-1 mx-auto"
                    >
                      <Printer size={13} /> Tout
                    </button>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        /* ─── SINGLE STUDENT FOCUS VIEW (PAR ÉLÈVE) ─── */
        <div className="flex flex-col lg:flex-row gap-5 items-start">
          {/* Sidebar */}
          <div className="w-full lg:w-72 shrink-0 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-col overflow-hidden sticky top-4">
            <div className="p-3.5 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Élèves ({students.length})
                </span>
                <span className="text-xs font-semibold text-slate-400">
                  {completedCount}/{students.length} complets
                </span>
              </div>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  placeholder="Filtrer..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all placeholder:text-slate-400 text-slate-700"
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-[calc(100vh-280px)] min-h-[320px] p-2 space-y-1 custom-scrollbar">
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
                        ? "bg-blue-50/90 border border-blue-200 text-blue-950 shadow-2xs"
                        : "border border-transparent hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        m.isComplete ? "bg-emerald-500" : isSelected ? "bg-blue-500" : "bg-slate-200"
                      }`} />
                      <div className="min-w-0">
                        <div className={`text-[13px] font-bold truncate ${isSelected ? "text-blue-950" : "text-slate-800"}`}>
                          {student.name} {student.surname}
                        </div>
                        <div className={`text-[11px] truncate ${isSelected ? "text-blue-600 font-medium" : "text-slate-400"}`}>
                          {m.entered}/{m.total} notes
                        </div>
                      </div>
                    </div>
                    <span className={`text-xs font-bold shrink-0 ${isSelected ? "text-blue-700 font-extrabold" : "text-slate-400"}`}>
                      {m.avgDisplay}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Card View */}
          <div className="flex-1 w-full min-w-0 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col">
            {selectedStudent ? (
              <>
                {/* Header */}
                <div className="p-5 border-b border-slate-100 bg-white">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-sm font-bold text-blue-700 shrink-0">
                        {selectedStudent.name[0]?.toUpperCase()}{selectedStudent.surname?.[0]?.toUpperCase() ?? ""}
                      </div>
                      <div>
                        <h2 className="text-base font-bold text-slate-900">
                          {selectedStudent.name} {selectedStudent.surname}
                        </h2>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Moyenne : <strong className="text-slate-800">{currentMetrics?.avgDisplay} / 20</strong></span>
                          {currentMetrics?.avg !== null && (
                            <span className="text-blue-600 font-bold">— {getMentionLabel(currentMetrics?.avg ?? null)}</span>
                          )}
                          <span>•</span>
                          <span>{currentIndex + 1} sur {students.length}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/grades/${selectedStudent.id}/report-card?term=${term}`}
                        target="_blank"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all shadow-2xs"
                      >
                        <FileText size={13} className="text-blue-600" />
                        <span>Bulletin PDF</span>
                      </Link>
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saveStatus === "saving"}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-2xs"
                      >
                        <Save size={13} />
                        <span>Enregistrer</span>
                      </button>
                    </div>
                  </div>

                  {/* Navigation bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={handlePrev} disabled={currentIndex === 0}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                        <ChevronLeft size={13} /> Précédent
                      </button>
                      <button onClick={handleNext} disabled={currentIndex === students.length - 1}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1">
                        Suivant <ChevronRight size={13} />
                      </button>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      {currentMetrics?.entered}/{currentMetrics?.total} notes saisies
                    </span>
                  </div>
                </div>

                {/* Subject Cards Grid (Spacious 3-column) */}
                <div className={`p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-320px)] custom-scrollbar transition-opacity duration-100 ${isTransitioning ? "opacity-0" : "opacity-100"}`}>
                  {domains.map(domain => {
                    const domainSubs = domainMap[domain] || [];
                    if (!domainSubs.length) return null;

                    return (
                      <div key={domain}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider" dir="rtl">
                            {domain}
                          </span>
                          <div className="flex-1 h-px bg-slate-100" />
                          <span className="text-[11px] text-slate-400">{domainSubs.length} matières</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                          {domainSubs.map((subject, sIdx) => {
                            const score = localGrades[selectedStudent.id]?.[subject.id];
                            const filled = score !== undefined && score !== null;
                            const arabic = parseArabicName(subject.name);
                            const french = parseFrenchName(subject.name);

                            return (
                              <div
                                key={subject.id}
                                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-all"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-bold text-slate-800 leading-snug" dir="rtl">
                                    {arabic}
                                  </div>
                                  {french && (
                                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                      {french}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <input
                                    ref={el => { cardInputRefs.current[subject.id] = el; }}
                                    type="number"
                                    min="0"
                                    max="20"
                                    step="0.25"
                                    placeholder="—"
                                    value={score ?? ""}
                                    onChange={e => handleScoreChange(selectedStudent.id, subject.id, e.target.value)}
                                    onKeyDown={e => handleCardKeyDown(e, sIdx, domainSubs)}
                                    className={`w-16 h-10 text-center font-bold text-base rounded-lg border-2 outline-none transition-all ${
                                      filled
                                        ? score >= 10
                                          ? "border-slate-200 text-slate-800 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
                                          : "border-rose-200 text-rose-700 bg-rose-50/20 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/15"
                                        : "border-slate-200 text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
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
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
