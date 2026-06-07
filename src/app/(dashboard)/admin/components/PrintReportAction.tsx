"use client";

import React from 'react';
import { FileText } from 'lucide-react';
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
    <button 
      onClick={handlePrint}
      className="group flex items-center gap-2 px-4 py-2.5 bg-[#ffffff] border border-[#d8d8d8] text-[#080808] rounded-[4px] font-medium hover:bg-[#f9f9f9] transition-all"
    >
      <FileText size={16} className="text-[#080808] group-hover:scale-110 transition-transform" />
      <span className="text-[14px]">{t.adminWidgets.export}</span>
    </button>
  );
};

export default PrintReportAction;
