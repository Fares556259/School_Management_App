"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Award, BookOpen, Users, Calendar, Pencil, FileText, CheckCircle2, AlertCircle, Eye, Download, Image as ImageIcon, Loader2 } from "lucide-react";
import { getGradeSheet } from "@/app/(dashboard)/admin/grades/actions";
import { ProofViewerModal, ProofViewerButton } from "@/components/ProofViewerModal";
import { useLanguage } from "@/lib/translations/LanguageContext";

const parseLocalizedName = (name: string, locale: string): string => {
  if (!name) return "";
  const parts = name.split("|").map(p => p.trim());
  if (parts.length >= 3) {
    if (locale === 'ar') return parts[0];
    if (locale === 'fr') return parts[1];
    return parts[2];
  }
  return name;
};

interface GradeDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: number;
  subjectId: number;
  term: number;
  subjectName: string;
  className: string;
  teacherName?: string | null;
  students?: any[];
  sheet?: any;
  onEdit?: () => void;
}

export default function GradeDetailsModal({
  isOpen,
  onClose,
  classId,
  subjectId,
  term,
  subjectName,
  className,
  teacherName,
  students,
  sheet,
  onEdit,
}: GradeDetailsModalProps) {
  const [loading, setLoading] = useState(!sheet || !students || students.length === 0);
  const [sheetData, setSheetData] = useState<any>(sheet || null);
  const [studentsList, setStudentsList] = useState<any[]>(students || []);
  const [proofUrls, setProofUrls] = useState<string[]>(
    sheet?.proofUrl ? sheet.proofUrl.split(",").map((u: string) => u.trim()).filter(Boolean) : []
  );
  const [proofViewerOpen, setProofViewerOpen] = useState(false);
  const [proofViewerIndex, setProofViewerIndex] = useState(0);
  const { t, locale } = useLanguage();

  useEffect(() => {
    if (!isOpen) return;

    // If pre-loaded data is complete, skip network fetch completely (0ms Instant Load)
    if (sheet && students && students.length > 0) {
      setSheetData(sheet);
      setStudentsList(students);
      setProofUrls(sheet.proofUrl ? sheet.proofUrl.split(",").map((u: string) => u.trim()).filter(Boolean) : []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      try {
        // Parallel fetch for instant resolution
        const [studentRes, fetchedSheet] = await Promise.all([
          fetch(`/api/students?classId=${classId}`).then(r => r.json()).catch(() => []),
          getGradeSheet(classId, subjectId, term).catch(() => null)
        ]);

        if (cancelled) return;
        setStudentsList(Array.isArray(studentRes) ? studentRes : []);
        setSheetData(fetchedSheet);

        if (fetchedSheet?.proofUrl) {
          const urls = fetchedSheet.proofUrl.split(",").map((u: string) => u.trim()).filter(Boolean);
          setProofUrls(urls);
        } else {
          setProofUrls([]);
        }
      } catch (err) {
        console.error("Failed to load grade sheet details:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [isOpen, classId, subjectId, term, sheet, students]);

  if (!isOpen) return null;

  // Compute grade statistics
  const gradesMap: Record<string, number | null> = {};
  if (sheetData?.grades) {
    sheetData.grades.forEach((g: any) => {
      gradesMap[g.studentId] = g.score;
    });
  }

  const validScores = Object.values(gradesMap).filter((s): s is number => s !== null && s !== undefined);
  const avgScore = validScores.length > 0 ? (validScores.reduce((a, b) => a + b, 0) / validScores.length).toFixed(1) : null;
  const maxScore = validScores.length > 0 ? Math.max(...validScores) : null;
  const minScore = validScores.length > 0 ? Math.min(...validScores) : null;

  return (
    <>
      <AnimatePresence>
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="bg-white rounded-[24px] shadow-2xl border border-slate-200 max-w-2xl w-full relative max-h-[90vh] flex flex-col overflow-hidden z-10"
          >
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-indigo-600 text-white relative">
              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-bold tracking-wide uppercase text-white">
                  Term {term}
                </span>
                <span className="px-2.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[11px] font-bold text-white">
                  {className}
                </span>
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight">
                {parseLocalizedName(subjectName, locale)}
              </h2>

              {teacherName && (
                <p className="text-xs text-white/80 mt-1 font-medium flex items-center gap-1.5">
                  <span>Teacher:</span>
                  <span className="font-semibold text-white">{teacherName}</span>
                </p>
              )}
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-slate-50/50">
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                  <p className="text-xs font-medium text-slate-500">Loading grade sheet details...</p>
                </div>
              ) : (
                <>
                  {/* Stats Overview Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Average Score</span>
                      <span className="text-xl font-black text-blue-600 mt-1">
                        {avgScore !== null ? `${avgScore} / 20` : "--"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Graded</span>
                      <span className="text-xl font-black text-slate-800 mt-1">
                        {validScores.length} / {studentsList.length}
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Highest Score</span>
                      <span className="text-xl font-black text-emerald-600 mt-1">
                        {maxScore !== null ? `${maxScore} / 20` : "--"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Lowest Score</span>
                      <span className="text-xl font-black text-amber-600 mt-1">
                        {minScore !== null ? `${minScore} / 20` : "--"}
                      </span>
                    </div>
                  </div>

                  {/* Student Grades Roster Table */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Student Scores ({studentsList.length})
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto custom-scrollbar">
                      {studentsList.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400">No students enrolled in this class.</div>
                      ) : (
                        studentsList.map((student) => {
                          const score = gradesMap[student.id];
                          const hasScore = score !== null && score !== undefined;
                          const isPass = hasScore && score >= 10;

                          return (
                            <div
                              key={student.id}
                              className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-black text-slate-700">
                                  {student.name.charAt(0)}
                                </div>
                                <span className="text-sm font-bold text-slate-800">
                                  {student.name} {student.surname}
                                </span>
                              </div>

                              {hasScore ? (
                                <div className={`px-3 py-1 rounded-full text-xs font-black border flex items-center gap-1.5 ${
                                  isPass
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                                }`}>
                                  <span>{score} / 20</span>
                                </div>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                  Not Graded
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Attached Proofs Section */}
                  <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <ImageIcon size={16} className="text-slate-500" />
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Attached Grade Sheet Proofs ({proofUrls.length})
                        </span>
                      </div>
                    </div>

                    {proofUrls.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center">
                        <p className="text-xs font-medium text-slate-400">No proof documents or sheet scans attached.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {proofUrls.map((url, idx) => {
                          const isPdf = url.toLowerCase().split("?")[0].endsWith(".pdf");
                          return (
                            <div
                              key={idx}
                              onClick={() => {
                                setProofViewerIndex(idx);
                                setProofViewerOpen(true);
                              }}
                              className="p-3 bg-slate-50 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer flex items-center justify-between group"
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-blue-600 shrink-0">
                                  {isPdf ? <FileText size={18} /> : <ImageIcon size={18} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-xs font-bold text-slate-700 block truncate">
                                    {isPdf ? `Proof Document ${idx + 1}.pdf` : `Sheet Scan ${idx + 1}.jpg`}
                                  </span>
                                  <span className="text-[11px] text-slate-400 block font-medium">Click to preview</span>
                                </div>
                              </div>
                              <Eye size={16} className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0 ml-2" />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-end gap-3">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEdit();
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Pencil size={14} />
                  Edit Recording
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      {/* Lightbox Modal for proofs */}
      <ProofViewerModal
        isOpen={proofViewerOpen}
        onClose={() => setProofViewerOpen(false)}
        urls={proofUrls}
        initialIndex={proofViewerIndex}
      />
    </>
  );
}
