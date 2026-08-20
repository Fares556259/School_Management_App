"use client";

import React from 'react';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { Lock, Sparkles, CheckCircle2, AlertTriangle, Lightbulb } from 'lucide-react';

interface SmartFinancialInsightsProps {
  income?: number;
  expense?: number;
  breakdown?: any[];
  prevIncome?: number;
  month?: string;
  dailyData?: any[];
  unpaidCount?: number;
  className?: string;
}

const SmartFinancialInsights: React.FC<SmartFinancialInsightsProps> = ({
  className
}) => {
  const { t } = useLanguage();

  return (
    <div className={`bg-[#ffffff] p-6 rounded-[8px] border border-[#d8d8d8] shadow-sm flex flex-col gap-4 relative overflow-hidden ${className || ''}`}>
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-[22px] md:text-[24px] font-normal text-[#181d26] leading-[1.35] tracking-[0.12px]">
            {t.smartInsights.title}
          </h2>
          <div className="px-2 py-0.5 bg-[#f8fafc] border border-[#dddddd] rounded-[6px]">
            <span className="text-[11px] font-medium text-[#41454d] tracking-wide uppercase">
              {t.smartInsights.aiPowered || "AI POWERED"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
        </div>
      </div>

      {/* Container with blurred background preview and lock overlay */}
      <div className="relative w-full flex-1 min-h-[140px]">
        {/* Blurred preview cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 filter blur-[2px] opacity-70 select-none pointer-events-none w-full">
          {/* Card 1: Performance */}
          <div className="rounded-[8px] p-4 flex flex-col gap-3 bg-[#ffffff] border border-[#dddddd] shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={16} />
              </div>
              <h3 className="text-[12px] font-semibold text-[#181d26] uppercase tracking-wide">
                {t.smartInsights.performance}
              </h3>
            </div>
            <p className="text-[13px] font-normal text-[#41454d] leading-relaxed">
              Healthy expense monitoring detected. Operational costs are stable.
            </p>
          </div>

          {/* Card 2: Risks */}
          <div className="rounded-[8px] p-4 flex flex-col gap-3 bg-[#ffffff] border border-[#dddddd] shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-rose-50 text-rose-600">
                <AlertTriangle size={16} />
              </div>
              <h3 className="text-[12px] font-semibold text-[#181d26] uppercase tracking-wide">
                {t.smartInsights.risks}
              </h3>
            </div>
            <p className="text-[13px] font-normal text-[#41454d] leading-relaxed">
              Revenue collection is lower than expected. Focus on pending student tuition.
            </p>
          </div>

          {/* Card 3: Opportunities */}
          <div className="rounded-[8px] p-4 flex flex-col gap-3 bg-[#ffffff] border border-[#dddddd] shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
                <Lightbulb size={16} />
              </div>
              <h3 className="text-[12px] font-semibold text-[#181d26] uppercase tracking-wide">
                {t.smartInsights.opportunities}
              </h3>
            </div>
            <p className="text-[13px] font-normal text-[#41454d] leading-relaxed">
              Opportunity to optimize budget based on historical institutional trends.
            </p>
          </div>
        </div>

        {/* Lock Overlay */}
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-slate-900/10 rounded-xl">
          <div className="bg-white/95 border border-slate-200/80 shadow-lg rounded-2xl p-5 md:p-6 max-w-sm w-full text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-sm">
              <Lock size={20} className="stroke-[2.2px]" />
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider mb-2 border border-blue-100/60">
              <Sparkles size={11} />
              {t.smartInsights.comingSoon}
            </div>

            <h3 className="text-base font-extrabold text-slate-900 mb-1 tracking-tight">
              {t.smartInsights.lockedTitle}
            </h3>

            <p className="text-slate-500 text-xs leading-relaxed max-w-xs">
              {t.smartInsights.lockedSubtitle}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartFinancialInsights;
