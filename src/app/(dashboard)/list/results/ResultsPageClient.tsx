"use client";

import { useState } from "react";
import Image from "next/image";
import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";
import { getGradeSheet, createGradeSheet } from "../../admin/grades/actions";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Upload, Pencil, Eye, Loader2, UploadCloud, Smartphone, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { initializeClassSheets } from "../../admin/grades/initializeAction";
import BulkAIUploadModal from "./BulkAIUploadModal";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";

import GradeDetailsModal from "@/components/GradeDetailsModal";
import SubjectProofsGrid from "@/components/SubjectProofsGrid";

/** Parse first segment of pipe-separated trilingual name to get localized string.
 * e.g. "الرياضيات | Mathématiques | Mathematics"
 */
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

interface Props {
  role: string | undefined;
  classes: any[];
  subjects: any[];
  teachers: any[];
  initialStudents: any[];
  allStudents?: any[];
  sheets: any[];
  lessons: any[];
  levelConfigs?: any;
}

export default function ResultsPageClient({
  classes,
  subjects,
  teachers,
  initialStudents,
  allStudents,
  sheets,
  lessons,
  levelConfigs,
}: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"list" | "recorder">("list");
  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const { t, locale } = useLanguage();
  const validClasses = classes.filter(c => String(c.id).toLowerCase() !== "all" && c.name.toLowerCase() !== "all classes");
  const [selectedClassId, setSelectedClassId] = useState<string>(String(validClasses[0]?.id || ""));
  const [selectedTerm, setSelectedTerm] = useState<string>("1");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [initializingCardId, setInitializingCardId] = useState<string | null>(null);
  const [detailsModalData, setDetailsModalData] = useState<{
    isOpen: boolean;
    classId: number;
    subjectId: number;
    term: number;
    subjectName: string;
    className: string;
    teacherName?: string | null;
    sheet?: any;
  } | null>(null);

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download failed:', error);
      window.open(url, '_blank');
    }
  };

  const handleCardDrop = async (e: React.DragEvent, item: any, isPlaceholder: boolean) => {
    e.preventDefault();
    setDraggingCardId(null);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Supported formats check: PDF or Images
    const isSupported = file.type === "application/pdf" || file.type.startsWith("image/");
    if (!isSupported) {
      alert("Unsupported file format. Please upload a PDF or an Image.");
      return;
    }

    const cardId = isPlaceholder ? `p-${item.subject.id}` : item.data.id;
    setUploadingCardId(cardId);

    try {
      // 1. Upload to Supabase Storage bucket 'uploads'
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = `grades/${fileName}`;

      const { data, error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      // 2. Resolve baseline grades if placeholder sheet
      let gradeEntries: any[] = [];
      if (isPlaceholder) {
        const studentRes = await fetch(`/api/students?classId=${item.class.id}`);
        const studentsData = await studentRes.json();
        gradeEntries = studentsData.map((s: any) => ({ studentId: s.id, score: 0 }));
      } else {
        gradeEntries = item.data.grades.map((g: any) => ({ studentId: g.studentId, score: g.score }));
      }

      // 3. Upsert GradeSheet in DB using createGradeSheet server action
      await createGradeSheet({
        classId: item.class.id,
        subjectId: item.subject.id,
        term: item.term,
        proofUrl: publicUrl,
        grades: gradeEntries,
      });

      // 4. Reload page to display changes
      router.refresh();
    } catch (err) {
      console.error("Direct card upload failed:", err);
      alert("Direct upload failed. Please try using the 'Edit Recording' editor panel.");
    } finally {
      setUploadingCardId(null);
    }
  };

  // Click-to-start: Initialize a single subject card and open the recorder
  const handlePlaceholderClick = async (item: any) => {
    const cardId = `p-${item.subject.id}`;
    setInitializingCardId(cardId);
    try {
      // Create a grade sheet with 0 scores for this specific subject
      await createGradeSheet({
        classId: item.class.id,
        subjectId: item.subject.id,
        term: item.term,
        proofUrl: "",
        grades: [],
      });
      
      // Fetch the newly created sheet and open the recorder
      const fullSheet = await getGradeSheet(item.class.id, item.subject.id, item.term);
      setEditingData(fullSheet);
      setActiveView("recorder");
    } catch (err) {
      console.error("Failed to initialize and open sheet:", err);
      router.refresh();
    } finally {
      setInitializingCardId(null);
    }
  };

  const editSheet = async (sheet: any) => {
    setLoadingSheet(true);
    try {
      const fullSheet = await getGradeSheet(sheet.classId, sheet.subjectId, sheet.term);
      setEditingData(fullSheet);
      setEditingSheetId(sheet.id);
      setActiveView("recorder");
    } catch (err) {
      console.error("Failed to load sheet for editing:", err);
    } finally {
      setLoadingSheet(false);
    }
  };

  const handleBulkInitialize = async () => {
    if (!selectedClassId) return;
    const activeTerm = selectedTerm === "all" ? 1 : Number(selectedTerm);
    
    if (!confirm(`Are you sure you want to initialize ALL subjects for this class with a score of 0? This will create persistent records in the database.`)) {
      return;
    }

    setIsInitializing(true);
    try {
      const res = await initializeClassSheets(Number(selectedClassId), activeTerm);
      if (res.success) {
        router.refresh();
      } else {
        alert("Error: " + res.error);
      }
    } catch (err) {
      console.error("Initialization failed:", err);
      alert("Failed to initialize sheets.");
    } finally {
      setIsInitializing(false);
    }
  };

  const displayItems = (() => {
    const activeClass = validClasses.find(c => String(c.id) === selectedClassId);
    if (!activeClass) return [];
    
    const activeTerm = Number(selectedTerm);

    const levelNum = activeClass.level?.level;
    const levelConfig = levelNum && levelConfigs ? levelConfigs[levelNum] : undefined;

    let filteredSubjects = subjects;
    if (levelConfig) {
      filteredSubjects = [];
      levelConfig.domains.forEach((domainConfig: any) => {
        domainConfig.subjects.forEach((sub: any) => {
          const dbSubject = subjects.find(s => s.name.toLowerCase().includes(sub.search.trim().toLowerCase()));
          if (dbSubject) {
            filteredSubjects.push({
              ...dbSubject,
              domain: domainConfig.name,
              name: sub.display || dbSubject.name,
            });
          }
        });
      });
    }

    return filteredSubjects
      .map((subj: any) => {
        const matchingSheet = sheets.find(
          sheet => String(sheet.classId) === selectedClassId && 
                  sheet.subjectId === subj.id && 
                  String(sheet.term) === selectedTerm
        );
        
        if (matchingSheet) {
          return { type: 'existing', data: matchingSheet, subject: subj, class: activeClass, term: matchingSheet.term };
        }
        return { type: 'placeholder', data: null, subject: subj, class: activeClass, term: activeTerm };
      });
  })();

  // Count stats for the inline header
  const existingCount = displayItems.filter(i => i.type === 'existing').length;
  const placeholderCount = displayItems.filter(i => i.type === 'placeholder').length;

  if (activeView === "recorder") {
    return (
      <div className="h-[calc(100vh-180px)] bg-slate-50 relative rounded-[32px] overflow-hidden border border-slate-200 shadow-sm">
        <GradeSheetRecorder
          students={initialStudents}
          subjects={subjects}
          classes={validClasses}
          teachers={teachers}
          initialClassId={editingData?.classId ?? (selectedClassId ? Number(selectedClassId) : validClasses[0]?.id)}
          initialTerm={editingData?.term ?? (selectedTerm ? Number(selectedTerm) : 1)}
          existingSheet={editingData}
          onClose={() => { setActiveView("list"); router.refresh(); }}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 flex flex-col gap-6 bg-slate-50 min-h-screen">
      {/* ─── COMPACT HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <h1 className="text-[22px] font-semibold text-[#181d26] tracking-tight">{t.resultsPage.pageTitle}</h1>
          <p className="text-[13px] text-[#5a5a5a] mt-0.5">{t.resultsPage.subtitle}</p>
        </div>
        <button
          onClick={() => setIsBulkUploadOpen(true)}
          className="px-4 py-2.5 bg-[#181d26] text-white border border-transparent font-medium rounded-[8px] hover:bg-[#0d1218] transition-all text-[13px] flex items-center gap-2 self-start md:self-auto"
        >
          <Sparkles size={15} />
          {t.resultsPage.bulkAiScan}
        </button>
      </div>

      {/* ─── FILTERS BAR ─── */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-[10px] border border-[#e5e7eb] shadow-sm">
        <select 
          value={selectedClassId} 
          onChange={(e) => setSelectedClassId(e.target.value)}
          className="px-3 py-2 bg-[#f8fafc] rounded-[6px] border border-[#e5e7eb] text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-blue-400 transition-all cursor-pointer"
        >
          {validClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select 
          value={selectedTerm} 
          onChange={(e) => setSelectedTerm(e.target.value)}
          className="px-3 py-2 bg-[#f8fafc] rounded-[6px] border border-[#e5e7eb] text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-blue-400 transition-all cursor-pointer"
        >
          <option value="1">{t.resultsPage.term} 1</option>
          <option value="2">{t.resultsPage.term} 2</option>
          <option value="3">{t.resultsPage.term} 3</option>
        </select>

        {/* Stats pills */}
        <div className="flex items-center gap-2 ml-auto">
          {existingCount > 0 && (
            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 rounded-full text-[11px] font-medium text-emerald-700">
              {existingCount} {t.resultsPage.graded}
            </span>
          )}
          {placeholderCount > 0 && (
            <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 rounded-full text-[11px] font-medium text-amber-700">
              {placeholderCount} {t.resultsPage.awaitingData}
            </span>
          )}
        </div>
      </div>

      {/* ─── LOADING OVERLAY ─── */}
      {(loadingSheet || isInitializing) && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <span className="text-[12px] font-medium text-[#41454d]">
              {isInitializing ? t.resultsPage.initializeEmpty + "..." : t.resultsPage.editRecording + "..."}
            </span>
          </div>
        </div>
      )}

      {/* ─── GRID ─── */}
      <div className="space-y-8">
        {displayItems.length === 0 && (
          <div className="col-span-full bg-white p-16 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center gap-3">
            <div className="text-5xl opacity-30">📄</div>
            <p className="font-medium text-[#9297a0] text-[13px]">{t.resultsPage.noSubjectsMatch}</p>
          </div>
        )}

        {displayItems.length > 0 && (
          <SubjectProofsGrid
            displayItems={displayItems}
            lessons={lessons}
            draggingCardId={draggingCardId}
            setDraggingCardId={setDraggingCardId}
            uploadingCardId={uploadingCardId}
            initializingCardId={initializingCardId}
            handleCardDrop={handleCardDrop}
            handlePlaceholderClick={handlePlaceholderClick}
            editSheet={editSheet}
            setDetailsModalData={setDetailsModalData}
          />
        )}
 </div>

      {/* ─── GRADE DETAILS MODAL ─── */}
      {detailsModalData && (
        <GradeDetailsModal
          isOpen={detailsModalData.isOpen}
          onClose={() => setDetailsModalData(null)}
          classId={detailsModalData.classId}
          subjectId={detailsModalData.subjectId}
          term={detailsModalData.term}
          subjectName={detailsModalData.subjectName}
          className={detailsModalData.className}
          teacherName={detailsModalData.teacherName}
          students={(allStudents || initialStudents || []).filter((s: any) => s.classId === detailsModalData.classId)}
          sheet={detailsModalData.sheet}
          onEdit={() => editSheet(detailsModalData.sheet)}
        />
      )}

      {/* ─── FULLSCREEN PREVIEW MODAL (LIGHTBOX) ─── */}
      <AnimatePresence>
        {isPreviewOpen && previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center"
            onClick={() => setIsPreviewOpen(false)}
          >
            {(() => {
              const urls = previewUrl.split(",").filter(Boolean);
              if (urls.length === 0) return null;
              
              const currentUrl = urls[activePreviewIndex]!;
              const isPdf = currentUrl.toLowerCase().split('?')[0].endsWith('.pdf') || currentUrl.includes("/raw/upload/");
              
              return (
                <>
                  {/* Top Actions Bar */}
                  <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
                    <div className="text-white/60 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-md">
                      {activePreviewIndex + 1} / {urls.length}
                    </div>
                    <div className="flex gap-4">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(currentUrl, `Proof-${activePreviewIndex + 1}`);
                        }}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all"
                        title="Download Proof"
                      >
                        <Download size={20} />
                      </button>
                      <button 
                        onClick={() => setIsPreviewOpen(false)}
                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all"
                        title="Close Preview"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Navigation Arrows */}
                  {urls.length > 1 && (
                    <>
                      {activePreviewIndex > 0 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePreviewIndex(activePreviewIndex - 1); }}
                          className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all z-10"
                        >
                          <ChevronLeft size={28} />
                        </button>
                      )}
                      {activePreviewIndex < urls.length - 1 && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); setActivePreviewIndex(activePreviewIndex + 1); }}
                          className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all z-10"
                        >
                          <ChevronRight size={28} />
                        </button>
                      )}
                    </>
                  )}

                  {/* Content */}
                  <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="w-full h-full max-w-6xl max-h-screen p-12 md:p-20 flex items-center justify-center"
                  >
                    {isPdf ? (
                      <iframe 
                        src={currentUrl} 
                        onClick={(e) => e.stopPropagation()}
                        className="w-full h-full bg-white rounded-xl shadow-2xl" 
                        title="Fullscreen Proof PDF" 
                      />
                    ) : (
                      <img 
                        src={currentUrl} 
                        alt={`Proof ${activePreviewIndex + 1}`} 
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain"
                        }}
                        className="rounded-lg shadow-2xl"
                      />
                    )}
                  </motion.div>
                </>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── BULK AI SCAN MODAL ─── */}
      <BulkAIUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        selectedTerm={selectedTerm}
      />
    </div>
  );
}
