"use client";

import { useState, useRef, useTransition, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createGradeSheet, GradeEntry } from "./actions";


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
  onClose,
  onCloseRedirect,
}: Props) {
  const router = useRouter();
  const [classId, setClassId] = useState<number>(initialClassId ?? classes[0]?.id ?? 0);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [subjectId, setSubjectId] = useState<number>(subjects[0]?.id ?? 0);
  const [term, setTerm] = useState<number>(initialTerm);
  const [teacherId, setTeacherId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [grades, setGrades] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [zoom, setZoom] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleClassChange = async (newId: number) => {
    setClassId(newId);
    setIsLoadingStudents(true);
    try {
      // Fetch students for the new class
      const response = await fetch(`/api/students?classId=${newId}`);
      const data = await response.json();
      setStudents(data);
      setGrades({}); // Reset grades when class changes
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
    setProofPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setProofFile(file);
    setProofPreviewUrl(URL.createObjectURL(file));
  }, []);

  const handleGradeChange = (studentId: string, value: string) => {
    setGrades((prev) => ({ ...prev, [studentId]: value }));
  };

  const fillAll = (value: string) => {
    const all: Record<string, string> = {};
    students.forEach((s) => (all[s.id] = value));
    setGrades(all);
  };

  const handleSave = () => {
    if (!proofPreviewUrl && !proofFile) {
      alert("Please upload a proof document before saving.");
      return;
    }

    const gradeEntries: GradeEntry[] = students.map((s) => ({
      studentId: s.id,
      score: grades[s.id] !== undefined && grades[s.id] !== "" ? parseFloat(grades[s.id]) : null,
    }));

    startTransition(async () => {
      try {
        // In a real app, you'd upload proofFile to storage first and get a URL back.
        // Here we simulate with a placeholder or the object URL.
        const proofUrl = proofPreviewUrl ?? "pending_upload";

        await createGradeSheet({
          classId,
          subjectId,
          term,
          proofUrl,
          teacherId: teacherId || undefined,
          notes,
          grades: gradeEntries,
        });
        setSaveStatus("success");
        setTimeout(() => {
          setSaveStatus("idle");
          handleClose();
        }, 1500);
      } catch (err) {
        console.error(err);
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

          <button
            onClick={handleSave}
            disabled={isPending || isLoadingStudents}
            className="px-5 py-2 bg-indigo-600 text-white text-[10px] font-black rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 uppercase tracking-widest shadow-lg shadow-indigo-100"
          >
            {isPending ? "Saving…" : "Save Sheet"}
          </button>
          
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
        <SelectField label="Class" value={String(classId)} onChange={(v) => handleClassChange(Number(v))}>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>

        <SelectField label="Subject" value={String(subjectId)} onChange={(v) => setSubjectId(Number(v))}>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </SelectField>

        <SelectField label="Term" value={String(term)} onChange={(v) => setTerm(Number(v))}>
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
        <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">📄 Original Document</span>
            {proofPreviewUrl && (
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center">−</button>
                <span className="text-[10px] font-black text-slate-500">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold flex items-center justify-center">+</button>
              </div>
            )}
          </div>

          <div
            className="flex-1 overflow-auto flex items-center justify-center p-4"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {proofPreviewUrl ? (
              isPdf ? (
                <iframe src={proofPreviewUrl} className="w-full h-full rounded-2xl border border-slate-200 bg-white shadow-lg" title="Proof PDF" />
              ) : (
                <img
                  src={proofPreviewUrl}
                  alt="Proof document"
                  className="rounded-2xl shadow-2xl border border-slate-200 transition-transform duration-300"
                  style={{ transform: `scale(${zoom})`, transformOrigin: "center top", maxWidth: "none" }}
                />
              )
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center gap-4 p-12 border-2 border-dashed border-slate-300 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group cursor-pointer"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-200 group-hover:bg-indigo-100 flex items-center justify-center transition-all text-2xl">📄</div>
                <div className="text-center">
                  <p className="font-black text-slate-600 group-hover:text-indigo-600 transition-colors">Upload Grade Sheet Proof</p>
                  <p className="text-xs text-slate-400 mt-1">Drag & drop or click · JPG, PNG, or PDF</p>
                </div>
              </button>
            )}
          </div>

          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />

          {proofPreviewUrl && (
            <div className="p-3 bg-white border-t border-slate-100 flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 text-[10px] font-black text-slate-500 uppercase tracking-widest py-2 rounded-xl bg-slate-50 hover:bg-slate-100 transition-all border border-slate-100"
              >
                Replace Document
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Editable Grades Table */}
        <div className="w-1/2 flex flex-col overflow-hidden">
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
            {isLoadingStudents && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest animate-pulse">Loading Students…</span>
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

                  return (
                    <tr key={student.id} className={`border-b border-slate-50 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"} hover:bg-indigo-50/30 transition-colors group`}>
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
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 3 students absent, paper submitted on April 08"
              rows={2}
              className="w-full text-sm text-slate-700 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-all"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Helper compound select */
function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 cursor-pointer"
      >
        {children}
      </select>
    </div>
  );
}
