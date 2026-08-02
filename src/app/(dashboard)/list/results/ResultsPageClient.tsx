"use client";

import { useState } from "react";
import Image from "next/image";
import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";
import { getGradeSheet, createGradeSheet } from "../../admin/grades/actions";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Upload, Pencil, Eye, Loader2, UploadCloud } from "lucide-react";
import { initializeClassSheets } from "../../admin/grades/initializeAction";
import BulkAIUploadModal from "./BulkAIUploadModal";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";

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
  sheets: any[];
  lessons: any[];
}

export default function ResultsPageClient({
  classes,
  subjects,
  teachers,
  initialStudents,
  sheets,
  lessons,
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
  const [isInitializing, setIsInitializing] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [initializingCardId, setInitializingCardId] = useState<string | null>(null);

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

    return subjects
      .map(subj => {
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {displayItems.length === 0 && (
          <div className="col-span-full bg-white p-16 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center gap-3">
            <div className="text-5xl opacity-30">📄</div>
            <p className="font-medium text-[#9297a0] text-[13px]">{t.resultsPage.noSubjectsMatch}</p>
          </div>
        )}

        {displayItems.map((item) => {
          const isPlaceholder = item.type === 'placeholder';
          const sheet = item.data;
          const cardId = isPlaceholder ? `p-${item.subject.id}` : String(sheet.id);
          const isThisInitializing = initializingCardId === cardId;
          
          // Get teacher name
          const teacherName = (() => {
            const lesson = lessons?.find((l: any) => l.classId === item.class.id && l.subjectId === item.subject.id);
            if (lesson?.teacher) return `${lesson.teacher.name} ${lesson.teacher.surname}`;
            if (!isPlaceholder && sheet.teacher) return `${sheet.teacher.name} ${sheet.teacher.surname}`;
            return null;
          })();

          // Grading progress
          const totalStudents = !isPlaceholder ? (sheet.class._count?.students || 1) : 0;
          const gradedCount = !isPlaceholder ? sheet.grades.length : 0;
          const progressPct = !isPlaceholder ? Math.min(100, (gradedCount / totalStudents) * 100) : 0;
          const isComplete = !isPlaceholder && gradedCount >= totalStudents;

          return (
            <div 
              key={cardId} 
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingCardId !== cardId) setDraggingCardId(cardId);
              }}
              onDragLeave={() => setDraggingCardId(null)}
              onDrop={(e) => handleCardDrop(e, item, isPlaceholder)}
              className={`group relative rounded-[10px] border transition-all duration-200 flex flex-col overflow-hidden ${
                isPlaceholder 
                  ? "bg-[#fafbfc] border-dashed border-[#d0d5dd] hover:border-blue-300 hover:bg-white cursor-pointer" 
                  : "bg-white border-[#e5e7eb] shadow-sm hover:shadow-md"
              }`}
              onClick={isPlaceholder && !isThisInitializing ? () => handlePlaceholderClick(item) : undefined}
            >
               {/* Drag-and-drop overlay */}
               <AnimatePresence>
                 {draggingCardId === cardId && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-30 bg-blue-50/90 backdrop-blur-sm flex flex-col items-center justify-center border-2 border-dashed border-blue-400 rounded-[10px] p-6 text-center pointer-events-none"
                   >
                     <UploadCloud className="w-8 h-8 text-blue-500 mb-2" />
                     <p className="text-[12px] font-semibold text-blue-600">Drop to attach proof</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Uploading spinner overlay */}
               <AnimatePresence>
                 {uploadingCardId === cardId && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-30 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-[10px]"
                   >
                     <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                     <p className="text-[11px] font-medium text-[#41454d]">Uploading...</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Initializing spinner overlay */}
               <AnimatePresence>
                 {isThisInitializing && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-30 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-[10px]"
                   >
                     <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                     <p className="text-[11px] font-medium text-[#41454d]">{t.resultsPage.initializeEmpty}...</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* ── Card Content ── */}
               <div className="p-5 flex flex-col gap-4 flex-1">
                 {/* Subject header */}
                 <div className="flex items-start justify-between gap-2">
                   <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                     <h3 className="text-[15px] font-semibold text-[#181d26] tracking-tight truncate" title={parseLocalizedName(item.subject.name, locale)}>
                       {parseLocalizedName(item.subject.name, locale)}
                     </h3>
                     {teacherName && (
                       <p className="text-[11px] text-[#6b7280] truncate">{teacherName}</p>
                     )}
                     {!teacherName && (
                       <p className="text-[11px] text-[#b0b5bd]">—</p>
                     )}
                   </div>
                   <div className="flex flex-col items-end gap-1.5 shrink-0">
                     <span className="px-2 py-0.5 bg-[#f3f4f6] border border-[#e5e7eb] rounded text-[10px] font-medium text-[#41454d] leading-none">
                       {t.resultsPage.term} {item.term}
                     </span>
                     {!isPlaceholder && (
                       <>
                         {sheet.proofUrl && sheet.proofUrl.startsWith("http") ? (
                           <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[10px] font-medium text-emerald-600 leading-none">
                             {t.resultsPage.proofAttached}
                           </span>
                         ) : (
                           <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded text-[10px] font-medium text-amber-600 leading-none">
                             {t.resultsPage.missingProof}
                           </span>
                         )}
                       </>
                     )}
                   </div>
                 </div>

                 {/* Progress bar */}
                 {!isPlaceholder ? (
                   <div>
                     <div className="flex items-center justify-between mb-1.5">
                       <span className="text-[11px] text-[#6b7280]">{t.resultsPage.recordingProgress}</span>
                       <span className={`text-[11px] font-medium ${isComplete ? 'text-emerald-600' : 'text-[#181d26]'}`}>
                         {gradedCount}/{totalStudents}
                       </span>
                     </div>
                     <div className="w-full h-1.5 bg-[#f3f4f6] rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                         style={{ width: `${progressPct}%` }}
                       ></div>
                     </div>
                   </div>
                 ) : (
                   /* Placeholder CTA area */
                   <div className="flex items-center gap-3 py-3 justify-center border border-dashed border-[#d0d5dd] rounded-[8px] bg-white/50 group-hover:border-blue-300 group-hover:bg-blue-50/30 transition-colors">
                     <div className="flex flex-col items-center gap-1.5">
                       <div className="flex items-center gap-2 text-[#9297a0] group-hover:text-blue-500 transition-colors">
                         <Pencil size={14} />
                         <span className="text-[12px] font-medium">{t.resultsPage.clickToStart || "Click to start grading"}</span>
                       </div>
                       <div className="flex items-center gap-1.5 text-[#b0b5bd] group-hover:text-blue-400 transition-colors">
                         <Upload size={12} />
                         <span className="text-[10px]">{t.resultsPage.orDropScan || "or drop a scan here"}</span>
                       </div>
                     </div>
                   </div>
                 )}
               </div>

               {/* ── Card Footer ── */}
               {!isPlaceholder && (
                 <div className="flex items-center gap-2 px-5 py-3 border-t border-[#f0f1f3] bg-[#fafbfc]">
                   <button 
                     onClick={(e) => { e.stopPropagation(); editSheet(sheet); }}
                     className="flex-1 py-2 bg-white text-[#181d26] font-medium text-[12px] rounded-[6px] hover:bg-[#f3f4f6] border border-[#e5e7eb] transition-all flex items-center justify-center gap-1.5"
                   >
                     <Pencil size={13} />
                     {t.resultsPage.editRecording}
                   </button>
                   <button 
                     onClick={(e) => {
                       e.stopPropagation();
                       setPreviewUrl(sheet.proofUrl);
                       setIsPreviewOpen(true);
                     }}
                     className={`w-9 h-9 rounded-[6px] flex items-center justify-center transition-all border ${
                       sheet.proofUrl?.startsWith('http') 
                         ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' 
                         : 'bg-white text-[#9297a0] border-[#e5e7eb] hover:bg-[#f3f4f6]'
                     }`}
                     title={sheet.proofUrl?.startsWith('http') ? "View Proof" : "No Proof"}
                   >
                     <Eye size={15} />
                   </button>
                 </div>
               )}
            </div>
          );
        })}
      </div>

      {/* ─── PREVIEW MODAL ─── */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-white font-semibold tracking-tight">Document Preview</h3>
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
                title="Close Preview"
              >
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-12 flex items-center justify-center relative">
              {previewUrl && previewUrl.startsWith("http") ? (
                previewUrl.toLowerCase().split('?')[0].endsWith('.pdf') || previewUrl.includes("/raw/upload/") ? (
                  <iframe src={previewUrl} className="w-full h-full rounded-2xl border border-white/10 bg-white shadow-2xl" title="Quick Proof PDF" />
                ) : (
                  <Image 
                    src={previewUrl} 
                    alt="Document Preview" 
                    fill
                    className="object-contain rounded-xl shadow-2xl shadow-black p-4"
                  />
                )
              ) : (
                <div className="bg-white/5 p-12 rounded-[20px] border border-white/10 flex flex-col items-center gap-6 text-center max-w-md">
                   <div className="text-5xl opacity-50">📭</div>
                   <div>
                      <h3 className="text-lg font-semibold text-white">No Proof Available</h3>
                      <p className="text-sm text-white/40 mt-2">The original grade sheet document hasn&apos;t been uploaded yet.</p>
                   </div>
                   <button 
                     onClick={() => setIsPreviewOpen(false)}
                     className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[12px] font-medium transition-all"
                   >
                     Close
                   </button>
                </div>
              )}
            </div>
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
