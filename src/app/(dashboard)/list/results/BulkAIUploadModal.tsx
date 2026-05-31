"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UploadCloud, FileImage, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { processBulkGrades } from "../../admin/actions/aiBulkGradeActions";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
          className="bg-white rounded-[32px] shadow-2xl border border-slate-100 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
                <Sparkles size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-800 tracking-tight">AI Bulk Grade Scan</h2>
                <p className="text-sm font-medium text-slate-500 mt-1">Upload teacher notes. AI handles the rest.</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              disabled={status === "uploading" || status === "processing"}
              className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-colors disabled:opacity-50"
            >
              <X size={24} />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="p-8 flex-1 overflow-y-auto bg-slate-50/20">
            {status === "idle" && (
              <div className="flex flex-col gap-6">
                <div 
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-indigo-200 bg-indigo-50/50 rounded-[32px] p-12 flex flex-col items-center justify-center text-center hover:bg-indigo-50 transition-colors"
                >
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-500 shadow-sm mb-4 pointer-events-none">
                    <UploadCloud size={32} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Drag & Drop Grade Sheets</h3>
                  <p className="text-sm text-slate-500 mb-6 max-w-md">Upload images (JPG, PNG) of physical grade sheets. The AI will read the handwriting, match students, and sync grades to Term {selectedTerm === 'all' ? 1 : selectedTerm}.</p>
                  
                  <label className="px-6 py-3 bg-white border border-slate-200 text-indigo-600 font-medium text-sm rounded-lg hover:border-indigo-300 hover:bg-slate-50 cursor-pointer transition-all shadow-sm">
                    Browse Files
                    <input type="file" multiple accept="image/png, image/jpeg" className="hidden" onChange={handleFileChange} />
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {files.map((f, i) => (
                      <div key={i} className="relative group bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
                        <button 
                          onClick={() => removeFile(i)}
                          className="absolute -top-2 -right-2 bg-red-100 text-red-600 w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                        <FileImage size={32} className="text-slate-300" />
                        <span className="text-xs font-medium text-slate-600 truncate w-full text-center">{f.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(status === "uploading" || status === "processing") && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative w-32 h-32 mb-8">
                   <div className="absolute inset-0 rounded-full border-4 border-indigo-100"></div>
                   <div className="absolute inset-0 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
                   <div className="absolute inset-0 flex items-center justify-center text-3xl">✨</div>
                </div>
                <h3 className="text-xl font-semibold text-slate-800 mb-2 animate-pulse">
                  {status === "uploading" ? "Encrypting & Uploading..." : "AI Reading Handwriting..."}
                </h3>
                <p className="text-sm font-medium text-slate-500">
                  {status === "uploading" ? `Uploading ${files.length} documents` : "Matching Class, Subject, and Students..."}
                </p>
                <div className="w-full max-w-md bg-slate-100 h-2 rounded-full mt-8 overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            {status === "done" && (
              <div className="flex flex-col gap-6">
                <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4">
                  <CheckCircle2 size={24} className="text-emerald-500" />
                  <div>
                    <h3 className="text-base font-semibold text-emerald-800">Processing Complete</h3>
                    <p className="text-sm text-emerald-600 mt-1">Review the AI extraction results below.</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {results.map((res, i) => (
                    <div key={i} className={`p-6 rounded-2xl border ${res.success ? 'border-slate-200 bg-white' : 'border-red-200 bg-red-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="w-16 h-16 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative">
                            <Image src={res.url} alt="Proof" fill className="object-cover" />
                          </div>
                          <div className="flex flex-col justify-center">
                            <h4 className="text-sm font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                              {res.success ? (
                                <>
                                  <span>{res.classMatch || '?'}</span>
                                  <span className="text-slate-300">|</span>
                                  <span>{res.subjectMatch || '?'}</span>
                                  <span className="text-slate-300">|</span>
                                  <span>Term {res.termMatch || '?'}</span>
                                  {res.teacherMatch && (
                                    <>
                                      <span className="text-slate-300">|</span>
                                      <span className="text-slate-500 font-medium">Prof. {res.teacherMatch}</span>
                                    </>
                                  )}
                                </>
                              ) : "Extraction Failed"}
                            </h4>
                            <p className={`text-sm font-medium mt-1 ${res.success ? 'text-indigo-600' : 'text-red-500'}`}>
                              {res.success ? `${res.gradesImported} Grades Synced` : "0 Grades Synced"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {res.errors && res.errors.length > 0 && (
                        <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex flex-col gap-2">
                          <div className="flex items-center gap-2 text-amber-700">
                            <AlertCircle size={16} />
                            <span className="text-sm font-semibold">Warnings / Unmatched</span>
                          </div>
                          <ul className="list-disc pl-5 text-sm text-amber-800 space-y-1">
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
          <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-end gap-4">
            {status === "idle" && (
              <>
                <button 
                  onClick={onClose}
                  className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={processFiles}
                  disabled={files.length === 0}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium text-sm rounded-lg hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  <Sparkles size={16} />
                  Process {files.length} Files
                </button>
              </>
            )}
            
            {status === "done" && (
              <>
                <button 
                  onClick={handleReset}
                  className="px-4 py-2 text-slate-600 font-medium text-sm hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Upload More
                </button>
                <button 
                  onClick={() => {
                    onClose();
                    router.refresh();
                  }}
                  className="px-6 py-2 bg-slate-800 text-white font-medium text-sm rounded-lg hover:bg-slate-900 shadow-sm transition-all"
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
