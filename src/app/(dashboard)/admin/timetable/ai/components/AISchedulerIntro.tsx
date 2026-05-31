"use client";

import { useState, useEffect } from "react";
import { BrainCircuit, Zap, ClipboardCheck, ArrowRight } from "lucide-react";

export default function AISchedulerIntro({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(1);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (step === 1) {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d1218] flex flex-col items-center justify-center p-6 overflow-hidden animate-in fade-in duration-1000">
        {/* Animated Background Mesh */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/20 blur-[120px] animate-pulse mix-blend-screen" style={{ animationDuration: '4s' }}></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-500/20 blur-[120px] animate-pulse mix-blend-screen" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>

        <div className="relative z-10 flex flex-col items-center max-w-3xl text-center">
          <div className="relative w-32 h-32 mb-12">
             <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl blur-2xl opacity-50 animate-pulse"></div>
             <div className="relative w-full h-full bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-3xl border border-white/20 flex flex-col items-center justify-center shadow-2xl backdrop-blur-sm animate-bounce" style={{ animationDuration: '3s' }}>
                <BrainCircuit size={48} className="text-white" />
             </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight leading-[1.1] mb-6">
            Stop Scheduling.<br />Start Generating.
          </h1>
          <p className="text-xl text-slate-300 max-w-2xl font-medium leading-relaxed mb-12">
            Welcome to the future of academic planning. SnapSchool AI analyzes millions of combinations to build perfect, conflict-free schedules in seconds.
          </p>

          <button 
            onClick={() => setStep(2)}
            className="group relative inline-flex items-center justify-center gap-3 bg-white text-indigo-950 font-bold text-lg rounded-full px-10 py-5 overflow-hidden transition-transform hover:scale-105 active:scale-95"
          >
            <span className="relative z-10">See How It Works</span>
            <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-purple-100 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col items-center justify-center p-6 overflow-hidden animate-in slide-in-from-right duration-700">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-[100px] opacity-60"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-5xl w-full">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight mb-4">Total Control. Zero Conflicts.</h2>
          <p className="text-lg text-slate-500 font-medium max-w-xl mx-auto">
            Define your constraints, generate drafts in a secure sandbox, and publish only when you're 100% satisfied.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full mb-16">
          {/* Feature 1 */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-indigo-100/40 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6">
               <Zap size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Smart Timetables</h3>
            <p className="text-slate-500 font-medium">
              Automatically balance teacher workloads and prevent room double-bookings across all classes instantly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-xl shadow-purple-100/40 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-6">
               <ClipboardCheck size={32} />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">Stress-Free Exams</h3>
            <p className="text-slate-500 font-medium">
              Automatically distribute tests so students never face multiple difficult exams on the same day.
            </p>
          </div>
        </div>

        <button 
          onClick={onComplete}
          className="group relative inline-flex items-center justify-center gap-3 bg-[#181d26] hover:bg-[#0d1218] text-white font-bold text-lg rounded-[16px] px-10 py-5 transition-all hover:shadow-xl hover:shadow-[#181d26]/20 active:scale-95"
        >
          Enter the Playground
          <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
}
