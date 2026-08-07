"use client";

import { useState } from "react";
import { Eye, X, FileText, Calendar, BookOpen, Users, User, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ProofViewerModal, ProofViewerButton } from "@/components/ProofViewerModal";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface ResourceDetailsModalProps {
  item: any;
}

export default function ResourceDetailsModal({ item }: ResourceDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveIdx, setPreviewActiveIdx] = useState(0);
  const { t, locale } = useLanguage();

  const fileUrls = item.url ? item.url.split(",").filter(Boolean) : [];

  const modalTitle = t.resourcesPage?.viewFile || "Resource Details";

  const formattedDate = new Date(item.createdAt).toLocaleDateString(
    locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]"
        title={modalTitle}
      >
        <Eye size={16} strokeWidth={2} />
      </button>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[16px] shadow-2xl border border-slate-200 max-w-lg w-full relative max-h-[90vh] overflow-y-auto custom-scrollbar z-10 p-6"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">{modalTitle}</h2>
                    <span className="text-xs text-slate-400 font-mono">ID: #{item.id}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* TITLE HERO CARD */}
              <div className="p-5 rounded-2xl border mb-6 bg-indigo-50/50 border-indigo-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  Title
                </span>
                <span className="text-xl font-bold text-indigo-700 block leading-tight">
                  {item.title}
                </span>
              </div>

              {/* DETAILS GRID */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <BookOpen className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        Subject
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {item.lesson.subject.name.split('|')[0].trim()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        Class
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {item.lesson.class.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <User className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        Teacher
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {item.lesson.teacher.name} {item.lesson.teacher.surname}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        Date Uploaded
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {formattedDate}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FILES ATTACHMENT SECTION */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    Attached Files ({fileUrls.length})
                  </span>

                  {fileUrls.length > 0 && (
                    <ProofViewerButton
                      proofUrl={item.url}
                      viewText="View All"
                      missingText="No files attached"
                    />
                  )}
                </div>

                {fileUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {fileUrls.map((url: string, idx: number) => {
                      const isPdf = url.toLowerCase().split("?")[0].endsWith(".pdf");
                      return (
                        <div
                          key={`${url}-${idx}`}
                          onClick={() => {
                            setPreviewActiveIdx(idx);
                            setPreviewOpen(true);
                          }}
                          className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 bg-white group shadow-sm flex flex-col items-center justify-center cursor-pointer transition-all hover:shadow-md hover:border-slate-300"
                        >
                          {isPdf ? (
                            <div className="flex flex-col items-center justify-center p-2 text-center bg-slate-50 w-full h-full">
                              <FileText size={28} className="text-rose-500 mb-1" />
                              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[80px]">
                                PDF Doc
                              </span>
                            </div>
                          ) : (
                            <Image
                              src={url}
                              alt={`File ${idx + 1}`}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          )}

                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center z-10">
                            <span className="w-8 h-8 rounded-full bg-white text-slate-800 flex items-center justify-center shadow-lg">
                              <Eye size={16} />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-xs text-slate-400 font-medium">
                    No files attached
                  </div>
                )}
              </div>

              {/* PROOF LIGHTBOX */}
              <ProofViewerModal
                urls={fileUrls}
                initialIndex={previewActiveIdx}
                isOpen={previewOpen}
                onClose={() => setPreviewOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
