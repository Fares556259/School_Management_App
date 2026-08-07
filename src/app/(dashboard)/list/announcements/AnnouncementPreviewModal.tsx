"use client";

import { useState } from "react";
import Image from "next/image";
import { Eye, X, Calendar, FileText, Download, FileSpreadsheet, Archive, FileCode } from "lucide-react";
import { Notice, Class } from "@prisma/client";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { ProofViewerModal } from "@/components/ProofViewerModal";

type NoticeWithClass = Notice & { class: Class | null };

export default function AnnouncementPreviewModal({ item }: { item: NoticeWithClass }) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveIdx, setPreviewActiveIdx] = useState(0);
  const { t, locale } = useLanguage();

  const imageUrls = item.img ? item.img.split(",").filter(Boolean) : [];
  const docUrls = item.pdfUrl ? item.pdfUrl.split(",").filter(Boolean) : [];

  const getFileNameFromUrl = (url: string) => {
    try {
      const parts = url.split('/');
      const rawName = parts[parts.length - 1];
      const nameParts = rawName.split('-');
      if (nameParts.length > 2) {
        return nameParts.slice(2).join('-');
      }
      return rawName;
    } catch {
      return "Document";
    }
  };

  const getFileIcon = (url: string) => {
    const ext = url.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-rose-500 shrink-0" />;
    if (['doc', 'docx'].includes(ext)) return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileSpreadsheet className="w-5 h-5 text-emerald-500 shrink-0" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive className="w-5 h-5 text-amber-500 shrink-0" />;
    return <FileCode className="w-5 h-5 text-slate-500 shrink-0" />;
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]"
        title={t.announcementsPage?.previewModal?.preview || "Preview"}
      >
        <Eye size={16} strokeWidth={2} />
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-8"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-[16px] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col relative animate-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-6 border-b border-[#f1f5f9]">
              <div className="flex flex-col gap-1.5 pr-8">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase ${item.class ? 'bg-indigo-50 text-indigo-700 border border-indigo-200/50' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'}`}>
                    {item.class ? `${t.announcementsPage?.filters?.classPrefix || "Class "}${item.class.name}` : (t.announcementsPage?.global || "GLOBAL")}
                  </span>
                  {item.important && (
                    <span className="px-2 py-0.5 rounded-[4px] text-[10px] font-bold tracking-wide uppercase bg-rose-50 text-rose-700 border border-rose-200/50">
                      {t.announcementsPage?.urgent || "URGENT"}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#64748b] ml-2 rtl:mr-2 rtl:ml-0">
                    <Calendar size={12} />
                    {new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(item.date))}
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
              {/* IMAGE GALLERY */}
              {imageUrls.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-[12px] font-semibold text-[#64748b] uppercase tracking-wider">Images ({imageUrls.length})</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {imageUrls.map((url, idx) => (
                      <div
                        key={url}
                        onClick={() => {
                          setPreviewActiveIdx(idx);
                          setPreviewOpen(true);
                        }}
                        className="relative aspect-video rounded-[10px] overflow-hidden border border-[#e2e8f0] bg-[#f8fafc] group cursor-pointer shadow-sm hover:shadow-md transition-all"
                      >
                        <Image src={url} alt={item.title} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow">
                            <Eye size={16} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-[15px] leading-relaxed text-[#41454d] whitespace-pre-wrap font-medium">
                {item.message}
              </div>

              {/* DOCUMENTS LIST */}
              {docUrls.length > 0 && (
                <div className="mt-2 pt-4 border-t border-[#f1f5f9] flex flex-col gap-3">
                  <h3 className="text-[13px] font-semibold text-[#181d26]">{t.announcementsPage?.previewModal?.attachments || "Document Attachments"} ({docUrls.length})</h3>
                  <div className="flex flex-col gap-2">
                    {docUrls.map((url) => (
                      <a 
                        key={url}
                        href={url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-3 rounded-[8px] border border-[#e2e8f0] hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-[6px] bg-slate-100 flex items-center justify-center shrink-0">
                            {getFileIcon(url)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-[13px] font-medium text-[#181d26] group-hover:text-indigo-700 transition-colors truncate">
                              {getFileNameFromUrl(url)}
                            </span>
                            <span className="text-[11px] text-[#64748b]">
                              {t.announcementsPage?.previewModal?.clickToView || "Click to view or download"}
                            </span>
                          </div>
                        </div>
                        <Download size={16} className="text-[#94a3b8] group-hover:text-indigo-600 transition-colors shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-[#f1f5f9] bg-[#f8fafc] rounded-b-[16px] flex justify-end">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 bg-white border border-[#dddddd] hover:bg-[#f1f5f9] text-[#181d26] text-[13px] font-semibold rounded-[8px] transition-all shadow-sm"
              >
                {t.announcementsPage?.previewModal?.closePreview || "Close Preview"}
              </button>
            </div>

            {/* LIGHTBOX FOR IMAGES */}
            <ProofViewerModal
              urls={imageUrls}
              initialIndex={previewActiveIdx}
              isOpen={previewOpen}
              onClose={() => setPreviewOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
