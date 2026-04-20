"use client";

import { useState } from "react";
import Image from "next/image";
import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";
import { getGradeSheet } from "../../admin/grades/actions";
import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle } from "lucide-react";
import { initializeClassSheets } from "../../admin/grades/initializeAction";

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
  const [activeView, setActiveView] = useState<"list" | "recorder">("list");
  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<any>(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>(classes[0]?.id ? String(classes[0].id) : "all");
  const [selectedTerm, setSelectedTerm] = useState<string>("all");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const startNewRecording = () => {
    setEditingSheetId(null);
    setEditingData(null);
    setActiveView("recorder");
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
    if (selectedClassId === "all") return;
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
        window.location.reload(); // Simple way to force server re-fetch of sheets
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
    const activeClass = classes.find(c => String(c.id) === selectedClassId);
    if (!activeClass) return [];
    
    const activeTerm = selectedTerm === "all" ? 1 : Number(selectedTerm);

    return subjects
      .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(subj => {
        const matchingSheet = sheets.find(
          sheet => String(sheet.classId) === selectedClassId && 
                  sheet.subjectId === subj.id && 
                  String(sheet.term) === (selectedTerm === "all" ? String(sheet.term) : selectedTerm)
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
          classes={classes}
          teachers={teachers}
          initialClassId={editingData?.classId ?? classes[0]?.id}
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
      <div className="flex items-center justify-between bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-[24px] bg-indigo-600 flex items-center justify-center shadow-xl shadow-indigo-100">
             <span className="text-white text-2xl font-black">GS</span>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">GRADE SHEETS</h1>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-1">Verified physical proof recording system</p>
          </div>
        </div>
        <button
          onClick={startNewRecording}
          className="px-8 py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all text-[12px] uppercase tracking-widest flex items-center gap-2"
        >
          <span className="text-lg">+</span> Record New Sheet
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-wrap items-center gap-4 px-2">
         <div className="flex-1 min-w-[300px] relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</div>
            <input 
              type="text" 
              placeholder="Filter by subject Name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-4 bg-white rounded-[24px] border border-slate-100 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all font-bold placeholder:text-slate-300"
            />
         </div>
         
         <select 
           value={selectedClassId} 
           onChange={(e) => setSelectedClassId(e.target.value)}
           className="px-6 py-4 bg-white rounded-[24px] border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
         >
           {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
         </select>

         <select 
           value={selectedTerm} 
           onChange={(e) => setSelectedTerm(e.target.value)}
           className="px-6 py-4 bg-white rounded-[24px] border border-slate-100 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer"
         >
           <option value="all">All Terms</option>
           <option value="1">Term 1</option>
           <option value="2">Term 2</option>
           <option value="3">Term 3</option>
         </select>

         {selectedClassId !== "all" && (
           <button
             onClick={handleBulkInitialize}
             disabled={isInitializing}
             className="px-6 py-4 bg-emerald-500 text-white rounded-[24px] shadow-lg shadow-emerald-100 hover:bg-emerald-600 hover:-translate-y-0.5 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
           >
             <PlayCircle size={14} />
             Initialize ALL Subjects (0)
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
              className={`group p-6 rounded-[32px] border transition-all flex flex-col gap-6 relative ${
                isPlaceholder 
                  ? "bg-slate-50/50 border-dashed border-slate-200 opacity-80 hover:opacity-100 hover:bg-white hover:border-indigo-200" 
                  : "bg-white border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-50/50"
              }`}
            >
               {/* TERM TAG & BADGES */}
               <div className="absolute top-6 right-6 flex flex-col items-end gap-2">
                  <div className="px-3 py-1 bg-slate-50 border border-slate-200 rounded-full text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">
                    Term {item.term}
                  </div>
                  {!isPlaceholder && (
                    <>
                      {sheet.proofUrl && sheet.proofUrl.startsWith("http") ? (
                         <div className="px-2 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[8px] font-black text-emerald-600 uppercase tracking-widest leading-none flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            Proof Attached
                         </div>
                      ) : (
                         <div className="px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg text-[8px] font-black text-amber-600 uppercase tracking-widest leading-none flex items-center gap-1">
                            ⚠️ Missing Proof
                         </div>
                      )}
                      {sheet.grades.length < (sheet.class._count?.students || 1) && (
                         <div className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none flex items-center gap-1">
                            🕒 Incomplete
                         </div>
                      )}
                    </>
                  )}
                  {isPlaceholder && (
                     <div className="px-2 py-1 bg-slate-100 border border-slate-200 rounded-lg text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none flex items-center gap-1">
                        ⚪ No Data
                     </div>
                  )}
               </div>
  
              <div className="flex flex-col gap-1">
                <span className={`text-[9px] font-black uppercase tracking-widest ${isPlaceholder ? 'text-slate-400' : 'text-indigo-500'}`}>
                  {item.subject.name}
                </span>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">{item.class.name}</h3>
              </div>
  
              <div className="flex flex-col gap-4">
                 {/* STATS / PLACEHOLDER PROGRESS */}
                 <div className={`${isPlaceholder ? 'bg-slate-100/50' : 'bg-slate-50'} p-4 rounded-2xl border border-slate-100`}>
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recording Progress</span>
                       <span className={`text-[10px] font-black ${!isPlaceholder && sheet.grades.length >= (sheet.class._count?.students || 1) ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {isPlaceholder ? '0' : sheet.grades.length} Graded
                       </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                       <div 
                         className={`h-full rounded-full transition-all duration-1000 ${!isPlaceholder && sheet.grades.length >= (sheet.class._count?.students || 1) ? 'bg-emerald-500' : 'bg-indigo-500/40'}`} 
                         style={{ width: isPlaceholder ? '0%' : `${Math.min(100, (sheet.grades.length / (sheet.class._count?.students || 1)) * 100)}%` }}
                       ></div>
                    </div>
                 </div>
  
                 {/* META */}
                 <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-xs">👤</div>
                    <div>
                      <p className="text-[10px] font-black text-slate-800">
                        {isPlaceholder ? '—' : `${sheet.teacher?.name} ${sheet.teacher?.surname || 'N/A'}`}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Lead Teacher</p>
                    </div>
                 </div>
              </div>
  
              <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-50">
                 {isPlaceholder ? (
                   <button 
                     onClick={() => {
                        setEditingData({ 
                          classId: item.class.id, 
                          subjectId: item.subject.id, 
                          term: item.term,
                          grades: [] 
                        });
                        setActiveView("recorder");
                     }}
                     className="flex-1 py-3 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all border border-indigo-600"
                   >
                     Record Missing Sheet
                   </button>
                 ) : (
                   <>
                    <button 
                      onClick={() => editSheet(sheet)}
                      className="flex-1 py-3 bg-slate-50 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
                    >
                      Edit Recording
                    </button>
                    <button 
                      onClick={() => {
                        setPreviewUrl(sheet.proofUrl);
                        setIsPreviewOpen(true);
                      }}
                      className={`w-12 h-10 rounded-xl flex items-center justify-center transition-all border group ${
                        sheet.proofUrl?.startsWith('http') 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-50' 
                          : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                      }`}
                      title={sheet.proofUrl?.startsWith('http') ? "View Original Proof" : "No Proof Available"}
                    >
                      <span className={`group-hover:scale-125 transition-transform text-lg ${sheet.proofUrl?.startsWith('http') ? 'animate-bounce-subtle' : ''}`}>
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
                <Image 
                  src={previewUrl} 
                  alt="Document Preview" 
                  fill
                  className="object-contain rounded-xl shadow-2xl shadow-black p-4"
                />
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
    </div>
  );
}
