"use client";

import { useState } from "react";
import { Eye, X, Receipt, Calendar, Tag, FileText, DollarSign, Image as ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ProofViewerModal, ProofViewerButton } from "@/components/ProofViewerModal";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface FinanceDetailsModalProps {
  type: "income" | "expense";
  item: {
    id: number | string;
    title: string;
    amount: number;
    category: string;
    date: Date | string;
    img?: string | null;
    referenceType?: string | null;
    referenceId?: string | null;
  };
}

export default function FinanceDetailsModal({ type, item }: FinanceDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewActiveIdx, setPreviewActiveIdx] = useState(0);
  const { t, locale } = useLanguage();

  const isIncome = type === "income";
  const proofUrls = item.img ? item.img.split(",").filter(Boolean) : [];

  const getCategoryColor = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes("tuition") || c.includes("salary")) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (c.includes("donation") || c.includes("utilit")) return "text-blue-700 bg-blue-50 border-blue-200";
    if (c.includes("event") || c.includes("equip")) return "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200";
    if (c.includes("grant") || c.includes("maintenance")) return "text-orange-700 bg-orange-50 border-orange-200";
    return "text-slate-700 bg-slate-50 border-slate-200";
  };

  const modalTitle = isIncome
    ? (t.crud as any)?.incomeDetails || (locale === "ar" ? "تفاصيل الدخل" : locale === "fr" ? "Détails du revenu" : "Income Details")
    : (t.crud as any)?.expenseDetails || (locale === "ar" ? "تفاصيل المصروف" : locale === "fr" ? "Détails de la dépense" : "Expense Details");

  const formattedDate = new Date(item.date).toLocaleDateString(
    locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <>
      {/* TRIGGER BUTTON */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d]"
        title={modalTitle}
      >
        <Eye size={16} strokeWidth={2} />
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
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                    <Receipt className="w-5 h-5" />
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

              {/* AMOUNT & CATEGORY HERO CARD */}
              <div className={`p-5 rounded-2xl border mb-6 flex items-center justify-between ${isIncome ? "bg-emerald-50/50 border-emerald-100" : "bg-rose-50/50 border-rose-100"}`}>
                <div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    {t.crud.fields["Amount (DT)"] || "Amount"}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-extrabold ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                      {isIncome ? "+" : "-"}{item.amount.toLocaleString()}
                    </span>
                    <span className="text-sm font-bold text-slate-400">DT</span>
                  </div>
                </div>

                <span className={`inline-block px-3 py-1.5 rounded-lg text-xs font-bold border uppercase tracking-wider ${getCategoryColor(item.category)}`}>
                  {t.categories[item.category.toUpperCase() as keyof typeof t.categories] || item.category}
                </span>
              </div>

              {/* DETAILS GRID */}
              <div className="flex flex-col gap-4 mb-6">
                {/* Description */}
                <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                  <FileText className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                      {isIncome ? t.crud.fields["Source/Description"] || "Source/Description" : t.crud.fields["Description"] || "Description"}
                    </span>
                    <span className="text-sm font-medium text-slate-800 leading-relaxed">
                      {item.title}
                    </span>
                  </div>
                </div>

                {/* Date & Category Info */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        {t.crud.fields["Date"] || "Date"}
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {formattedDate}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <Tag className="w-4 h-4 text-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-slate-400 block mb-0.5">
                        {t.crud.fields["Category"] || "Category"}
                      </span>
                      <span className="text-sm font-medium text-slate-700">
                        {t.categories[item.category.toUpperCase() as keyof typeof t.categories] || item.category}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PROOFS ATTACHMENT SECTION */}
              <div className="border-t border-slate-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-slate-500" />
                    {(t.crud as any)?.uploadedProofs || "Uploaded Proofs"} ({proofUrls.length})
                  </span>

                  {proofUrls.length > 0 && (
                    <ProofViewerButton
                      proofUrl={item.img}
                      viewText={isIncome ? t.incomesPage.viewProof : t.expensesPage.viewProof}
                      missingText={isIncome ? t.incomesPage.missingProof : t.expensesPage.missingProof}
                    />
                  )}
                </div>

                {proofUrls.length > 0 ? (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {proofUrls.map((url, idx) => {
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
                                {(t.crud as any)?.pdfDocument || "PDF Doc"}
                              </span>
                            </div>
                          ) : (
                            <Image
                              src={url}
                              alt={`Proof ${idx + 1}`}
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
                    {isIncome ? t.incomesPage.missingProof : t.expensesPage.missingProof}
                  </div>
                )}
              </div>

              {/* PROOF LIGHTBOX */}
              <ProofViewerModal
                urls={proofUrls}
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
