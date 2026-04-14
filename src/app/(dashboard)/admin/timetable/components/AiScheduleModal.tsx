"use client";

import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { isAIQuotaReached } from "../../actions/aiActions";
import { bulkUpdateTimetableSlots } from "@/lib/crudActions";
import { X, Sparkles, Loader2, AlertCircle, Check, Calendar, ArrowRight, User, BookOpen, MapPin, Lock } from "lucide-react";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  classContext: { id: number; name: string; level: number };
  subjects: any[];
  teachers: any[];
  generateAction: (prompt: string, context: any, subjects: any[], teachers: any[]) => Promise<{ data?: any[]; error?: string }>;
  saveAction: (slots: any[]) => Promise<{ success: boolean; error?: string }>;
  title: string;
}

export default function AiScheduleModal({ 
  onClose, 
  onSuccess, 
  classContext, 
  subjects, 
  teachers, 
  generateAction,
  saveAction,
  title
}: Props) {
  const [step, setStep] = useState<"input" | "generating" | "review" | "success">("input");
  const [prompt, setPrompt] = useState("");
  const [generatedSlots, setGeneratedSlots] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLocked, setIsLocked] = useState(false);
  const [quota, setQuota] = useState(10);

  useEffect(() => {
    isAIQuotaReached().then(reached => {
      if (reached) setIsLocked(true);
    });
  }, []);

  const handleGenerate = async () => {
    if (isLocked) return;
    if (!prompt.trim()) return;

    setStep("generating");
    setError(null);

    const res = await generateAction(prompt, classContext, subjects, teachers);
    
    if (res.error) {
      setError(res.error);
      setStep("input");
    } else if (res.data) {
      setGeneratedSlots(res.data);
      setStep("review");
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveAction(generatedSlots);
      if (res.success) {
        setStep("success");
        onSuccess?.();
        setTimeout(() => onClose(), 2000);
      } else {
        setError(res.error || "Failed to save schedule.");
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
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800 tracking-tight uppercase">{title}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mt-1">
                Prompt · Generate · Review · Apply
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8 bg-slate-50/50 relative">
          {isLocked && (
            <div className="absolute inset-0 z-50 bg-white/40 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
               <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-200 ring-8 ring-indigo-50">
                  <Lock size={24} />
               </div>
               <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-2">Limite AI Atteinte</h3>
               <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6 max-w-xs">
                  Vous avez utilisé vos {quota} analyses quotidiennes. Passez à **Premium** pour débloquer la génération magique illimitée.
               </p>
               <button className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 font-black">
                  Débloquer Premium
               </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div 
                key="input"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className={`flex flex-col gap-6 ${isLocked ? 'blur-md select-none pointer-events-none grayscale-[0.5]' : ''}`}
              >
                <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                   <AlertCircle size={18} className="text-indigo-600 mt-0.5" />
                   <div className="text-xs text-indigo-700 font-medium leading-relaxed">
                     Describe your ideal schedule for <strong>Grade {classContext.level} - {classContext.name}</strong>. 
                     The AI will try to balance subjects and avoid teacher overlaps.
                   </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instructions for AI</label>
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Example: Put Mathematics in the first slot every morning. Ensure sport is on Wednesday afternoon. Avoid heavy subjects on Saturday."
                    className="w-full h-48 p-6 rounded-3xl border border-slate-200 bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-400 outline-none transition-all text-sm font-medium leading-relaxed resize-none shadow-sm"
                  />
                </div>

                {error && (
                  <p className="text-xs font-bold text-rose-500 bg-rose-50 p-3 rounded-xl border border-rose-100">
                    ⚠️ {error}
                  </p>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={!prompt.trim()}
                  className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                   <Sparkles size={16} />
                   Generate Schedule
                </button>
              </motion.div>
            )}

            {step === "generating" && (
              <motion.div 
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 gap-6"
              >
                <div className="relative">
                  <div className="w-20 h-20 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-indigo-600 animate-pulse">
                    <Calendar size={24} />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="font-black text-slate-800 uppercase tracking-tight">AI is optimizing your schedule...</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Balancing subjects · Verifying teacher availability · Building grid</p>
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
                    <h3 className="font-black text-slate-800 uppercase tracking-tight">Proposed Schedule</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Review the generated slots for the week</p>
                  </div>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black">{generatedSlots.length} Slots Generated</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {generatedSlots.map((slot, i) => {
                    const subject = subjects.find(s => s.id === slot.subjectId);
                    const teacher = teachers.find(t => t.id === slot.teacherId);
                    return (
                      <div key={i} className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{slot.day}</span>
                           <span className="text-[9px] font-bold text-slate-400">Slot {slot.slotNumber}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                           <BookOpen size={14} className="text-slate-400" />
                           <span className="text-xs font-black text-slate-800 uppercase truncate">{subject?.name || "No Subject"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <User size={14} className="text-slate-400" />
                           <span className="text-[10px] font-bold text-slate-500 truncate">{teacher ? `${teacher.name} ${teacher.surname}` : "No Teacher"}</span>
                        </div>
                        <div className="flex items-center justify-between border-t border-slate-50 pt-2 mt-1 text-[9px] font-bold text-slate-400">
                           <div className="flex items-center gap-1">
                              <Calendar size={10} /> {slot.startTime} - {slot.endTime}
                           </div>
                           <div className="flex items-center gap-1">
                              <MapPin size={10} /> {slot.room || "TBA"}
                           </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-4 sticky bottom-0 bg-slate-50/90 backdrop-blur-sm py-4">
                  <button
                    onClick={() => setStep("input")}
                    className="flex-1 py-4 bg-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-300 transition-all uppercase tracking-widest text-xs"
                  >
                    Back to Prompt
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isPending}
                    className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Apply New Schedule
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
                  <h3 className="font-black text-slate-800 uppercase tracking-tight text-xl">Schedule Live!</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">The AI-generated schedule is now active for this class</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
