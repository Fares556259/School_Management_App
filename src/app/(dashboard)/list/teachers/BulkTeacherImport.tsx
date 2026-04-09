"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { parseTeachersFromText } from "../../admin/actions/teacherAiActions";
import { bulkCreateTeachers } from "@/lib/crudActions";
import { X, Check, Loader2, AlertCircle, Rocket, FileText, UserPlus } from "lucide-react";

export default function BulkTeacherImport({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<"input" | "parsing" | "review" | "success">("input");
  const [rawText, setRawText] = useState("");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleParse = async () => {
    if (!rawText.trim()) return;
    setStep("parsing");
    setError(null);

    const result = await parseTeachersFromText(rawText);
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
      const res = await bulkCreateTeachers(parsedData);
      if (res.success) {
        setStep("success");
        setTimeout(() => onClose(), 2000);
      } else {
        setError(res.error || "Failed to save teachers.");
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
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <Rocket size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">AI Teacher Bulk Import</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Paste · Parse · Review · Enroll</p>
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
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                   <AlertCircle size={18} className="text-indigo-600 mt-0.5" />
                   <p className="text-xs text-indigo-700 font-medium leading-relaxed">
                     Paste your list of teachers below. You can include names, emails, phone numbers, and salaries. 
                     Our AI will automatically structure everything for you.
                   </p>
                </div>
                
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Example:
John Doe, j.doe@school.com, +123456789, Math Teacher
Jane Smith, jane@example.com, Female, 3500 salary"
                  className="w-full h-64 p-6 rounded-3xl border border-slate-200 bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all text-sm font-medium leading-relaxed resize-none shadow-sm"
                />

                {error && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                    ⚠️ {error}
                  </p>
                )}

                <button
                  onClick={handleParse}
                  disabled={!rawText.trim()}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  ✨ Start AI Parsing
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
                  <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600 animate-pulse">
                    <FileText size={24} />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">AI is analyzing your data...</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Structuring teach profiles · mapping fields</p>
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
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Verify and edit parsed data before saving</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black">{parsedData.length} Teachers Found</span>
                </div>

                <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Teacher</th>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Contact</th>
                        <th className="text-left px-4 py-3 font-black text-slate-400 uppercase tracking-widest">username</th>
                        <th className="text-right px-4 py-3 font-black text-slate-400 uppercase tracking-widest">Salary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.map((t, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-700">{t.name} {t.surname} <span className="text-[10px] text-slate-300 ml-1">({t.sex[0]})</span></td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-600">{t.email || "No Email"}</p>
                            <p className="text-[10px] text-slate-400">{t.phone || "No Phone"}</p>
                          </td>
                          <td className="px-4 py-3 font-mono text-indigo-500">{t.username}</td>
                          <td className="px-4 py-3 text-right font-black text-slate-800">${t.salary}</td>
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
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                    Finalize & Enroll Teachers
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
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">All teachers have been added to the database</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
