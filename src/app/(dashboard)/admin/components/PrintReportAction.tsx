"use client";

import React from 'react';
import { FileText } from 'lucide-react';

interface PrintReportActionProps {
  month: string;
}

const PrintReportAction: React.FC<PrintReportActionProps> = ({ month }) => {
  const handlePrint = () => {
    // Generate the URL safe month label (e.g. "April 2026" -> "April_2026")
    const urlSafeMonth = month.replace(' ', '_');
    window.open(`/admin/audit/${encodeURIComponent(urlSafeMonth)}`, '_blank');
  };

  return (
    <button 
      onClick={handlePrint}
      className="group flex items-center gap-3 px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
    >
      <FileText size={16} className="text-indigo-500 group-hover:scale-110 transition-transform" />
      <span>Print Full Fiscal Review</span>
    </button>
  );
};

export default PrintReportAction;
