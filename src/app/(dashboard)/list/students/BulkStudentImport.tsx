"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseStudentsFromText, parseStudentsFromImage } from "../../admin/actions/studentAiActions";
import { bulkCreateStudents } from "@/lib/crudActions";
import { X, Check, Loader2, AlertCircle, Rocket, FileText, UserPlus, Image as ImageIcon, Type, Users } from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";

export default function BulkStudentImport({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"input" | "parsing" | "review" | "success">("input");
  const [importMode, setImportMode] = useState<"text" | "image">("text");
  const [rawText, setRawText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleParse = async () => {
    if (importMode === "text" && !rawText.trim()) return;
    if (importMode === "image" && !imageUrl) return;

    setStep("parsing");
    setError(null);

    const result = importMode === "text" 
      ? await parseStudentsFromText(rawText)
      : await parseStudentsFromImage(imageUrl!);

    if (result.error) {
      setError(result.error);
      setStep("input");
    } else if (result.data) {
      setParsedData(result.data);
      setStep("review");
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await bulkCreateStudents(parsedData);
      if (res.success) {
        setStep("success");
        setTimeout(() => onClose(), 2000);
      } else {
        setError(res.error || "Failed to save students.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-sky-600 flex items-center justify-center shadow-lg shadow-sky-100">
              <Users size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">AI Student Bulk Import</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Vision · Parse · Review · Enroll</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-auto p-8 bg-slate-50/50">
          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col gap-6"
              >
                {/* MODE TOGGLE */}
                <div className="flex p-1 bg-slate-100 rounded-2xl w-fit self-center border border-slate-200 shadow-inner">
                  <button
                    onClick={() => setImportMode("text")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      importMode === "text" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Type size={14} />
                    Paste Text
                  </button>
                  <button
                    onClick={() => setImportMode("image")}
                    className={`flex items-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      importMode === "image" ? "bg-white text-sky-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <ImageIcon size={14} />
                    Upload Image
                  </button>
                </div>

                <div className="bg-sky-50 border border-sky-100 p-4 rounded-2xl flex items-start gap-3">
                   <AlertCircle size={18} className="text-sky-600 mt-0.5" />
                   <p className="text-xs text-sky-700 font-medium leading-relaxed">
                     {importMode === "text" 
                        ? "Paste your list of students below. Include names, genders, and parent details. AI will handle the structure."
                        : "Upload a photo of your classroom register or enrollment forms. AI Vision will read and extract all details."}
                   </p>
                </div>
                
                {importMode === "text" ? (
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder="Example: John Doe, Male, Class 1A, Parent: Robert Doe, +12345678..."
                    className="w-full h-64 p-6 rounded-3xl border border-slate-200 bg-white focus:ring-4 focus:ring-sky-50 focus:border-sky-400 outline-none transition-all text-sm font-medium leading-relaxed resize-none shadow-sm"
                  />
                ) : (
                  <div className="w-full h-64 rounded-3xl border-2 border-dashed border-slate-200 bg-white flex flex-col items-center justify-center gap-4 group hover:border-sky-400 transition-colors overflow-hidden">
                    {imageUrl ? (
                      <div className="relative w-full h-full">
                        <Image src={imageUrl} alt="Document" fill className="object-contain" />
                        <button 
                           onClick={() => setImageUrl(null)}
                           className="absolute top-4 right-4 p-2 bg-slate-900/50 text-white rounded-full backdrop-blur-sm hover:bg-slate-900/80 transition-all"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <CldUploadWidget
                        uploadPreset="school_grade_sheets"
                        onSuccess={(result: any) => {
                          if (result.info && typeof result.info !== "string") {
                            setImageUrl(result.info.secure_url);
                          }
                        }}
                      >
                        {({ open }) => (
                          <button
                            onClick={() => open()}
                            className="flex flex-col items-center gap-3"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all">
                              <ImageIcon size={24} />
                            </div>
                            <div className="text-center">
                              <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Select Image</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">PNG, JPG, OR PDF SCAN</p>
                            </div>
                          </button>
                        )}
                      </CldUploadWidget>
                    )}
                  </div>
                )}

                {error && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                    ⚠️ {error}
                  </p>
                )}

                <button
                  onClick={handleParse}
                  disabled={importMode === "text" ? !rawText.trim() : !imageUrl}
                  className="w-full py-4 bg-sky-600 text-white font-black rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                   {importMode === "image" ? <ImageIcon size={14} /> : <FileText size={14} />}
                   ✨ Start AI Extraction
                </button>
              </motion.div>
            )}

            {step === "parsing" && (
              <motion.div 
                key="parsing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-6"
              >
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-100 border-t-sky-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-sky-600 animate-pulse">
                    <Users size={24} />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">AI is analyzing student data...</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Vision parsing · Parent mapping · Grouping classes</p>
                </div>
              </motion.div>
            )}

            {step === "review" && (
              <motion.div 
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col gap-6"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">Review Extraction</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verify student and parent data before saving</p>
                  </div>
                  <span className="px-3 py-1 bg-sky-50 text-sky-600 rounded-xl text-[10px] font-black">{parsedData.length} Students Found</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Student</th>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Gender</th>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Parent Details</th>
                        <th className="text-right px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Class ID</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((s, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-700">{s.name} {s.surname || ""}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${
                              s.sex === "MALE" ? "bg-blue-50 text-blue-600" : "bg-pink-50 text-pink-600"
                            }`}>
                              {s.sex}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-600">{s.parentName} {s.parentSurname}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{s.parentPhone || "No Phone"}</p>
                          </td>
                          <td className="px-4 py-3 text-right font-black text-slate-800">#{s.classId || 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep("input")}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                  >
                    Back to Edit
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex-[2] py-4 bg-sky-600 text-white font-black rounded-2xl shadow-xl shadow-sky-100 hover:bg-sky-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Finalize & Enroll Students
                  </button>
                </div>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div 
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-6"
              >
                <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center shadow-inner">
                  <Check size={40} />
                </div>
                <div className="text-center">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Enrollment Success!</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">All students have been added to the database</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
