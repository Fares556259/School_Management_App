import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, UploadCloud, Pencil, Upload, Eye, Smartphone } from "lucide-react";
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

interface SubjectProofsGridProps {
  displayItems: any[];
  lessons?: any[];
  draggingCardId?: string | null;
  setDraggingCardId?: (id: string | null) => void;
  uploadingCardId?: string | null;
  initializingCardId?: string | null;
  handleCardDrop?: (e: React.DragEvent, item: any, isPlaceholder: boolean) => void;
  handlePlaceholderClick?: (item: any) => void;
  editSheet?: (sheet: any) => void;
  setDetailsModalData?: (data: any) => void;
  readonly?: boolean;
}

export default function SubjectProofsGrid({
  displayItems,
  lessons,
  draggingCardId,
  setDraggingCardId,
  uploadingCardId,
  initializingCardId,
  handleCardDrop,
  handlePlaceholderClick,
  editSheet,
  setDetailsModalData,
  readonly = false
}: SubjectProofsGridProps) {
  const { t, locale } = useLanguage();

  if (displayItems.length === 0) {
    return (
      <div className="col-span-full bg-white p-16 rounded-[12px] border border-[#e5e7eb] flex flex-col items-center gap-3">
        <div className="text-5xl opacity-30">📄</div>
        <p className="font-medium text-[#9297a0] text-[13px]">{t.resultsPage?.noSubjectsMatch || "Aucune matière trouvée"}</p>
      </div>
    );
  }

  const grouped: Record<string, typeof displayItems> = {};
  displayItems.forEach((item) => {
    const domain = item.subject.domain || "General";
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(item);
  });

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([domain, items]) => (
        <div key={domain} className="space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-4 w-1 bg-indigo-500 rounded-full" />
            <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">{domain}</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => {
              const isPlaceholder = item.type === 'placeholder';
              const sheet = item.data;
              const cardId = isPlaceholder ? `p-${item.subject.id}` : String(sheet.id);
              const isThisInitializing = initializingCardId === cardId;
              
              const teacherName = (() => {
                const lesson = lessons?.find((l: any) => l.classId === item.class.id && l.subjectId === item.subject.id);
                if (lesson?.teacher) return `${lesson.teacher.name} ${lesson.teacher.surname}`;
                if (!isPlaceholder && sheet?.teacher) return `${sheet.teacher.name} ${sheet.teacher.surname}`;
                return null;
              })();

              const totalStudents = !isPlaceholder ? (sheet.class?._count?.students || 1) : 0;
              const gradedCount = !isPlaceholder ? sheet.grades?.length || 0 : 0;
              const progressPct = !isPlaceholder ? Math.min(100, (gradedCount / totalStudents) * 100) : 0;
              const isComplete = !isPlaceholder && gradedCount >= totalStudents;

              return (
                <div 
                  key={cardId} 
                  onDragOver={(e) => {
                    if (readonly) return;
                    e.preventDefault();
                    if (setDraggingCardId && draggingCardId !== cardId) setDraggingCardId(cardId);
                  }}
                  onDragLeave={() => {
                    if (!readonly && setDraggingCardId) setDraggingCardId(null);
                  }}
                  onDrop={(e) => {
                    if (!readonly && handleCardDrop) handleCardDrop(e, item, isPlaceholder);
                  }}
                  className={`group relative rounded-[10px] border transition-all duration-200 flex flex-col overflow-hidden ${
                    isPlaceholder 
                      ? "bg-[#fafbfc] border-dashed border-[#d0d5dd] hover:border-blue-300 hover:bg-white cursor-pointer" 
                      : "bg-white border-[#e5e7eb] shadow-sm hover:shadow-md"
                  }`}
                  onClick={isPlaceholder && !isThisInitializing && !readonly && handlePlaceholderClick ? () => handlePlaceholderClick(item) : undefined}
                >
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

                   <AnimatePresence>
                     {isThisInitializing && (
                       <motion.div 
                         initial={{ opacity: 0 }}
                         animate={{ opacity: 1 }}
                         exit={{ opacity: 0 }}
                         className="absolute inset-0 z-30 bg-white/80 backdrop-blur-[2px] flex flex-col items-center justify-center rounded-[10px]"
                       >
                         <Loader2 className="w-6 h-6 text-blue-600 animate-spin mb-2" />
                         <p className="text-[11px] font-medium text-[#41454d]">{t.resultsPage?.initializeEmpty || "Initialisation"}...</p>
                       </motion.div>
                     )}
                   </AnimatePresence>

                   <div className="p-5 flex flex-col gap-4 flex-1">
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
                           {t.resultsPage?.term || "Trimestre"} {item.term}
                         </span>
                         {!isPlaceholder && (
                           <>
                             {sheet.proofUrl && sheet.proofUrl.startsWith("http") ? (
                               <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-100 rounded text-[10px] font-medium text-emerald-600 leading-none">
                                 {t.resultsPage?.proofAttached || "Preuve"}
                               </span>
                             ) : (
                               <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 rounded text-[10px] font-medium text-amber-600 leading-none">
                                 {t.resultsPage?.missingProof || "Manquant"}
                               </span>
                             )}
                             {sheet.teacherId && (
                               <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[10px] font-medium text-indigo-600 leading-none flex items-center gap-1">
                                 <Smartphone size={9} />
                                 Via Mobile
                               </span>
                             )}
                           </>
                         )}
                       </div>
                     </div>

                     {!isPlaceholder ? (
                       <div>
                         <div className="flex items-center justify-between mb-1.5">
                           <span className="text-[11px] text-[#6b7280]">{t.resultsPage?.recordingProgress || "Progression"}</span>
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
                       <div className="flex items-center gap-3 py-3 justify-center border border-dashed border-[#d0d5dd] rounded-[8px] bg-white/50 group-hover:border-blue-300 group-hover:bg-blue-50/30 transition-colors">
                         <div className="flex flex-col items-center gap-1.5">
                           <div className="flex items-center gap-2 text-[#9297a0] group-hover:text-blue-500 transition-colors">
                             <Pencil size={14} />
                             <span className="text-[12px] font-medium">{t.resultsPage?.clickToStart || "Click to start grading"}</span>
                           </div>
                           <div className="flex items-center gap-1.5 text-[#b0b5bd] group-hover:text-blue-400 transition-colors">
                             <Upload size={12} />
                             <span className="text-[10px]">{t.resultsPage?.orDropScan || "or drop a scan here"}</span>
                           </div>
                         </div>
                       </div>
                     )}
                   </div>

                   {!isPlaceholder && !readonly && (
                     <div className="flex items-center gap-2 px-5 py-3 border-t border-[#f0f1f3] bg-[#fafbfc]">
                       <button 
                         onClick={(e) => { e.stopPropagation(); if (editSheet) editSheet(sheet); }}
                         className="flex-1 py-2 bg-white text-[#181d26] font-medium text-[12px] rounded-[6px] hover:bg-[#f3f4f6] border border-[#e5e7eb] transition-all flex items-center justify-center gap-1.5"
                       >
                         <Pencil size={13} />
                         {t.resultsPage?.editRecording || "Modifier"}
                       </button>
                       <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (setDetailsModalData) {
                              setDetailsModalData({
                                isOpen: true,
                                classId: item.class.id,
                                subjectId: item.subject.id,
                                term: item.term,
                                subjectName: item.subject.name,
                                className: item.class.name,
                                teacherName: teacherName,
                                sheet: sheet,
                              });
                            }
                          }}
                          className="w-9 h-9 rounded-[6px] flex items-center justify-center transition-all border bg-white text-[#181d26] border-[#e5e7eb] hover:bg-[#f3f4f6]"
                          title={t.resourcesPage?.viewFile || "View Grade Details"}
                        >
                          <Eye size={15} />
                        </button>
                     </div>
                   )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
