"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, FileImage, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { processBulkGrades } from "../../admin/actions/aiBulkGradeActions";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedTerm: string;
}

export default function BulkAIUploadModal({ isOpen, onClose, selectedTerm }: Props) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const { t } = useLanguage();

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "idle") return;
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith("image/")
    );
    
    if (droppedFiles.length === 0) {
      alert("Please upload valid images (JPG/PNG).");
      return;
    }
    setFiles(prev => [...prev, ...droppedFiles]);
  }, [status]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files).filter(file => file.type.startsWith("image/"));
      setFiles(prev => [...prev, ...selected]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const processFiles = async () => {
    if (files.length === 0) return;
    
    try {
      setStatus("uploading");
      const { createClient } = await import('@/utils/supabase/client');
      const supabase = createClient();
      
      const uploadedUrls: string[] = [];
      let currentProgress = 0;
      
      // Upload sequentially to track progress better
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileName = `bulk_ai/${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
        const { data, error } = await supabase.storage.from('uploads').upload(fileName, file);
        
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage.from('uploads').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
        
        currentProgress = Math.round(((i + 1) / files.length) * 50); // 50% for uploading
        setProgress(currentProgress);
      }
      
      setStatus("processing");
      setProgress(60);
      
      // Call Backend Action
      const termAssumed = selectedTerm === "all" ? 1 : Number(selectedTerm);
      const res = await processBulkGrades(uploadedUrls, termAssumed);
      
      setProgress(100);
      setStatus("done");
      
      if (res.success) {
        setResults(res.results || []);
      } else {
        alert("Bulk processing failed: " + res.error);
        setStatus("idle"); // reset so they can try again or close
      }
      
    } catch (err: any) {
      console.error(err);
      alert("Error uploading or processing files: " + err.message);
      setStatus("idle");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setResults([]);
    setStatus("idle");
    setProgress(0);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-[12px] shadow-2xl border border-[#dddddd] w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[#dddddd] flex items-center justify-between bg-white">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 border border-[#dddddd] bg-[#f8fafc] text-[#181d26] rounded-[6px] flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-[20px] font-medium text-[#181d26] tracking-tight">{t.resultsPage.modal.title}</h2>
                <p className="text-[13px] text-[#41454d] mt-1">{t.resultsPage.modal.subtitle}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              disabled={status === "uploading" || status === "processing"}
              className="p-2 text-[#9297a0] hover:text-[#181d26] hover:bg-[#f8fafc] rounded-full transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="p-8 flex-1 overflow-y-auto bg-[#f8fafc]">
            {status === "idle" && (
              <div className="flex flex-col gap-6">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border border-dashed border-[#dddddd] bg-[#ffffff] rounded-[6px] p-12 flex flex-col items-center justify-center text-center hover:border-[#a0a5b0] transition-colors"
                >
                  <div className="w-12 h-12 bg-white border border-[#dddddd] rounded-full flex items-center justify-center text-[#181d26] shadow-sm mb-4 pointer-events-none">
                    <UploadCloud size={24} />
                  </div>
                  <h3 className="text-[16px] font-medium text-[#181d26] mb-2">{t.resultsPage.modal.dragDrop}</h3>
                  <p className="text-[13px] text-[#41454d] mb-6 max-w-md">{t.resultsPage.modal.dragDropDesc} {selectedTerm === 'all' ? 1 : selectedTerm}.</p>
                  
                  <label className="px-4 py-2.5 bg-white border border-[#dddddd] text-[#181d26] font-medium text-[13px] rounded-[6px] hover:bg-[#f8fafc] cursor-pointer transition-all shadow-sm">
                    {t.resultsPage.modal.browseFiles}
                    <input type="file" multiple accept="image/png, image/jpeg" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {files.map((f, i) => (
                      <div key={i} className="relative group bg-white p-3 rounded-[6px] border border-[#dddddd] shadow-sm flex flex-col items-center gap-2">
                        <button 
                          onClick={() => removeFile(i)}
                          className="absolute -top-2 -right-2 bg-[#f8fafc] border border-[#dddddd] text-rose-600 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                        <FileImage size={24} className="text-[#9297a0]" />
                        <span className="text-[11px] font-medium text-[#41454d] truncate w-full text-center">{f.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(status === "uploading" || status === "processing") && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative w-24 h-24 mb-8">
                   <div className="absolute inset-0 rounded-full border border-[#dddddd]"></div>
                   <div className="absolute inset-0 rounded-full border border-[#181d26] border-t-transparent animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-[24px]">✨</div>
                </div>
                <h3 className="text-[18px] font-medium text-[#181d26] mb-2 animate-pulse">
                  {status === "uploading" ? "Encrypting & Uploading..." : "AI Reading Handwriting..."}
                </h3>
                <p className="text-[13px] font-medium text-[#41454d]">
                  {status === "uploading" ? `Uploading ${files.length} documents` : "Matching Class, Subject, and Students..."}
                </p>
                <div className="w-full max-w-md bg-[#e5e7eb] h-1.5 rounded-full mt-8 overflow-hidden">
                  <div className="h-full bg-[#181d26] rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {status === "done" && (
              <div className="flex flex-col gap-6">
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-[6px] flex items-center gap-4">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <div>
                    <h3 className="text-[14px] font-medium text-emerald-800">Processing Complete</h3>
                    <p className="text-[12px] text-emerald-600 mt-0.5">Review the AI extraction results below.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {results.map((res, i) => (
                    <div key={i} className={`p-5 rounded-[6px] border ${res.success ? 'border-[#dddddd] bg-white' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="w-16 h-16 rounded-[6px] bg-[#f8fafc] border border-[#dddddd] overflow-hidden relative">
                            <Image src={res.url} alt="Proof" fill className="object-cover" />
                          </div>
                          <div className="flex flex-col justify-center">
                            <h4 className="text-[13px] font-medium text-[#181d26] flex items-center gap-2 flex-wrap">
                              {res.success ? (
                                <>
                                  <span>{res.classMatch || '?'}</span>
                                  <span className="text-[#9297a0]">|</span>
                                  <span>{res.subjectMatch || '?'}</span>
                                  <span className="text-[#9297a0]">|</span>
                                  <span>Term {res.termMatch || '?'}</span>
                                  {res.teacherMatch && (
                                    <>
                                      <span className="text-[#9297a0]">|</span>
                                      <span className="text-[#41454d]">Prof. {res.teacherMatch}</span>
                                    </>
                                  )}
                                </>
                              ) : "Extraction Failed"}
                            </h4>
                            <p className={`text-[12px] font-medium mt-1 ${res.success ? 'text-[#1b61c9]' : 'text-red-500'}`}>
                              {res.success ? `${res.gradesImported} Grades Synced` : "0 Grades Synced"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {res.errors && res.errors.length > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-[6px] border border-amber-100 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-amber-700">
                            <AlertCircle size={16} />
                            <span className="text-[13px] font-medium">Warnings / Unmatched</span>
                          </div>
                          <ul className="list-disc pl-5 text-[12px] text-amber-800 space-y-1">
                            {res.errors.map((err: string, j: number) => (
                              <li key={j}>{err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-[#dddddd] bg-white flex justify-end gap-3">
            {status === "idle" && (
              <>
                <button 
                  onClick={onClose}
                  className="px-4 py-2.5 text-[#41454d] font-medium text-[13px] hover:bg-[#f8fafc] border border-transparent rounded-[6px] transition-colors"
                >
                  {t.resultsPage.modal.cancel}
                </button>
                <button 
                  onClick={processFiles}
                  disabled={files.length === 0}
                  className="px-4 py-2.5 bg-[#181d26] hover:bg-[#0d1218] text-white font-medium text-[13px] rounded-[6px] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  {t.resultsPage.modal.processFiles} {files.length}
                </button>
              </>
            )}
            
            {status === "done" && (
              <>
                <button 
                  onClick={handleReset}
                  className="px-4 py-2.5 text-[#41454d] font-medium text-[13px] hover:bg-[#f8fafc] border border-transparent rounded-[6px] transition-colors"
                >
                  Upload More
                </button>
                <button 
                  onClick={() => {
                    onClose();
                    router.refresh();
                  }}
                  className="px-4 py-2.5 bg-[#181d26] hover:bg-[#0d1218] text-white font-medium text-[13px] rounded-[6px] transition-all"
                >
                  Return to Grade Sheets
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
