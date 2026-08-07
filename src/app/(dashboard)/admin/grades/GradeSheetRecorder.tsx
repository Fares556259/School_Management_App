"use client";

import { useState, useRef, useTransition, useCallback, ReactNode, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Maximize2, X, FileText, Pencil, ClipboardPaste, Trash2, Lock, Sparkles, RotateCw, SunMedium, Loader2, Check as CheckIcon, Upload, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createGradeSheet, GradeEntry, getGradeSheet } from "./actions";
import { extractGradesFromImage } from "./aiActions";
import { isAIQuotaReached } from "../actions/aiActions";


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
  const notes = ""; // Notes feature removed

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

  const updateTeacherId = (id: string) => { setTeacherId(id); setIsDirty(true); };
 
  // CENTRALIZED SYNC EFFECT
  useEffect(() => {
    let cancelled = false;
    
    const sync = async () => {
      setIsSyncing(true);
      setIsLoadingStudents(true);
      try {
        // 1. Fetch student roster for the selected classId
        const studentRes = await fetch(`/api/students?classId=${classId}`);
        const currentStudents: Student[] = await studentRes.json();
        if (cancelled) return;
        setStudents(currentStudents);

        // 2. Fetch grade sheet data
        const sheet = await getGradeSheet(classId, subjectId, term);
        if (cancelled) return;
        
        if (sheet) {
          const newGrades: Record<string, string> = {};
          sheet.grades.forEach((g: any) => {
            newGrades[g.studentId] = g.score !== null ? String(g.score) : "";
          });
          currentStudents.forEach(s => {
            if (newGrades[s.id] === undefined) newGrades[s.id] = "";
          });
          setGrades(newGrades);
          setProofPreviewUrls(sheet.proofUrl ? sheet.proofUrl.split(",").filter(Boolean) : []);
          const isUrlPdf = sheet.proofUrl ? sheet.proofUrl.split(",")[0].toLowerCase().split('?')[0].endsWith(".pdf") : false;
          if (sheet.proofUrl && !isUrlPdf) {
            setIsImageLoading(true);
          } else {
            setIsImageLoading(false);
          }

          setTeacherId(sheet.teacherId || "");
        } else {
          const emptyGrades: Record<string, string> = {};
          currentStudents.forEach(s => { emptyGrades[s.id] = ""; });
          setGrades(emptyGrades);
          setProofPreviewUrls([]);
          setActiveProofIndex(0);
          setIsImageLoading(false);
          setTeacherId("");
        }
        setIsDirty(false); // Reset dirty state as this is a fresh database sync
      } catch (err) {
        console.error("Sync Error:", err);
      } finally {
        if (!cancelled) {
          setIsLoadingStudents(false);
          setIsSyncing(false);
        }
      }
    };

    sync();
    return () => { cancelled = true; };
  }, [classId, subjectId, term]);

  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [proofPreviewUrls, setProofPreviewUrls] = useState<string[]>(existingSheet?.proofUrl ? existingSheet.proofUrl.split(",").filter(Boolean) : []);
  const [activeProofIndex, setActiveProofIndex] = useState<number>(0);
  
  // Initialize grades from existingSheet if provided
  const initialGradesMap = existingSheet?.grades?.length > 0 
    ? existingSheet.grades.reduce((acc: any, g: any) => {
        acc[g.studentId] = String(g.score);
        return acc;
      }, {}) 
    : initialStudents.reduce((acc: any, s: any) => {
        acc[s.id] = "";
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
  }, [proofPreviewUrls, isImageLoading]);

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
      const emptyGrades: Record<string, string> = {};
      data.forEach((s: any) => { emptyGrades[s.id] = ""; });
      setGrades(emptyGrades); // Default to blank when class changes
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
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setProofFiles(prev => [...prev, ...files]);
    setProofPreviewUrls(prev => {
        const newUrls = [...prev, ...files.map(f => URL.createObjectURL(f))];
        setActiveProofIndex(prev.length);
        return newUrls;
    });
    setIsImageLoading(true);
    setIsDirty(true);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (!files.length) return;
    setProofFiles(prev => [...prev, ...files]);
    setProofPreviewUrls(prev => {
        const newUrls = [...prev, ...files.map(f => URL.createObjectURL(f))];
        setActiveProofIndex(prev.length);
        return newUrls;
    });
    setIsImageLoading(true);
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
    const cleaned = value.replace(",", ".");
    if (cleaned === "") {
      setGrades((prev) => ({ ...prev, [studentId]: "" }));
      setIsDirty(true);
      return;
    }
    if (!/^\d*\.?\d*$/.test(cleaned)) return;
    const num = parseFloat(cleaned);
    if (!isNaN(num) && (num < 0 || num > 20)) {
      return;
    }
    setGrades((prev) => ({ ...prev, [studentId]: cleaned }));
    setIsDirty(true);
  };

  const fillAll = (value: string) => {
    const cleaned = value.replace(",", ".");
    const num = parseFloat(cleaned);
    if (cleaned !== "" && (isNaN(num) || num < 0 || num > 20)) {
      alert("Grades must be between 0 and 20.");
      return;
    }
    const all: Record<string, string> = {};
    students.forEach((s) => (all[s.id] = cleaned));
    setGrades(all);
    setIsDirty(true);
  };

  const handleAiScan = async () => {
    if (isAiLocked) return;
    if (proofFiles.length === 0 && proofPreviewUrls.length === 0) {
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
      if (proofPreviewUrls.length === 0) throw new Error("No images to scan.");

      const currentClassName = classes.find(c => c.id === classId)?.name || "Unknown";
      const currentSubjectName = subjects.find(s => s.id === subjectId)?.name || "Unknown";
      
      let allGrades = { ...grades };
      let allWarnings: string[] = [];
      let allFilledIds = new Set<string>();

      for (let i = 0; i < proofPreviewUrls.length; i++) {
        setScanStep(i + 1);
        let imageInput: string;
        const url = proofPreviewUrls[i];
        
        if (url.startsWith("blob:")) {
          const response = await fetch(url);
          const blob = await response.blob();
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          imageInput = await base64Promise;
        } else {
          imageInput = url;
        }

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
          setScanError(`Error on image ${i + 1}: ${result.error}`);
          return;
        }
        
        if (result.data) {
          const sanitizedData: Record<string, string> = {};
          Object.entries(result.data).forEach(([studentId, val]) => {
            const scoreNum = typeof val === 'number' ? val : parseFloat(String(val));
            if (!isNaN(scoreNum)) {
              const clamped = Math.min(20, Math.max(0, scoreNum));
              sanitizedData[studentId] = String(clamped);
            }
          });
          allGrades = { ...allGrades, ...sanitizedData };
          Object.keys(sanitizedData).forEach(k => allFilledIds.add(k));
        }
        if (result.warnings) {
          allWarnings = [...allWarnings, ...result.warnings.map(w => `Image ${i + 1}: ${w}`)];
        }
      }

      setGrades(allGrades);
      setAiFilledIds(allFilledIds);
      setScanWarnings(allWarnings);
      setIsDirty(true);
      setTimeout(() => setAiFilledIds(new Set()), 5000);
    } catch (err: any) {
      console.error("Scan failed:", err);
      setScanError(err.message || "Failed to process image.");
    } finally {
      clearInterval(stepTimer);
      setIsScanning(false);
    }
  };

  const handleSave = () => {
    for (const s of students) {
      const val = grades[s.id];
      if (val !== undefined && val !== "") {
        const num = parseFloat(val);
        if (isNaN(num) || num < 0 || num > 20) {
          alert(`Grade for ${s.name} ${s.surname} must be between 0 and 20.`);
          return;
        }
      }
    }

    const gradeEntries: GradeEntry[] = students.map((s) => ({
      studentId: s.id,
      score: grades[s.id] !== undefined && grades[s.id] !== "" ? parseFloat(grades[s.id]) : null,
    }));

    startTransition(async () => {
      try {
        const supabase = (await import('@/utils/supabase/client')).createClient();
        let uploadedUrls: string[] = [];

        // Upload any new files
        if (proofFiles.length > 0) {
          for (const file of proofFiles) {
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

            uploadedUrls.push(publicUrl);
          }
        }

        // Combine new uploaded URLs with existing permanent URLs
        const existingUrls = proofPreviewUrls.filter(url => url.startsWith('http'));
        const allUrls = [...existingUrls, ...uploadedUrls];
        const finalProofUrl = allUrls.join(',');

        // Clear files state and update preview URLs to permanent ones
        setProofFiles([]);
        setProofPreviewUrls(allUrls);

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
        }, 3000);
      } catch (err) {
        console.error("Save Error:", err);
        setSaveStatus("error");
        setTimeout(() => {
          setSaveStatus("idle");
        }, 5000);
      }
    });
  };

  const isPdf = proofFiles[activeProofIndex]?.type === "application/pdf" || (proofPreviewUrls[activeProofIndex] ? proofPreviewUrls[activeProofIndex].toLowerCase().split('?')[0].endsWith(".pdf") : false);
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
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-[#e5e7eb]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-blue-50 flex items-center justify-center">
            <FileText size={16} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold text-[#181d26] tracking-tight">Grade Sheet Recorder</h1>
            <p className="text-[11px] text-[#6b7280]">Upload Proof · Record Marks · Verify</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Status indicator */}
          {saveStatus === "success" && (
            <motion.span 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100 flex items-center gap-1"
            >
              <CheckIcon size={13} /> Saved
            </motion.span>
          )}
          {saveStatus === "error" && (
            <motion.span 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-[11px] font-medium text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100"
            >
              Save failed — try again
            </motion.span>
          )}

          {/* Always show the Save button, but style it differently based on state */}
          <button
            onClick={handleSave}
            disabled={isPending || isLoadingStudents || (!isDirty && saveStatus === "idle")}
            className={`px-4 py-2 text-[12px] font-medium rounded-lg transition-all disabled:opacity-40 ${
              isPending 
                ? 'bg-blue-400 text-white cursor-wait' 
                : isDirty 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200'
            }`}
          >
            {isPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Saving…
              </span>
            ) : isDirty ? "Save" : "Saved"}
          </button>
          
          <button 
            onClick={handleClose} 
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-all text-[#6b7280]"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ─── FILTERS BAR ─── */}
      <div className="flex flex-wrap items-center gap-3 px-6 py-2.5 bg-white border-b border-[#e5e7eb] relative z-30">
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

        <div className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-[#6b7280]">
          <span className="px-2 py-0.5 bg-slate-50 rounded text-[10px] border border-slate-200">{students.length} students</span>
          <span className="px-2 py-0.5 bg-slate-50 rounded text-[10px] border border-slate-200">{gradeCount} graded</span>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] border border-emerald-100">avg {avgScore}</span>
        </div>
      </div>


      {/* Hidden file input */}
      <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={handleFileSelect} />

      {/* ─── FULL-HEIGHT GRADE ENTRY ─── */}
      <div 
        className="flex flex-col flex-1 overflow-hidden bg-white relative"
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingFile) setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={(e) => {
          handleDrop(e);
          setIsDraggingFile(false);
        }}
      >
        {/* Drag overlay */}
        {isDraggingFile && (
          <div className="absolute inset-0 z-50 bg-indigo-600/10 backdrop-blur-sm border-2 border-dashed border-indigo-400 rounded-xl flex flex-col items-center justify-center gap-3 pointer-events-none">
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 1 }} className="text-4xl">📥</motion.div>
            <p className="text-sm font-black text-indigo-600 uppercase tracking-widest">Drop to Upload</p>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-white border-b border-slate-100 shrink-0">
          {/* Left: Proof thumbnails */}
          <div className="flex items-center gap-2">
            {proofPreviewUrls.length > 0 ? (
              <>
                {proofPreviewUrls.map((url, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => { setActiveProofIndex(idx); setIsFullscreen(true); }}
                    className={`relative w-9 h-9 shrink-0 cursor-pointer rounded-lg overflow-hidden border-2 hover:scale-105 transition-all ${
                      activeProofIndex === idx ? 'border-indigo-500 shadow-md shadow-indigo-100' : 'border-slate-200 opacity-70 hover:opacity-100'
                    }`}
                    title={`View proof ${idx + 1}`}
                  >
                    {url.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[7px] font-bold text-slate-500">PDF</div>
                    ) : (
                      <img src={url} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => fileRef.current?.click()} 
                  className="w-9 h-9 shrink-0 rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                  title="Add more proofs"
                >
                  <span className="text-sm font-bold">+</span>
                </button>
                <div className="h-5 w-px bg-slate-200 mx-1" />
                <button 
                  onClick={() => setIsFullscreen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-all"
                >
                  <Maximize2 size={12} /> View
                </button>
              </>
            ) : (
              <button 
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg border border-slate-200 hover:border-indigo-200 transition-all"
              >
                <Upload size={13} /> Attach Proof
              </button>
            )}
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiScan}
              disabled={isScanning || isPdf || proofPreviewUrls.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                isScanning 
                  ? "bg-slate-100 text-slate-400 cursor-wait" 
                  : proofPreviewUrls.length === 0
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm shadow-indigo-200"
              }`}
            >
              {isScanning ? (
                <div className="w-3 h-3 border-2 border-indigo-200 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Sparkles size={13} />
              )}
              {isScanning ? "Scanning..." : "AI Scan"}
            </button>
            <button 
              onClick={() => setIsBulkPasteOpen(true)}
              className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors px-2 py-1.5 rounded-md hover:bg-blue-50"
            >
              <ClipboardPaste size={13} /> Paste
            </button>
            <button
              onClick={() => fillAll("")}
              className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-rose-500 transition-colors px-2 py-1.5 rounded-md hover:bg-rose-50"
            >
              <Trash2 size={13} /> Clear
            </button>
          </div>
        </div>

        {/* Scan error / warnings */}
        {scanError && (
          <div className="px-5 py-2 bg-rose-50 border-b border-rose-100 text-[11px] font-bold text-rose-500 text-center shrink-0">
            ⚠️ {scanError}
          </div>
        )}
        {scanWarnings.length > 0 && !isScanning && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            className="px-5 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-3 shrink-0"
          >
            <span className="text-xs">⚠️</span>
            <div className="flex-1 flex flex-wrap gap-x-4 gap-y-1">
              {scanWarnings.map((w, i) => (
                <span key={i} className="text-[11px] font-medium text-amber-700">• {w}</span>
              ))}
            </div>
            <button 
              onClick={() => setScanWarnings([])}
              className="text-[10px] font-bold text-amber-500 hover:text-amber-600 shrink-0"
            >
              Dismiss
            </button>
          </motion.div>
        )}

        {/* AI Scanning Floating Overlay */}
        {isScanning && (
          <div className="absolute bottom-6 right-6 z-30 bg-slate-900/95 backdrop-blur-xl border border-white/10 p-5 rounded-3xl shadow-2xl flex flex-col gap-3 max-w-xs animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></div>
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest leading-none">AI Scanning</span>
            </div>
            <div className="flex flex-col gap-2.5 mt-1">
              <TimelineStep label="Analyzing Page Layout" status={scanStep > 1 ? "completed" : "active"} />
              <TimelineStep label="Aligning Student Database" status={scanStep > 2 ? "completed" : scanStep === 2 ? "active" : "pending"} />
              <TimelineStep label="Transcribing Scores" status={scanStep === 3 ? "active" : "pending"} />
            </div>
          </div>
        )}

        {/* ── Student List (FULL HEIGHT) ── */}
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
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
              <tr>
                <th className="text-left px-5 py-2.5 text-[11px] font-medium text-[#6b7280] uppercase tracking-wide">Student</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-medium text-[#6b7280] uppercase tracking-wide w-32">Score /20</th>
                <th className="text-center px-4 py-2.5 text-[11px] font-medium text-[#6b7280] uppercase tracking-wide w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student, idx) => {
                const raw = grades[student.id] ?? "";
                const val = raw !== "" ? parseFloat(raw) : null;
                const pct = val !== null ? (val / 20) * 100 : null;
                const isAiFilled = aiFilledIds.has(student.id);

                return (
                  <tr key={student.id} className={`border-b border-slate-50 ${isAiFilled ? "bg-indigo-50/50" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"} hover:bg-indigo-50/30 transition-all group`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[11px] font-semibold text-slate-500">
                          {student.name[0]}{student.surname[0]}
                        </div>
                        <p className="font-medium text-slate-800 text-[13px]">{student.name} {student.surname}</p>
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
                        className="w-full text-center text-[13px] font-medium rounded-lg border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[12px] font-semibold ${raw !== "" ? "text-emerald-600" : "text-slate-300"}`}>
                        {raw !== "" ? "✓" : "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


      </div>

    {/* ─── FULLSCREEN PREVIEW MODAL (LIGHTBOX) ─── */}
    <AnimatePresence>
      {isFullscreen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center"
          onClick={() => setIsFullscreen(false)}
        >
          {/* Top Actions Bar */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10" onClick={(e) => e.stopPropagation()}>
            <div className="text-white/60 font-medium text-sm bg-black/40 px-3 py-1.5 rounded-lg backdrop-blur-md">
              {activeProofIndex + 1} / {proofPreviewUrls.length}
            </div>
            <div className="flex gap-4">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(proofPreviewUrls[activeProofIndex]!, `Proof-${activeProofIndex + 1}`);
                }}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all"
                title="Download Proof"
              >
                <Download size={20} />
              </button>
              <button 
                onClick={() => setIsFullscreen(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all"
                title="Close Preview"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Arrows */}
          {proofPreviewUrls.length > 1 && (
            <>
              {activeProofIndex > 0 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveProofIndex(activeProofIndex - 1); }}
                  className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-md transition-all z-10"
                >
                  <ChevronLeft size={28} />
                </button>
              )}
              {activeProofIndex < proofPreviewUrls.length - 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setActiveProofIndex(activeProofIndex + 1); }}
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
                src={proofPreviewUrls[activeProofIndex]!} 
                onClick={(e) => e.stopPropagation()}
                className="w-full h-full bg-white rounded-xl shadow-2xl" 
                title="Fullscreen Proof PDF" 
              />
            ) : (
              <img 
                src={proofPreviewUrls[activeProofIndex]!} 
                alt="Fullscreen preview" 
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
    <div ref={containerRef} className={`relative flex flex-col gap-1.5 min-w-[140px] ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}>
      <label className="text-[12px] font-medium text-[#181d26] px-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-3 text-[13px] font-medium text-[#181d26] bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 hover:border-[#1b61c9] transition-all focus:outline-none cursor-pointer disabled:cursor-not-allowed w-full text-left"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown size={14} className={`text-[#9297a0] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-[#dddddd] rounded-[6px] shadow-sm z-50 overflow-hidden max-h-60 overflow-y-auto py-1 scrollbar-thin"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-medium text-[#41454d] hover:bg-[#f8fafc] hover:text-[#181d26] text-left transition-all ${
                  opt.value === value ? "bg-[#f8fafc] text-[#181d26] font-semibold" : ""
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {opt.value === value && <Check size={14} className="text-[#181d26]" />}
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
