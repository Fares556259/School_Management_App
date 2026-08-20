"use client";

import React from 'react';
import { FileText, Lock } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';

interface PrintReportActionProps {
  month: string;
}

const PrintReportAction: React.FC<PrintReportActionProps> = ({ month }) => {
  const { t } = useLanguage();
  
  const handlePrint = () => {
    // Generate the URL safe month label (e.g. "April 2026" -> "April_2026")
    const urlSafeMonth = month.replace(' ', '_');
    window.open(`/admin/audit/${encodeURIComponent(urlSafeMonth)}`, '_blank');
  };

  return (
    <div className="relative inline-block cursor-not-allowed group" title={t.smartInsights?.comingSoon || "Coming Soon"}>
      <button 
        disabled
        className="flex items-center gap-2 px-4 py-2.5 bg-[#ffffff] border border-[#d8d8d8] text-[#080808] rounded-[4px] font-medium filter blur-[1px] opacity-60 pointer-events-none"
      >
        <FileText size={16} />
        <span className="text-[14px]">{t.adminWidgets.export}</span>
      </button>

      {/* Small Lock Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
         <div className="flex items-center gap-1 px-2 py-0.5 bg-white/90 border border-slate-200 shadow-sm rounded-full">
           <Lock size={10} className="text-slate-500" />
           <span className="text-[9px] font-bold text-slate-600 uppercase tracking-wider">
             {t.smartInsights?.comingSoon || "Soon"}
           </span>
         </div>
      </div>
    </div>
  );
};

export default PrintReportAction;
