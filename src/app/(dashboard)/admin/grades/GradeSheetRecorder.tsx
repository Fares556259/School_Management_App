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


const parseArabicName = (name: string): string => {
  if (!name) return "";
  const parts = name.split("|");
  const arabicPart = parts.find(part => /[\u0600-\u06FF]/.test(part));
  return arabicPart ? arabicPart.trim() : parts[0].trim();
};

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
  const [notes, setNotes] = useState(existingSheet?.notes === "INITIALIZED_BULK" ? "" : (existingSheet?.notes ?? ""));

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
          if (sheet.proofUrl) {
            setIsImageLoading(true);
          } else {
            setIsImageLoading(false);
          }
          setNotes(sheet.notes === "INITIALIZED_BULK" ? "" : (sheet.notes || ""));
          setTeacherId(sheet.teacherId || "");
        } else {
          const zeroGrades: Record<string, string> = {};
          students.forEach(s => { zeroGrades[s.id] = "0"; });
          setGrades(zeroGrades);
          setProofPreviewUrl(null);
          setIsImageLoading(false);
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
  const [scanStep, setScanStep] = useState(1);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [aiFilledIds, setAiFilledIds] = useState<Set<string>>(new Set());
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [contrastEnhance, setContrastEnhance] = useState(false);
  const [isDraggingViewport, setIsDraggingViewport] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBulkPasteOpen, setIsBulkPasteOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState("");
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

  useEffect(() => {
    if (isImageLoading && imgRef.current && imgRef.current.complete) {
      setIsImageLoading(false);
    }
  }, [proofPreviewUrl, isImageLoading]);

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

  const handleViewportMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsDraggingViewport(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  };

  const handleViewportMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingViewport || !viewportRef.current) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    viewportRef.current.scrollLeft -= dx;
    viewportRef.current.scrollTop -= dy;
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleViewportMouseUp = () => {
    setIsDraggingViewport(false);
  };

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
    setScanStep(1);
    setScanError(null);
    setScanWarnings([]);
    setAiFilledIds(new Set());

    const stepTimer = setInterval(() => {
      setScanStep(s => Math.min(3, s + 1));
    }, 1500);

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
      clearInterval(stepTimer);
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

  const isPdf = proofFile?.type === "application/pdf" || (proofPreviewUrl ? proofPreviewUrl.toLowerCase().split('?')[0].endsWith(".pdf") : false);
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
      <div className="flex flex-wrap items-center gap-4 px-6 py-3 bg-white border-b border-slate-100 relative z-30">
        <CustomSelect
          label="Class"
          value={String(classId)}
          onChange={(v) => handleClassChange(Number(v))}
          options={classes.map((c) => ({ value: String(c.id), label: c.name }))}
          disabled={!!existingSheet}
        />

        <CustomSelect
          label="Subject"
          value={String(subjectId)}
          onChange={(v) => setSubjectId(Number(v))}
          options={subjects.map((s) => ({ value: String(s.id), label: parseArabicName(s.name) }))}
          disabled={!!existingSheet}
        />

        <CustomSelect
          label="Term"
          value={String(term)}
          onChange={(v) => setTerm(Number(v))}
          options={TERMS.map((t) => ({ value: String(t), label: `Term ${t}` }))}
          disabled={!!existingSheet}
        />

        <CustomSelect
          label="Teacher (opt.)"
          value={teacherId}
          onChange={setTeacherId}
          options={[
            { value: "", label: "— Not assigned —" },
            ...teachers.map((t) => ({ value: t.id, label: `${t.name} ${t.surname}` })),
          ]}
        />

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
                <>
                  <button 
                    onClick={() => setRotation(r => (r + 90) % 360)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-500 hover:text-indigo-600 transition-all font-black text-[9px] uppercase tracking-widest"
                    title="Rotate 90° Clockwise"
                  >
                    🔄 Rotate
                  </button>
                  <button 
                    onClick={() => setContrastEnhance(c => !c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${
                      contrastEnhance 
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-600' 
                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    }`}
                    title="Enhance Faint Handwriting"
                  >
                    🌓 Enhance
                  </button>
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
                </>
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
            ref={viewportRef}
            className={`flex-1 overflow-auto bg-slate-200/30 flex items-start justify-center p-8 relative scrollbar-thin scrollbar-thumb-slate-300 ${
              zoom === 1 ? 'items-center' : 'cursor-grab active:cursor-grabbing select-none'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isDraggingFile) setIsDraggingFile(true);
            }}
            onDragLeave={() => setIsDraggingFile(false)}
            onDrop={(e) => {
              handleDrop(e);
              setIsDraggingFile(false);
            }}
            onMouseDown={handleViewportMouseDown}
            onMouseMove={handleViewportMouseMove}
            onMouseUp={handleViewportMouseUp}
            onMouseLeave={handleViewportMouseUp}
          >
            {/* Inline keyframe animations for laser scanner */}
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes scan {
                0% { top: 0%; }
                50% { top: 100%; }
                100% { top: 0%; }
              }
              @keyframes scan-backdrop {
                0% { top: -20%; }
                50% { top: 80%; }
                100% { top: -20%; }
              }
            `}} />

            {/* Glowing Laser Scan Bar */}
            {isScanning && (
              <div className="absolute inset-x-8 top-8 bottom-8 z-10 pointer-events-none overflow-hidden rounded-xl border border-indigo-500/20">
                {/* Neon scan line sweeping vertically */}
                <div 
                  className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#22d3ee,0_0_20px_#06b6d4] opacity-80"
                  style={{
                    animation: "scan 3s linear infinite",
                  }}
                />
                {/* Glowing laser scan backdrop overlay */}
                <div 
                  className="absolute left-0 right-0 h-[20%] bg-gradient-to-b from-cyan-400/5 to-transparent pointer-events-none"
                  style={{
                    animation: "scan-backdrop 3s linear infinite",
                  }}
                />
              </div>
            )}

            {/* AI Scanning Timeline Floating Checklist */}
            {isScanning && (
              <div className="absolute bottom-6 right-6 z-20 bg-slate-900/95 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl flex flex-col gap-3 max-w-xs animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
                  <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none">AI Scanning in Progress</span>
                </div>
                <div className="flex flex-col gap-2.5 mt-1">
                  <TimelineStep label="Analyzing Page Layout" status={scanStep > 1 ? "completed" : "active"} />
                  <TimelineStep label="Aligning Student Database" status={scanStep > 2 ? "completed" : scanStep === 2 ? "active" : "pending"} />
                  <TimelineStep label="Transcribing Scores" status={scanStep === 3 ? "active" : "pending"} />
                </div>
              </div>
            )}
            {isImageLoading && (
              <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[4px] flex flex-col items-center justify-center gap-4 animate-in fade-in duration-300">
                <div className="relative flex items-center justify-center">
                  <div className="absolute w-14 h-14 bg-indigo-600/10 rounded-full blur-xl animate-pulse" />
                  <div className="w-12 h-12 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg shadow-indigo-100"></div>
                  <div className="absolute w-2 h-2 bg-indigo-600 rounded-full" />
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest leading-none drop-shadow-sm animate-pulse">Loading Document</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Checking resolution...</span>
                </div>
              </div>
            )}
            
            {(hasImageError || !proofPreviewUrl || proofPreviewUrl === "pending_upload") ? (
              <motion.div 
                whileHover={{ scale: 1.01, translateY: -2 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => fileRef.current?.click()}
                className={`flex flex-col items-center gap-6 p-12 bg-white rounded-[40px] border-2 border-dashed shadow-sm text-center max-w-sm cursor-pointer transition-all duration-300 relative overflow-hidden group ${
                  isDraggingFile 
                    ? 'border-indigo-500 bg-indigo-50/20 ring-4 ring-indigo-50/50 shadow-lg' 
                    : 'border-slate-200 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-50/20'
                }`}
              >
                <div className="absolute -right-20 -top-20 w-40 h-40 bg-indigo-100/35 rounded-full blur-3xl pointer-events-none group-hover:bg-indigo-100/50 transition-all duration-500" />
                <div className="absolute -left-20 -bottom-20 w-40 h-40 bg-cyan-100/25 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-100/40 transition-all duration-500" />
                
                <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center text-3xl shadow-sm transition-all duration-300 ${
                  isDraggingFile 
                    ? 'bg-indigo-600 text-white scale-110 shadow-indigo-200 animate-bounce' 
                    : 'bg-indigo-50 text-indigo-600 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-lg group-hover:shadow-indigo-100'
                }`}>
                  {isDraggingFile ? (
                    <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1 }}>📥</motion.span>
                  ) : (
                    <span>📤</span>
                  )}
                </div>
                <div className="relative z-10">
                   <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                     {isDraggingFile ? "Drop to Upload!" : "No Proof Available"}
                   </h3>
                   <p className="text-[10px] text-slate-400 font-bold mt-2.5 leading-relaxed max-w-[280px] mx-auto">
                     {isDraggingFile 
                       ? "Release your mouse to attach this sheet..." 
                       : "Drag and drop your PDF/image here, or click to browse files from your computer."}
                   </p>
                </div>
                <button
                  className="px-6 py-3 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-indigo-600 group-hover:text-white transition-all border border-indigo-100 shadow-sm relative z-10"
                >
                  Browse Grade Sheet
                </button>
              </motion.div>
            ) : (
              isPdf ? (
                <iframe 
                  src={proofPreviewUrl} 
                  onLoad={() => setIsImageLoading(false)}
                  className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-lg" 
                  title="Proof PDF" 
                />
              ) : (
                <div className={`relative transition-transform duration-200 ${zoom === 1 ? 'w-full h-full' : ''}`}
                     style={zoom !== 1 ? { 
                       transform: `scale(${zoom})`, 
                       transformOrigin: "center top",
                       width: "100%",
                       minHeight: "1000px"
                     } : {}}>
                  <img
                    ref={imgRef}
                    src={proofPreviewUrl}
                    alt="Proof document"
                    onLoad={() => {
                      setIsImageLoading(false);
                      setHasImageError(false);
                    }}
                    style={{
                      transform: `rotate(${rotation}deg)`,
                      filter: contrastEnhance ? 'contrast(1.45) brightness(1.15) saturate(0.85)' : 'none',
                      transition: 'transform 0.2s ease-out, filter 0.2s ease',
                      width: "100%",
                      height: "100%",
                      objectFit: "contain"
                    }}
                    onError={() => {
                      setIsImageLoading(false);
                      setHasImageError(true);
                    }}
                    className="rounded-xl shadow-2xl border border-white/50"
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
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 shadow-sm shrink-0">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">✏️ Grade Entry</span>
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsBulkPasteOpen(true)}
                className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest"
              >
                📋 Bulk Paste
              </button>
              <button
                onClick={() => fillAll("")}
                className="text-[10px] font-black text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
              >
                Clear All
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto relative">
            {(isLoadingStudents || isSyncing) && (
              <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] z-20 flex items-center justify-center animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-8 h-8 bg-indigo-600/10 rounded-full blur-md animate-pulse" />
                    <div className="w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">
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
                          id={`grade-input-${idx}`}
                          type="number"
                          min={0}
                          max={20}
                          step={0.25}
                          value={raw}
                          onChange={(e) => handleGradeChange(student.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown" || e.key === "Enter") {
                              e.preventDefault();
                              const nextInput = document.getElementById(`grade-input-${idx + 1}`);
                              if (nextInput) (nextInput as HTMLInputElement).focus();
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              const prevInput = document.getElementById(`grade-input-${idx - 1}`);
                              if (prevInput) (prevInput as HTMLInputElement).focus();
                            }
                          }}
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
                <img 
                  src={proofPreviewUrl!} 
                  alt="Fullscreen preview" 
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain"
                  }}
                  className="rounded-xl shadow-2xl"
                />
              </div>
              )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

      {/* ─── BULK PASTE MODAL ─── */}
      <AnimatePresence>
        {isBulkPasteOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-2xl max-w-lg w-full flex flex-col gap-6"
            >
              <div>
                <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Excel Roster Bulk Paste</h2>
                <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">Copy a column of scores from Excel/Sheets and paste below</p>
              </div>
              
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="e.g.&#10;15&#10;18.5&#10;12&#10;0&#10;14.75"
                rows={8}
                className="w-full text-sm text-slate-700 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-mono"
              />
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {
                    setIsBulkPasteOpen(false);
                    setBulkPasteText("");
                  }}
                  className="flex-1 py-3 text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all rounded-xl font-black text-[10px] uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    // Parse lines and populate student grades
                    const lines = bulkPasteText.split(/\r?\n/).map(line => line.trim()).filter(line => line !== "");
                    const newGrades = { ...grades };
                    students.forEach((student, idx) => {
                      if (lines[idx] !== undefined) {
                        newGrades[student.id] = lines[idx];
                      }
                    });
                    setGrades(newGrades);
                    setIsDirty(true);
                    setIsBulkPasteOpen(false);
                    setBulkPasteText("");
                  }}
                  className="flex-1 py-3 text-white bg-indigo-600 hover:bg-indigo-700 transition-all rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100"
                >
                  Apply Scores
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { ChevronDown, Check } from "lucide-react";

function CustomSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div ref={containerRef} className={`relative flex flex-col gap-1 min-w-[140px] ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 hover:bg-white hover:border-indigo-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer disabled:cursor-not-allowed w-full text-left"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-60 overflow-y-auto py-1 scrollbar-thin"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 text-left transition-all ${
                  opt.value === value ? "bg-indigo-50/50 text-indigo-600 font-bold" : ""
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={12} className="text-indigo-600" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimelineStep({ label, status }: { label: string; status: "completed" | "active" | "pending" }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold transition-all duration-300 ${
        status === "completed" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
        status === "active" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse" :
        "bg-white/5 text-white/20 border border-white/5"
      }`}>
        {status === "completed" ? "✓" : status === "active" ? "⚡" : "○"}
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
        status === "completed" ? "text-emerald-400" :
        status === "active" ? "text-white" :
        "text-white/30"
      }`}>{label}</span>
    </div>
  );
}
