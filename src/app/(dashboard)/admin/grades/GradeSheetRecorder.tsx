"use client";

import { useState, useRef, useTransition, useCallback, ReactNode, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Maximize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createGradeSheet, GradeEntry, getGradeSheet } from "./actions";
import { extractGradesFromImage } from "./aiActions";
import { isAIQuotaReached } from "../actions/aiActions";
import { Lock, Sparkles } from "lucide-react";


interface Student {
  id: string;
  name: string;
  surname: string;
}

interface Subject {
  id: number;
  name: string;
}

interface Class {
  id: number;
  name: string;
}

interface Props {
  students: Student[];
  subjects: Subject[];
  classes: Class[];
  teachers: { id: string; name: string; surname: string }[];
  initialClassId?: number;
  initialTerm?: number;
  onClose?: () => void;
  onCloseRedirect?: string;
}

const TERMS = [1, 2, 3];

export default function GradeSheetRecorder({
  students: initialStudents,
  subjects,
  classes,
  teachers,
  initialClassId,
  initialTerm = 1,
  existingSheet,
  onClose,
  onCloseRedirect,
}: Props & { existingSheet?: any }) {
  const router = useRouter();
  const [classId, setClassId] = useState<number>(initialClassId ?? existingSheet?.classId ?? classes[0]?.id ?? 0);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [subjectId, setSubjectId] = useState<number>(existingSheet?.subjectId ?? subjects[0]?.id ?? 0);
  const [term, setTerm] = useState<number>(existingSheet?.term ?? initialTerm);
  const [teacherId, setTeacherId] = useState<string>(existingSheet?.teacherId ?? "");
  const [notes, setNotes] = useState(existingSheet?.notes ?? "");

  const updateTeacherId = (id: string) => { setTeacherId(id); setIsDirty(true); };
  const updateNotes = (val: string) => { setNotes(val); setIsDirty(true); };
 
  // CENTRALIZED SYNC EFFECT
  useEffect(() => {
    let cancelled = false;
    
    const sync = async () => {
      setIsSyncing(true);
      try {
        const sheet = await getGradeSheet(classId, subjectId, term);
        if (cancelled) return;
        
        if (sheet) {
          const newGrades: Record<string, string> = {};
          sheet.grades.forEach((g: any) => {
            newGrades[g.studentId] = String(g.score);
          });
          setGrades(newGrades);
          setProofPreviewUrl(sheet.proofUrl || null);
          setNotes(sheet.notes || "");
          setTeacherId(sheet.teacherId || "");
        } else {
          const zeroGrades: Record<string, string> = {};
          students.forEach(s => { zeroGrades[s.id] = "0"; });
          setGrades(zeroGrades);
          setProofPreviewUrl(null);
          setNotes("");
          setTeacherId("");
        }
        setIsDirty(false); // Reset dirty state as this is a fresh database sync
      } catch (err) {
        console.error("Sync Error:", err);
      } finally {
        if (!cancelled) setIsSyncing(false);
      }
    };

    sync();
    return () => { cancelled = true; };
  }, [classId, subjectId, term, students]);

  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(existingSheet?.proofUrl ?? null);
  
  // Initialize grades from existingSheet if provided
  const initialGradesMap = existingSheet?.grades?.length > 0 
    ? existingSheet.grades.reduce((acc: any, g: any) => {
        acc[g.studentId] = String(g.score);
        return acc;
      }, {}) 
    : initialStudents.reduce((acc: any, s: any) => {
        acc[s.id] = "0";
        return acc;
      }, {});

  const [grades, setGrades] = useState<Record<string, string>>(initialGradesMap);
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [aiFilledIds, setAiFilledIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leftWidth, setLeftWidth] = useState(50); // Percentage for the left panel
  const [isResizing, setIsResizing] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [isAiLocked, setIsAiLocked] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    isAIQuotaReached().then(setIsAiLocked).catch(console.error);
  }, []);

  // Sync proof URL for initial render or class change
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClassChange = async (newId: number) => {
    setClassId(newId);
    setIsLoadingStudents(true);
    try {
      // Fetch students for the new class
      const response = await fetch(`/api/students?classId=${newId}`);
      const data = await response.json();
      setStudents(data);
      const zeroGrades: Record<string, string> = {};
      data.forEach((s: any) => { zeroGrades[s.id] = "0"; });
      setGrades(zeroGrades); // Default to 0 when class changes
      setIsDirty(true);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
    if (onCloseRedirect) router.push(onCloseRedirect);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProofFile(file);
    setIsImageLoading(true);
    setProofPreviewUrl(URL.createObjectURL(file));
    setIsDirty(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setProofFile(file);
    setIsImageLoading(true);
    setProofPreviewUrl(URL.createObjectURL(file));
    setIsDirty(true);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = (e.clientX / window.innerWidth) * 100;
    if (newWidth > 20 && newWidth < 80) {
      setLeftWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Use raw window listeners for drag reliability
  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleGradeChange = (studentId: string, value: string) => {
    setGrades((prev) => ({ ...prev, [studentId]: value }));
    setIsDirty(true);
  };

  const fillAll = (value: string) => {
    const all: Record<string, string> = {};
    students.forEach((s) => (all[s.id] = value));
    setGrades(all);
    setIsDirty(true);
  };

  const handleAiScan = async () => {
    if (isAiLocked) return;
    if (!proofFile && !proofPreviewUrl) {
      alert("Please upload an image first.");
      return;
    }
    
    setIsScanning(true);
    setScanError(null);
    setScanWarnings([]);
    setAiFilledIds(new Set());

    try {
      let imageInput: string;

      if (proofFile) {
        // 1. Convert local file to base64
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(proofFile);
        imageInput = await base64Promise;
      } else if (proofPreviewUrl?.startsWith("blob:")) {
        // Fallback for cases where proofPreviewUrl is a blob but proofFile is missing/unexpected
        const response = await fetch(proofPreviewUrl);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(blob);
        imageInput = await base64Promise;
      } else {
        // Use existing URL (presumably http/https Cloudinary URL)
        imageInput = proofPreviewUrl!;
      }

      // 2. Call AI Action with full context (using single object signature for stability)
      const currentClassName = classes.find(c => c.id === classId)?.name || "Unknown";
      const currentSubjectName = subjects.find(s => s.id === subjectId)?.name || "Unknown";
      
      const result = await extractGradesFromImage({
        imageInput,
        students,
        context: {
          subject: currentSubjectName,
          term: `Term ${term}`,
          className: currentClassName
        }
      });

      if (result.error) {
        setScanError(result.error);
      } else {
        if (result.data) {
          setGrades(prev => ({ ...prev, ...result.data }));
          setAiFilledIds(new Set(Object.keys(result.data)));
          setIsDirty(true);
          // Clear highlighter after a few seconds
          setTimeout(() => setAiFilledIds(new Set()), 5000);
        }
        if (result.warnings) {
          setScanWarnings(result.warnings);
        }
      }
    } catch (err: any) {
      console.error("Scan failed:", err);
      setScanError(err.message || "Failed to process image.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSave = () => {
    const gradeEntries: GradeEntry[] = students.map((s) => ({
      studentId: s.id,
      score: grades[s.id] !== undefined && grades[s.id] !== "" ? parseFloat(grades[s.id]) : null,
    }));

    startTransition(async () => {
      try {
        let finalProofUrl = proofPreviewUrl ?? "";

        // If we have a NEW file to upload
        if (proofFile) {
          const supabase = (await import('@/utils/supabase/client')).createClient();
          const fileName = `${Date.now()}-${proofFile.name}`;
          const filePath = `grades/${fileName}`;

          const { data, error: uploadError } = await supabase.storage
            .from('uploads')
            .upload(filePath, proofFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('uploads')
            .getPublicUrl(filePath);

          finalProofUrl = publicUrl;
        }

        await createGradeSheet({
          classId,
          subjectId,
          term,
          proofUrl: finalProofUrl,
          teacherId: teacherId || undefined,
          notes,
          grades: gradeEntries,
        });

        setSaveStatus("success");
        setIsDirty(false);
        setTimeout(() => {
          setSaveStatus("idle");
        }, 1500);
      } catch (err) {
        console.error("Save Error:", err);
        setSaveStatus("error");
      }
    });
  };

  const isPdf = proofFile?.type === "application/pdf";
  const gradeCount = Object.values(grades).filter((v) => v !== "").length;
  const avgScore =
    gradeCount > 0
      ? (
          Object.values(grades)
            .filter((v) => v !== "")
            .reduce((sum, v) => sum + parseFloat(v), 0) / gradeCount
        ).toFixed(1)
      : "—";

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* ─── HEADER BAR ─── */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-sm font-black">GS</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-800 tracking-tight uppercase">Grade Sheet Recorder</h1>
            <p className="text-[10px] text-slate-400 font-bold tracking-widest uppercase">Upload Proof · Record Marks · Verify</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          {saveStatus === "success" && (
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100">
              ✓ Saved Successfully
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100">
              ✗ Error Saving
            </span>
          )}

          {(isDirty || saveStatus !== "idle") && (
            <button
              onClick={handleSave}
              disabled={isPending || isLoadingStudents}
              className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-indigo-100 animate-in fade-in zoom-in duration-300"
            >
              {isPending ? "Saving…" : "Save Sheet"}
            </button>
          )}
          
          <button 
            onClick={handleClose} 
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 transition-all text-slate-500 font-black"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ─── FILTERS BAR ─── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-white border-b border-slate-100">
        <SelectField label="Class" value={String(classId)} onChange={(v) => handleClassChange(Number(v))} disabled={!!existingSheet}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>

        <SelectField label="Subject" value={String(subjectId)} onChange={(v) => setSubjectId(Number(v))} disabled={!!existingSheet}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>

        <SelectField label="Term" value={String(term)} onChange={(v) => setTerm(Number(v))} disabled={!!existingSheet}>
          {TERMS.map((t) => <option key={t} value={t}>Term {t}</option>)}
        </SelectField>

        <SelectField label="Teacher (opt.)" value={teacherId} onChange={setTeacherId}>
          <option value="">— Not assigned —</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} {t.surname}</option>)}
        </SelectField>

        <div className="ml-auto flex items-center gap-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          <span className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">{students.length} students</span>
          <span className="px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-100">{gradeCount} graded</span>
          <span className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">avg {avgScore}</span>
        </div>
      </div>

      {/* ─── SPLIT VIEW ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Proof Viewer */}
        <div 
          className="flex flex-col border-r border-slate-200 bg-slate-100 overflow-hidden relative"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📄 Original Document</span>
            </div>
            
            <div className="flex items-center gap-3">
              {proofPreviewUrl && !isPdf && (
                <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                  <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="w-6 h-6 rounded bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center shadow-sm">-</button>
                  <button 
                    onClick={() => setZoom(1)}
                    className="text-[9px] font-black text-slate-500 w-12 text-center bg-white hover:bg-slate-50 rounded h-6 flex items-center justify-center border-x border-slate-100"
                  >
                    {zoom === 1 ? "FIT" : `${Math.round(zoom * 100)}%`}
                  </button>
                  <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} className="w-6 h-6 rounded bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold flex items-center justify-center shadow-sm">+</button>
                </div>
              )}
              
              {proofPreviewUrl && (
                <button 
                  onClick={() => setIsFullscreen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 transition-all group"
                  title="View Fullscreen"
                >
                  <Maximize2 size={12} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Preview</span>
                </button>
              )}
            </div>
          </div>

          <div
            className={`flex-1 overflow-auto bg-slate-200/30 flex items-start justify-center p-8 relative scrollbar-thin scrollbar-thumb-slate-300 ${zoom === 1 ? 'items-center' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {isImageLoading && (
              <div className="absolute inset-0 z-10 bg-slate-100 flex flex-col items-center justify-center gap-4 animate-pulse">
                <div className="w-24 h-32 bg-slate-200 rounded-xl shadow-inner"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Document...</span>
              </div>
            )}
            
            {(hasImageError || !proofPreviewUrl || proofPreviewUrl === "pending_upload") ? (
              <div className="flex flex-col items-center gap-6 p-12 bg-white rounded-[40px] border border-slate-100 shadow-sm text-center max-w-sm">
                <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center text-3xl">📭</div>
                <div>
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">No Proof Available</h3>
                   <p className="text-[10px] text-slate-400 font-bold mt-2 leading-relaxed">The original grade sheet document hasn&apos;t been uploaded yet or the link has expired.</p>
                </div>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-100 transition-all border border-indigo-100"
                >
                  Upload Grade Sheet
                </button>
              </div>
            ) : (
              isPdf ? (
                <iframe src={proofPreviewUrl} className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-lg" title="Proof PDF" />
              ) : (
                <div className={`relative transition-transform duration-200 ${zoom === 1 ? 'w-full h-full' : ''}`}
                     style={zoom !== 1 ? { 
                       transform: `scale(${zoom})`, 
                       transformOrigin: "center top",
                       width: "100%",
                       minHeight: "1000px"
                     } : {}}>
                  <Image
                    src={proofPreviewUrl}
                    alt="Proof document"
                    fill
                    onLoad={() => {
                      setIsImageLoading(false);
                      setHasImageError(false);
                    }}
                    onError={() => {
                      setIsImageLoading(false);
                      setHasImageError(true);
                    }}
                    className="object-contain rounded-xl shadow-2xl border border-white/50"
                  />
                </div>
              )
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

          {proofPreviewUrl && (
            <div className="p-4 bg-white border-t border-slate-100 flex flex-col gap-2 relative min-h-[140px]">
              {isAiLocked && (
                <div className="absolute inset-0 z-50 bg-white/20 backdrop-blur-md flex flex-col items-center justify-center p-4 text-center animate-in fade-in duration-500">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-2 shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                    <Lock size={16} />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-800 uppercase tracking-tighter mb-1">Premium Feature</h3>
                  <p className="text-[8px] font-bold text-slate-500 leading-tight mb-3">
                      AI Scanning limited to 10/10. Upgrade to **Premium** to unlock.
                  </p>
                  <button className="px-5 py-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 flex items-center gap-2">
                    <Sparkles size={12} />
                    Premium
                  </button>
                </div>
              )}
              <div className={`flex flex-col gap-2 w-full ${isAiLocked ? 'blur-sm select-none pointer-events-none grayscale' : ''}`}>
                <button
                  onClick={handleAiScan}
                  disabled={isScanning || isPdf}
                  className={`flex-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest py-3 rounded-xl transition-all shadow-sm ${
                    isScanning 
                      ? "bg-slate-100 text-slate-400" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 font-black"
                  }`}
                >
                  {isScanning ? (
                    <>
                      <div className="w-3 h-3 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
                      Scanning...
                    </>
                  ) : (
                    <>✨ AI Scan & Fill</>
                  )}
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={isScanning}
                  className="w-full text-[10px] font-black text-slate-500 uppercase tracking-widest py-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100"
                >
                  Replace
                </button>
              </div>
            </div>
          )}
          {scanError && (
            <div className="px-4 py-3 bg-rose-50 border-t border-rose-100 text-[10px] font-black text-rose-500 text-center animate-shake">
              ⚠️ {scanError}
            </div>
          )}
          {scanWarnings.length > 0 && !isScanning && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="px-4 py-3 bg-amber-50 border-t border-amber-200 flex flex-col gap-1"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs">⚠️</span>
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">AI Validation Warnings</span>
              </div>
              {scanWarnings.map((w, i) => (
                <p key={i} className="text-[10px] font-bold text-amber-700 leading-tight">• {w}</p>
              ))}
              <button 
                onClick={() => setScanWarnings([])}
                className="text-[9px] font-black text-amber-500 uppercase tracking-tight mt-1 hover:text-amber-600 self-end"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </div>

        {/* DRAGGABLE DIVIDER */}
        <div 
          onMouseDown={handleMouseDown}
          className="w-1.5 hover:w-2 bg-slate-200 hover:bg-indigo-400 cursor-col-resize flex-shrink-0 transition-all z-20 flex items-center justify-center overflow-visible"
        >
          <div className="w-1 h-8 bg-slate-300 rounded-full"></div>
        </div>

        {/* RIGHT: Editable Grades Table */}
        <div 
          className="flex flex-col overflow-hidden transition-all"
          style={{ width: `${100 - leftWidth}%` }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">✏️ Grade Entry</span>
            <button
              onClick={() => fillAll("")}
              className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
            >
              Clear All
            </button>
          </div>

          <div className="flex-1 overflow-auto relative">
            {(isLoadingStudents || isSyncing) && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                        {isLoadingStudents ? "Loading Students..." : "Syncing Records..."}
                    </span>
                </div>
              </div>
            )}
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white border-b border-slate-100 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">Score /20</th>
                  <th className="text-center px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => {
                  const raw = grades[student.id] ?? "";
                  const val = raw !== "" ? parseFloat(raw) : null;
                  const pct = val !== null ? (val / 20) * 100 : null;
                  const color =
                    pct === null ? "text-slate-300" :
                    pct >= 75 ? "text-emerald-600" :
                    pct >= 50 ? "text-amber-500" :
                    "text-rose-500";

                  const isAiFilled = aiFilledIds.has(student.id);

                  return (
                    <tr key={student.id} className={`border-b border-slate-50 ${isAiFilled ? "bg-indigo-50/50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-indigo-50/30 transition-all group`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500">
                            {student.name[0]}{student.surname[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 text-sm">{student.name} {student.surname}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={raw}
                          onChange={(e) => handleGradeChange(student.id, e.target.value)}
                          placeholder="—"
                          className="w-full text-center text-sm font-black rounded-xl border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-black ${color}`}>
                          {pct === null ? "—" : pct >= 75 ? "✓" : pct >= 50 ? "~" : "✗"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes panel */}
          <div className="p-4 bg-white border-t border-slate-100">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="e.g. 3 students absent, paper submitted on April 08"
              rows={2}
              className="w-full text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
            />
        </div>
      </div>
    </div>

    {/* ─── FULLSCREEN PREVIEW MODAL ─── */}
    <AnimatePresence>
      {isFullscreen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-xl flex flex-col p-8"
        >
          <div className="flex items-center justify-between mb-6 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
                <span className="font-black text-xs text-white">PDF</span>
              </div>
              <div>
                <h2 className="text-white font-black uppercase tracking-tight text-sm">Document Preview</h2>
                <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">High Resolution Inspection</p>
              </div>
            </div>

            <button 
              onClick={() => setIsFullscreen(false)}
              className="w-12 h-12 rounded-2xl bg-white/10 hover:bg-white/20 transition-all text-white flex items-center justify-center border border-white/10"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 bg-white/5 rounded-[40px] border border-white/10 overflow-hidden flex items-center justify-center p-4 relative">
            {isPdf ? (
              <iframe src={proofPreviewUrl!} className="w-full h-full rounded-3xl border-none" title="Fullscreen Proof PDF" />
            ) : (
              <div className="w-full h-full relative p-12 overflow-auto">
                <Image 
                  src={proofPreviewUrl!} 
                  alt="Fullscreen preview" 
                  fill
                  className="object-contain rounded-xl shadow-2xl"
                />
              </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Helper compound select */
function SelectField({
  label,
  value,
  onChange,
  children,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={`text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {children}
      </select>
    </div>
  );
}
