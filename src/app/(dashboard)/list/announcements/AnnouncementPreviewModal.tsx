"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, X, Calendar, FileText, Download } from "lucide-react";
import { Notice, Class } from "@prisma/client";

type NoticeWithClass = Notice & { class: Class | null };

export default function AnnouncementPreviewModal({ item }: { item: NoticeWithClass }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 px-2 py-1 rounded-[4px] border border-transparent hover:border-indigo-200 bg-transparent hover:bg-indigo-50 transition-all flex items-center gap-1.5"
      >
        <Eye size={14} /> Preview
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-[16px] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[#f1f5f9]">
              <div className="flex flex-col gap-1.5 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase ${item.class ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'}`}>
                    {item.class ? item.class.name : "GLOBAL"}
                  </span>
                  {item.important && (
                    <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200/50">
                      URGENT
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#64748b] ml-2">
                    <Calendar size={12} />
                    {new Intl.DateTimeFormat("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.date))}
                  </span>
                </div>
                <h2 className="text-[22px] font-bold text-[#181d26] leading-snug">{item.title}</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#f1f5f9] text-[#64748b] transition-colors absolute top-6 right-6"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex flex-col gap-6">
              {item.img && (
                <div className="w-full aspect-video rounded-[12px] overflow-hidden border border-[#e2e8f0] relative bg-[#f8fafc]">
                  <Image src={item.img} alt={item.title} fill className="object-contain" />
                </div>
              )}
              
              <div className="text-[15px] leading-relaxed text-[#41454d] whitespace-pre-wrap font-medium">
                {item.message}
              </div>

              {item.pdfUrl && (
                <div className="mt-4 pt-6 border-t border-[#f1f5f9]">
                  <h3 className="text-[13px] font-semibold text-[#181d26] mb-3">Attachments</h3>
                  <a 
                    href={item.pdfUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-4 rounded-[8px] border border-[#e2e8f0] hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-[6px] bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <FileText size={20} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[14px] font-medium text-[#181d26] group-hover:text-indigo-700 transition-colors">Attached Document.pdf</span>
                        <span className="text-[12px] text-[#64748b]">Click to view or download</span>
                      </div>
                    </div>
                    <Download size={18} className="text-[#94a3b8] group-hover:text-indigo-600 transition-colors" />
                  </a>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-[#f1f5f9] bg-[#f8fafc] rounded-b-[16px] flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-white border border-[#dddddd] hover:bg-[#f1f5f9] text-[#181d26] text-[13px] font-semibold rounded-[8px] transition-all shadow-sm"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
