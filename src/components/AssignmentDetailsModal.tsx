"use client";

import { useState } from "react";
import {
  Eye,
  X,
  BookOpen,
  Calendar,
  Users,
  FileText,
  Image as ImageIcon,
  GraduationCap,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ProofViewerModal } from "@/components/ProofViewerModal";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface AssignmentDetailsModalProps {
  item: {
    id: number | string;
    title: string;
    description?: string | null;
    dueDate: Date | string;
    startDate?: Date | string;
    img?: string | null;
    lesson: {
      subject: { name: string };
      class: { name: string };
      teacher: { name: string; surname: string };
    };
  };
}

function getTranslatedSubject(subjectStr: string, locale: string): string {
  if (!subjectStr) return "";
  const parts = subjectStr.split("|").map((p) => p.trim());
  if (parts.length >= 3) {
    if (locale === "ar") return parts[0];
    if (locale === "fr") return parts[1];
    return parts[2];
  }
  return subjectStr;
}

export default function AssignmentDetailsModal({
  item,
}: AssignmentDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveIdx, setPreviewActiveIdx] = useState(0);
  const { t, locale } = useLanguage();

  const attachmentUrls = item.img ? item.img.split(",").filter(Boolean) : [];

  const formattedStartDate = new Date(item.startDate || item.dueDate).toLocaleDateString(
    locale === "ar"
      ? "ar-EG-u-nu-latn"
      : locale === "fr"
      ? "fr-FR"
      : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const subjectName = getTranslatedSubject(item.lesson.subject.name, locale);

  return (
    <>
      {/* TRIGGER BUTTON — matches edit/delete style exactly */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-[#dddddd] text-[#0055d4] hover:bg-blue-50 hover:border-blue-200 transition-colors"
        title="View Assignment Details"
      >
        <Eye size={14} />
      </button>

      {/* MODAL */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />

            {/* MODAL CONTAINER */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-[16px] shadow-2xl border border-slate-200 max-w-lg w-full relative max-h-[90vh] overflow-y-auto custom-scrollbar z-10 p-6"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50 text-blue-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      {t.assignmentsPage.modal.detailsTitle}
                    </h2>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: #{item.id}
                    </span>
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

              {/* HERO CARD — Title & Subject */}
              <div className="p-5 rounded-2xl border mb-6 bg-blue-50/50 border-blue-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                  {t.assignmentsPage.modal.taskTitle}
                </span>
                <p className="text-xl font-extrabold text-slate-800 leading-snug">
                  {item.title}
                </p>
                <span className="mt-2 inline-block px-3 py-1 rounded-lg text-xs font-bold border uppercase tracking-wider bg-blue-100 text-blue-700 border-blue-200">
                  {subjectName}
                </span>
              </div>

              {/* DETAILS GRID */}
              <div className="flex flex-col gap-3 mb-6">
                {/* Description */}
                {item.description && (
                  <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        {t.assignmentsPage.modal.description}
                      </span>
                      <span className="text-sm font-medium text-slate-800 leading-relaxed">
                        {item.description}
                      </span>
                    </div>
                  </div>
                )}

                {/* Due Date & Class */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        {t.assignmentsPage.modal.dateOfCreation}
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {formattedStartDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Users className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        {t.assignmentsPage.modal.class}
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {item.lesson.class.name}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Teacher */}
                <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                      {t.assignmentsPage.modal.teacher}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {item.lesson.teacher.name} {item.lesson.teacher.surname}
                    </span>
                  </div>
                </div>
              </div>

              {/* ATTACHMENTS SECTION */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    {t.assignmentsPage.modal.attachments.split(' (')[0]} ({attachmentUrls.length})
                  </span>
                </div>

                {attachmentUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {attachmentUrls.map((url, idx) => {
                      const isPdf =
                        url.toLowerCase().split("?")[0].endsWith(".pdf");
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
                              <FileText
                                size={28}
                                className="text-rose-500 mb-1"
                              />
                              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[80px]">
                                {(t.crud as any)?.pdfDocument || "PDF Doc"}
                              </span>
                            </div>
                          ) : (
                            <Image
                              src={url}
                              alt={`Attachment ${idx + 1}`}
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
                    {t.assignmentsPage.modal.noAttachments}
                  </div>
                )}
              </div>

              {/* LIGHTBOX */}
              <ProofViewerModal
                urls={attachmentUrls}
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
