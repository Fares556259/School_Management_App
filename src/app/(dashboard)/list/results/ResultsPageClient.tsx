"use client";

import { useState } from "react";
import Image from "next/image";
import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";
import { getGradeSheet, createGradeSheet } from "../../admin/grades/actions";
import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle, Sparkles } from "lucide-react";
import { initializeClassSheets } from "../../admin/grades/initializeAction";
import BulkAIUploadModal from "./BulkAIUploadModal";
import { useRouter } from "next/navigation";

/** Parse first segment of pipe-separated trilingual name to get Arabic only.
 * e.g. "الرياضيات | Mathématiques | Mathematics" → "الرياضيات"
 * Falls back to original name if no pipe is present.
 */
const parseArabicName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

interface Props {
  role: string | undefined;
  classes: any[];
  subjects: any[];
  teachers: any[];
  initialStudents: any[];
  sheets: any[];
}

export default function ResultsPageClient({
  classes,
  subjects,
  teachers,
  initialStudents,
  sheets,
}: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState<"list" | "recorder">("list");
  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const validClasses = classes.filter(c => String(c.id).toLowerCase() !== "all" && c.name.toLowerCase() !== "all classes");
  const [selectedClassId, setSelectedClassId] = useState<string>(String(validClasses[0]?.id || ""));
  const [selectedTerm, setSelectedTerm] = useState<string>("1");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [uploadingCardId, setUploadingCardId] = useState<string | null>(null);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

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
        // We need to refresh the page/data. In a real app, we might use router.refresh() 
        // or re-fetch server props. For now, we'll alert and the user can see the change on next interaction 
        // or through layout revalidation.
        alert("Success! All subjects have been initialized with 0 scores.");
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
    // 2. If a specific Class is selected, show ALL subjects (Cheklist Mode)
    const activeClass = validClasses.find(c => String(c.id) === selectedClassId);
    if (!activeClass) return [];
    
    const activeTerm = Number(selectedTerm);

    return subjects
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
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

  if (activeView === "recorder") {
    return (
      <div className="h-[calc(100vh-180px)] bg-slate-50 relative rounded-[32px] overflow-hidden border border-slate-200 shadow-sm">
        <GradeSheetRecorder
          students={initialStudents}
          subjects={subjects}
          classes={validClasses}
          teachers={teachers}
          initialClassId={editingData?.classId ?? validClasses[0]?.id}
          initialTerm={editingData?.term ?? 1}
          existingSheet={editingData}
          onClose={() => setActiveView("list")}
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-8 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm">
        <div className="flex flex-col">
          <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">Grade Sheets</h1>
          <p className="text-[13px] text-[#41454d] mt-1">Manage and verify physical proof of grades.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsBulkUploadOpen(true)}
            className="px-4 py-2.5 bg-[#181d26] text-white border border-transparent font-medium rounded-[6px] hover:bg-[#0d1218] transition-all text-[13px] flex items-center gap-2"
          >
            <Sparkles size={16} />
            Bulk AI Scan
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-4 px-2">
         <div className="flex-1 min-w-[300px] relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9297a0] text-[14px]">🔍</div>
            <input 
              type="text" 
              placeholder="Filter by subject Name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-white rounded-[6px] border border-[#dddddd] shadow-sm text-[13px] focus:outline-none focus:border-[#1b61c9] transition-all placeholder:text-[#9297a0] text-[#181d26]"
            />
         </div>
         
         <select 
           value={selectedClassId} 
           onChange={(e) => setSelectedClassId(e.target.value)}
           className="px-4 py-2.5 bg-white rounded-[6px] border border-[#dddddd] shadow-sm text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] transition-all cursor-pointer"
         >
           {validClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
         </select>

         <select 
           value={selectedTerm} 
           onChange={(e) => setSelectedTerm(e.target.value)}
           className="px-4 py-2.5 bg-white rounded-[6px] border border-[#dddddd] shadow-sm text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] transition-all cursor-pointer"
         >
           <option value="1">Term 1</option>
           <option value="2">Term 2</option>
           <option value="3">Term 3</option>
         </select>

         {selectedClassId && (
           <button
             onClick={handleBulkInitialize}
             disabled={isInitializing}
             className="px-4 py-2.5 bg-white border border-[#dddddd] text-[#181d26] rounded-[6px] shadow-sm hover:bg-[#f8fafc] transition-all text-[13px] font-medium flex items-center gap-2"
           >
             <PlayCircle size={16} className="text-[#41454d]" />
             Initialize Empty
           </button>
         )}
      </div>

      {/* GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {(loadingSheet || isInitializing) && (
           <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                 <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-[10px] font-black text-indigo-800 uppercase tracking-widest text-center">
                   {isInitializing ? "Initializing Database...\nCreating Zero-Baseline Grade Sheets" : "Unlocking Records..."}
                 </span>
              </div>
           </div>
        )}
        
        {displayItems.length === 0 && (
          <div className="col-span-full bg-white p-20 rounded-[40px] border border-slate-100 flex flex-col items-center gap-4 opacity-60">
             <div className="text-6xl text-slate-200">📄</div>
             <p className="font-black text-slate-400 uppercase tracking-widest text-xs">No subjects match your current selection</p>
          </div>
        )}

        {displayItems.map((item, idx) => {
          const isPlaceholder = item.type === 'placeholder';
          const sheet = item.data;
          
          return (
            <div 
              key={isPlaceholder ? `p-${item.subject.id}` : sheet.id} 
              onDragOver={(e) => {
                e.preventDefault();
                const cardId = isPlaceholder ? `p-${item.subject.id}` : String(sheet.id);
                if (draggingCardId !== cardId) setDraggingCardId(cardId);
              }}
              onDragLeave={() => setDraggingCardId(null)}
              onDrop={(e) => handleCardDrop(e, item, isPlaceholder)}
              className={`group p-6 rounded-[8px] border border-[#dddddd] transition-all flex flex-col gap-6 relative overflow-hidden ${
                isPlaceholder 
                  ? "bg-[#f8fafc] border-dashed opacity-80 hover:opacity-100 hover:bg-white" 
                  : "bg-white shadow-sm hover:shadow-md"
              }`}
            >
               {/* Drag-and-drop overlay */}
               <AnimatePresence>
                 {draggingCardId === (isPlaceholder ? `p-${item.subject.id}` : String(sheet.id)) && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-30 bg-indigo-600/10 backdrop-blur-md flex flex-col items-center justify-center border-2 border-dashed border-indigo-500 rounded-[32px] p-6 text-center pointer-events-none animate-in fade-in duration-200"
                   >
                     <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl shadow-lg shadow-indigo-200 mb-2">
                       📥
                     </div>
                     <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest leading-none">Drop to attach proof</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* Uploading progress spinner overlay */}
               <AnimatePresence>
                 {uploadingCardId === (isPlaceholder ? `p-${item.subject.id}` : String(sheet.id)) && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     exit={{ opacity: 0 }}
                     className="absolute inset-0 z-30 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-[32px] p-6 text-center animate-in fade-in duration-200"
                   >
                     <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2"></div>
                     <p className="text-[9px] font-black text-indigo-700 uppercase tracking-widest leading-none">Uploading Proof...</p>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* TERM TAG & BADGES */}
               <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                  <div className="px-2.5 py-1 bg-[#ffffff] border border-[#dddddd] rounded-[4px] text-[10px] font-semibold text-[#41454d] uppercase tracking-wide leading-none">
                    Term {item.term}
                  </div>
                  {!isPlaceholder && (
                    <>
                      {sheet.proofUrl && sheet.proofUrl.startsWith("http") ? (
                         <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-[4px] text-[10px] font-semibold text-emerald-600 uppercase tracking-wide leading-none flex items-center gap-1">
                            Proof Attached
                         </div>
                      ) : (
                         <div className="px-2 py-1 bg-amber-50 border border-amber-100 rounded-[4px] text-[10px] font-semibold text-amber-600 uppercase tracking-wide leading-none flex items-center gap-1">
                            Missing Proof
                         </div>
                      )}
                      {sheet.grades.length < (sheet.class._count?.students || 1) && (
                         <div className="px-2 py-1 bg-[#f8fafc] border border-[#dddddd] rounded-[4px] text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-wide leading-none flex items-center gap-1">
                            Incomplete
                         </div>
                      )}
                    </>
                  )}
                  {isPlaceholder && (
                     <div className="px-2 py-1 bg-[#f8fafc] border border-[#dddddd] rounded-[4px] text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-wide leading-none flex items-center gap-1">
                        No Data
                     </div>
                  )}
               </div>
  
              <div className="flex flex-col gap-1">
                <span className={`text-[11px] font-medium tracking-wide ${isPlaceholder ? 'text-[#9297a0]' : 'text-[#458fff]'}`}>
                  Class {item.class.name}
                </span>
                <h3 className="text-[18px] font-medium text-[#181d26] tracking-tight mt-1">
                  {parseArabicName(item.subject.name)}
                </h3>
              </div>
  
              <div className="flex flex-col gap-4">
                 {/* STATS / PLACEHOLDER PROGRESS */}
                 <div className={`${isPlaceholder ? 'bg-[#ffffff]' : 'bg-[#f8fafc]'} p-4 rounded-[6px] border border-[#dddddd]`}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[11px] font-medium text-[#41454d] tracking-wide">Recording Progress</span>
                       <span className={`text-[12px] font-medium ${!isPlaceholder && sheet.grades.length >= (sheet.class._count?.students || 1) ? 'text-emerald-600' : 'text-[#181d26]'}`}>
                          {isPlaceholder ? '0' : sheet.grades.length} Graded
                       </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#e5e7eb] rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-1000 ${!isPlaceholder && sheet.grades.length >= (sheet.class._count?.students || 1) ? 'bg-emerald-500' : 'bg-[#1b61c9]'}`} 
                         style={{ width: isPlaceholder ? '0%' : `${Math.min(100, (sheet.grades.length / (sheet.class._count?.students || 1)) * 100)}%` }}
                       ></div>
                    </div>
                 </div>
  
                 {/* META */}
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-[6px] bg-[#ffffff] border border-[#dddddd] flex items-center justify-center text-[12px] font-medium text-[#181d26]">👤</div>
                     <div>
                       <p className="text-[12px] font-medium text-[#181d26]">
                         {isPlaceholder ? '—' : (sheet.teacher ? `${sheet.teacher.name} ${sheet.teacher.surname}` : '—')}
                       </p>
                       <p className="text-[11px] font-normal text-[#5a5a5a] tracking-wide">Lead Teacher</p>
                     </div>
                  </div>
              </div>
  
              <div className="mt-auto flex items-center gap-2 pt-4 border-t border-[#dddddd]">
                 {isPlaceholder ? (
                   <div className="flex-1 py-2.5 text-center text-[#9297a0] font-medium text-[13px] rounded-[6px] border border-dashed border-[#dddddd]">
                     Awaiting Data
                   </div>
                 ) : (
                   <>
                    <button 
                      onClick={() => editSheet(sheet)}
                      className="flex-1 py-2.5 bg-[#ffffff] text-[#181d26] font-medium text-[13px] rounded-[6px] hover:bg-[#f8fafc] border border-[#dddddd] shadow-sm transition-all"
                    >
                      Edit Recording
                    </button>
                    <button 
                      onClick={() => {
                        setPreviewUrl(sheet.proofUrl);
                        setIsPreviewOpen(true);
                      }}
                      className={`w-10 h-10 rounded-[6px] flex items-center justify-center transition-all border group shadow-sm ${
                        sheet.proofUrl?.startsWith('http') 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                          : 'bg-[#ffffff] text-[#41454d] border-[#dddddd]'
                      }`}
                      title={sheet.proofUrl?.startsWith('http') ? "View Original Proof" : "No Proof Available"}
                    >
                      <span className={`group-hover:scale-110 transition-transform text-[14px]`}>
                        👁️
                      </span>
                    </button>
                   </>
                 )}
              </div>
            </div>
          );
        })}
      </div>
      {/* PREVIEW MODAL */}
      <AnimatePresence>
        {isPreviewOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-white font-black tracking-tight uppercase">Document Quick Preview</h3>
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
                <div className="bg-white/5 p-12 rounded-[40px] border border-white/10 flex flex-col items-center gap-6 text-center max-w-md">
                   <div className="text-6xl">📭</div>
                   <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">No Proof Available</h3>
                      <p className="text-sm text-white/40 font-medium mt-2">The original grade sheet document hasn&apos;t been uploaded to the cloud for this entry yet.</p>
                   </div>
                   <button 
                     onClick={() => setIsPreviewOpen(false)}
                     className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                   >
                     Close Preview
                   </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BULK AI SCAN MODAL */}
      <BulkAIUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        selectedTerm={selectedTerm}
      />
    </div>
  );
}
