"use client";

import Link from "next/link";
import { Sparkles, ClipboardCheck, ArrowRight, Calendar, Lock } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

const AiPlaygroundLanding = () => {
  const { t, locale } = useLanguage();

  return (
    <div className="relative flex flex-col items-center justify-center w-full min-h-[calc(100vh-60px)] bg-[#f8fafc] font-sans overflow-hidden py-8">
      
      {/* Blurred background content */}
      <div className="w-full flex flex-col items-center justify-center filter blur-[6px] opacity-40 select-none pointer-events-none">
        {/* Hero Band */}
        <div className="w-full max-w-[1280px] px-12 pb-8 flex flex-col items-center text-center">
          <div className="flex items-center justify-center text-[#181d26] mb-4">
            <Sparkles size={24} className="stroke-[2px]" />
          </div>
          
          <h1 className="text-[32px] md:text-[40px] font-normal text-[#181d26] leading-[1.1] tracking-normal max-w-3xl">
            {t.aiPlayground.title}
          </h1>
          
          <p className="text-[14px] font-medium text-[#41454d] mt-4 max-w-2xl leading-[1.4]">
            {t.aiPlayground.subtitle}
          </p>
        </div>

        {/* Workspace Cards Grid */}
        <div className="w-full max-w-[1280px] px-12 pb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Card 1: Timetable Scheduler */}
          <div className="flex flex-col bg-[#ffffff] border border-[#dddddd] shadow-sm rounded-[8px] p-8 md:p-10 h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[4px] h-full bg-amber-500 rounded-l-[8px]" />
            <div className="flex items-center gap-2 text-amber-600 mb-6">
              <Calendar size={20} className="stroke-[2px]" />
            </div>

            <h2 className="text-[24px] md:text-[28px] font-normal text-[#181d26] leading-[1.2] mb-3">
              {t.aiPlayground.weekly}
            </h2>
            
            <p className="text-[14px] font-medium text-[#41454d] leading-[1.4] mb-8 flex-grow max-w-[400px]">
              {t.aiPlayground.weeklyDesc}
            </p>

            <div className="inline-flex items-center justify-center gap-2 bg-[#181d26] text-white text-[13px] font-medium rounded-[6px] px-4 py-2.5 w-max">
              {t.aiPlayground.enter}
              <ArrowRight size={14} className="stroke-[2px]" />
            </div>
          </div>

          {/* Card 2: Exam Scheduler */}
          <div className="flex flex-col bg-[#ffffff] border border-[#dddddd] shadow-sm rounded-[8px] p-8 md:p-10 h-full relative overflow-hidden">
            <div className="absolute top-0 left-0 w-[4px] h-full bg-emerald-500 rounded-l-[8px]" />
            <div className="flex items-center gap-2 text-emerald-600 mb-6">
              <ClipboardCheck size={20} className="stroke-[2px]" />
            </div>

            <h2 className="text-[24px] md:text-[28px] font-normal text-[#181d26] leading-[1.2] mb-3">
              {t.aiPlayground.exam}
            </h2>
            
            <p className="text-[14px] font-medium text-[#41454d] leading-[1.4] mb-8 flex-grow max-w-[400px]">
              {t.aiPlayground.examDesc}
            </p>

            <div className="inline-flex items-center justify-center gap-2 bg-[#181d26] text-white text-[13px] font-medium rounded-[6px] px-4 py-2.5 w-max">
              {t.aiPlayground.enter}
              <ArrowRight size={14} className="stroke-[2px]" />
            </div>
          </div>

        </div>
      </div>

      {/* Lock Overlay Modal */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/15 backdrop-blur-[4px]">
        <div className="bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-2xl rounded-3xl p-8 md:p-12 max-w-lg w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-6 shadow-inner">
            <Lock size={32} className="stroke-[2.2px]" />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-100/60">
            <Sparkles size={14} />
            {t.aiPlayground.comingSoon}
          </div>

          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-3 tracking-tight">
            {t.aiPlayground.lockedTitle}
          </h2>

          <p className="text-slate-600 text-sm md:text-base leading-relaxed mb-8 max-w-sm">
            {t.aiPlayground.lockedSubtitle}
          </p>

          <Link
            href="/admin"
            className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl px-6 py-3 transition-all shadow-md hover:shadow-lg w-full sm:w-auto"
          >
            {locale === "ar" ? "العودة للرئيسية" : locale === "fr" ? "Retour au tableau de bord" : "Back to Dashboard"}
          </Link>
        </div>
      </div>

    </div>
  );
};

export default AiPlaygroundLanding;
