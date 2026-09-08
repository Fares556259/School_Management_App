"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { 
  Award, 
  TrendingUp, 
  BookOpen, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Layers, 
  Sparkles,
  ChevronRight,
  ExternalLink
} from "lucide-react";
import { LEVEL_CONFIGS } from "@/lib/report-cards/level-config";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface GradeItem {
  id: number;
  score: number;
  term: number;
  subjectId: number;
  subject: {
    id: number;
    name: string;
    domain?: string | null;
  };
}

interface StudentGradesTabProps {
  studentId: string;
  studentName: string;
  classId?: number | null;
  className?: string | null;
  gradeLevel?: number | null;
  grades: GradeItem[];
  isAdmin: boolean;
}

/** Parse first segment of pipe-separated trilingual name (e.g. "الرياضيات | Mathématiques" -> "Mathématiques" or clean name) */
function getSubjectDisplayName(rawName: string): { ar: string; fr: string } {
  if (!rawName) return { ar: "", fr: "" };
  const parts = rawName.split("|").map(p => p.trim());
  const arPart = parts.find(p => /[\u0600-\u06FF]/.test(p)) || "";
  const frPart = parts.find(p => !/[\u0600-\u06FF]/.test(p)) || parts[0];
  return { ar: arPart, fr: frPart };
}

export default function StudentGradesTab({
  studentId,
  studentName,
  classId,
  className,
  gradeLevel = 1,
  grades = [],
  isAdmin,
}: StudentGradesTabProps) {
  const { t, locale } = useLanguage();
  const [selectedTerm, setSelectedTerm] = useState<number>(1);

  // Filter grades for the selected term
  const termGrades = useMemo(() => {
    return grades.filter((g) => g.term === selectedTerm);
  }, [grades, selectedTerm]);

  // Map of subjectId -> score
  const gradeBySubjectId = useMemo(() => {
    const map = new Map<number, number>();
    termGrades.forEach((g) => {
      map.set(g.subjectId, g.score);
    });
    return map;
  }, [termGrades]);

  // Level configuration from report-cards config if exists
  const levelConfig = gradeLevel && LEVEL_CONFIGS[gradeLevel] ? LEVEL_CONFIGS[gradeLevel] : null;

  // Calculate domain averages and overall weighted average
  const academicSummary = useMemo(() => {
    if (termGrades.length === 0) {
      return {
        overallAverage: null,
        domainSummaries: [],
        totalGradedSubjects: 0,
        mention: null,
      };
    }

    if (levelConfig) {
      let totalWeightedScore = 0;
      let totalCoefficients = 0;
      const domainSummaries: {
        name: string;
        coefficient: number;
        average: number;
        subjects: {
          id?: number;
          name: string;
          arName: string;
          score: number | null;
        }[];
      }[] = [];

      levelConfig.domains.forEach((dom) => {
        const domCoeff = dom.coefficient ?? 1;
        const domSubjectsWithGrades: {
          id?: number;
          name: string;
          arName: string;
          score: number | null;
        }[] = [];

        let domScoreSum = 0;
        let domCount = 0;

        dom.subjects.forEach((cfgSub) => {
          // Find corresponding grade matching cfgSub.search
          const matchedGrade = termGrades.find((g) =>
            g.subject?.name.toLowerCase().includes(cfgSub.search.toLowerCase())
          );
          const score = matchedGrade ? matchedGrade.score : null;
          const { ar, fr } = getSubjectDisplayName(matchedGrade?.subject?.name || cfgSub.display);

          domSubjectsWithGrades.push({
            id: matchedGrade?.subjectId,
            name: cfgSub.display,
            arName: ar || cfgSub.display,
            score,
          });

          if (score !== null) {
            domScoreSum += score;
            domCount++;
          }
        });

        const domAvg = domCount > 0 ? domScoreSum / domCount : 0;
        if (domCount > 0) {
          totalWeightedScore += domAvg * domCoeff;
          totalCoefficients += domCoeff;
        }

        domainSummaries.push({
          name: dom.name,
          coefficient: domCoeff,
          average: domAvg,
          subjects: domSubjectsWithGrades,
        });
      });

      const overallAverage = totalCoefficients > 0 ? totalWeightedScore / totalCoefficients : null;

      return {
        overallAverage,
        domainSummaries,
        totalGradedSubjects: termGrades.length,
        mention: getMention(overallAverage),
      };
    }

    // Fallback: Group by existing subject.domain or standard mean
    const domainMap = new Map<string, { sum: number; count: number; subjects: any[] }>();
    let grandSum = 0;

    termGrades.forEach((g) => {
      grandSum += g.score;
      const dName = g.subject?.domain || "Matières Générales";
      if (!domainMap.has(dName)) {
        domainMap.set(dName, { sum: 0, count: 0, subjects: [] });
      }
      const entry = domainMap.get(dName)!;
      entry.sum += g.score;
      entry.count++;
      const { ar, fr } = getSubjectDisplayName(g.subject?.name || "");
      entry.subjects.push({
        id: g.subjectId,
        name: fr || g.subject?.name,
        arName: ar,
        score: g.score,
      });
    });

    const domainSummaries = Array.from(domainMap.entries()).map(([name, data]) => ({
      name,
      coefficient: 1,
      average: data.count > 0 ? data.sum / data.count : 0,
      subjects: data.subjects,
    }));

    const overallAverage = termGrades.length > 0 ? grandSum / termGrades.length : null;

    return {
      overallAverage,
      domainSummaries,
      totalGradedSubjects: termGrades.length,
      mention: getMention(overallAverage),
    };
  }, [termGrades, levelConfig]);

  function getMention(avg: number | null): { text: string; color: string; badge: string } | null {
    if (avg === null) return null;
    if (avg >= 17) return { text: t.studentProfile.grades.mentions.honors, color: "text-emerald-700", badge: "bg-emerald-50 border-emerald-200 text-emerald-700" };
    if (avg >= 15) return { text: t.studentProfile.grades.mentions.honorRoll, color: "text-blue-700", badge: "bg-blue-50 border-blue-200 text-blue-700" };
    if (avg >= 13) return { text: t.studentProfile.grades.mentions.encouragement, color: "text-indigo-700", badge: "bg-indigo-50 border-indigo-200 text-indigo-700" };
    if (avg >= 10) return { text: t.studentProfile.grades.mentions.passed, color: "text-slate-700", badge: "bg-slate-50 border-slate-200 text-slate-700" };
    return { text: t.studentProfile.grades.mentions.warning, color: "text-rose-700", badge: "bg-rose-50 border-rose-200 text-rose-700" };
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP HEADER & TRIMESTRE SWITCHER */}
      <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
              <Award size={18} />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              {t.studentProfile.grades.headerTitle}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t.studentProfile.grades.headerSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Term Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60" role="tablist">
            {[1, 2, 3].map((tNum) => {
              const count = grades.filter((g) => g.term === tNum).length;
              return (
                <button
                  key={tNum}
                  type="button"
                  role="tab"
                  aria-selected={selectedTerm === tNum}
                  onClick={() => setSelectedTerm(tNum)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    selectedTerm === tNum
                      ? "bg-white text-purple-700 shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>{t.studentProfile.grades.termTab.replace("{num}", String(tNum))}</span>
                  {count > 0 && (
                    <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                      selectedTerm === tNum ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-600"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Official Report Card Button */}
          <Link
            href={`/admin/grades/${studentId}/report-card?term=${selectedTerm}`}
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
            title={t.studentProfile.grades.reportCardTooltip}
          >
            <Printer size={14} />
            <span>{t.studentProfile.grades.officialReportCard}</span>
            <ExternalLink size={12} className="opacity-70" />
          </Link>
        </div>
      </div>

      {/* 2. KPI SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Moyenne Générale */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.studentProfile.grades.termAverage.replace("{num}", String(selectedTerm))}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-800">
                {academicSummary.overallAverage !== null
                  ? academicSummary.overallAverage.toFixed(2)
                  : "--"}
              </span>
              <span className="text-sm font-semibold text-slate-400">{t.studentProfile.grades.outOf20}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {t.studentProfile.grades.weightedTermAverage}
            </p>
          </div>
        </div>

        {/* Mention / Décision */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.studentProfile.grades.appreciation}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="mt-2">
            {academicSummary.mention ? (
              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold border ${academicSummary.mention.badge}`}>
                {academicSummary.mention.text}
              </span>
            ) : (
              <span className="text-sm font-semibold text-slate-400">{t.studentProfile.grades.gradingInProgress}</span>
            )}
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {t.studentProfile.grades.teachersCouncil}
            </p>
          </div>
        </div>

        {/* Matières saisies */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t.studentProfile.grades.evaluations}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <BookOpen size={16} />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-slate-800">
                {academicSummary.totalGradedSubjects}
              </span>
              <span className="text-sm font-semibold text-slate-400">
                {t.studentProfile.grades.subjectsCount.replace("{count}", "").trim()}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {t.studentProfile.grades.gradesRecordedInDb}
            </p>
          </div>
        </div>

        {/* Action Bulletin / Classe */}
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50/60 p-5 rounded-2xl border border-purple-100/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
              {t.studentProfile.grades.reportCardAction}
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
              <FileText size={16} />
            </div>
          </div>
          <div className="mt-3">
            <Link
              href={`/admin/grades/${studentId}/report-card?term=${selectedTerm}`}
              target="_blank"
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
            >
              <Printer size={14} />
              <span>{t.studentProfile.grades.printTermReportCard.replace("{num}", String(selectedTerm))}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 3. DETAILED DOMAIN AND SUBJECT BREAKDOWN */}
      {academicSummary.domainSummaries.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Layers size={16} className="text-slate-500" />
              <span>{t.studentProfile.grades.domainBreakdownTitle}</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {t.studentProfile.grades.standardScale}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {academicSummary.domainSummaries.map((domain, dIdx) => (
              <div
                key={dIdx}
                className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs flex flex-col justify-between gap-4"
              >
                <div>
                  {/* Domain Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                        {dIdx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{domain.name}</h4>
                        <span className="text-[11px] text-slate-400 font-medium">
                          {t.studentProfile.grades.coeffLabel.replace("{coeff}", String(domain.coefficient))}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">
                        {t.studentProfile.grades.domainAverage}
                      </span>
                      <span className="text-lg font-black text-slate-800 mt-0.5 inline-block">
                        {domain.average > 0 ? domain.average.toFixed(2) : "--"}
                        <span className="text-xs font-semibold text-slate-400 ml-1">{t.studentProfile.grades.outOf20}</span>
                      </span>
                    </div>
                  </div>

                  {/* Subjects list */}
                  <div className="divide-y divide-slate-50 mt-2">
                    {domain.subjects.map((sub, sIdx) => {
                      const score = sub.score;
                      const hasScore = score !== null;
                      const percentage = hasScore ? Math.min(Math.max((score / 20) * 100, 0), 100) : 0;
                      
                      let barColor = "bg-slate-200";
                      let textColor = "text-slate-400";
                      if (hasScore) {
                        if (score >= 14) {
                          barColor = "bg-emerald-500";
                          textColor = "text-emerald-700";
                        } else if (score >= 10) {
                          barColor = "bg-blue-500";
                          textColor = "text-blue-700";
                        } else {
                          barColor = "bg-rose-500";
                          textColor = "text-rose-700";
                        }
                      }

                      return (
                        <div key={sIdx} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-xs font-semibold text-slate-800 truncate">
                                {locale === "ar" && sub.arName ? sub.arName : sub.name}
                              </span>
                              {sub.arName && sub.arName !== sub.name && locale !== "ar" && (
                                <span className="text-[11px] font-medium text-slate-400 font-arabic truncate">
                                  {sub.arName}
                                </span>
                              )}
                            </div>
                            {/* Visual Progress Bar */}
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>

                          <div className="w-16 text-right shrink-0">
                            {hasScore ? (
                              <span className={`text-sm font-bold ${textColor}`}>
                                {score.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-300 italic">--</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
            <Award size={28} />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {t.studentProfile.grades.emptyGradesTitle.replace("{num}", String(selectedTerm))}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1 mb-5">
            {t.studentProfile.grades.emptyGradesDesc.replace("{num}", String(selectedTerm))}
          </p>

          {isAdmin && classId && (
            <Link
              href={`/admin/grades?classId=${classId}&term=${selectedTerm}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <span>{t.studentProfile.grades.accessGradeEntry}</span>
              <ChevronRight size={14} className={locale === "ar" ? "rotate-180" : ""} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
