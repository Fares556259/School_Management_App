"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, X, ChevronLeft, ChevronRight, FileText, FileX } from "lucide-react";

interface ProofViewerModalProps {
  urls: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ProofViewerModal({
  urls,
  initialIndex = 0,
  isOpen,
  onClose,
}: ProofViewerModalProps) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  if (!isOpen || urls.length === 0) return null;

  const safeIndex = Math.min(Math.max(0, activeIndex), urls.length - 1);
  const currentUrl = urls[safeIndex];
  if (!currentUrl) return null;

  const isPdf =
    currentUrl.toLowerCase().split("?")[0].endsWith(".pdf") ||
    currentUrl.includes("/raw/upload/");

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed:", error);
      window.open(url, "_blank");
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center"
        onClick={onClose}
      >
        {/* Top Controls Bar */}
        <div
          className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div dir="ltr" className="text-white/80 font-medium text-sm bg-black/40 px-3.5 py-1.5 rounded-lg backdrop-blur-md border border-white/10 shadow-lg">
            {safeIndex + 1} / {urls.length}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(currentUrl, `Proof-${safeIndex + 1}`);
              }}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md"
              title="Download File"
            >
              <Download size={20} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all shadow-md"
              title="Close Preview"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Arrows */}
        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev - 1 + urls.length) % urls.length);
              }}
              className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-md transition-all z-20 shadow-lg"
              title="Previous"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex((prev) => (prev + 1) % urls.length);
              }}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center backdrop-blur-md transition-all z-20 shadow-lg"
              title="Next"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}

        {/* Content Display */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full h-full max-w-6xl max-h-[88vh] p-8 md:p-16 flex items-center justify-center z-10"
          onClick={(e) => e.stopPropagation()}
        >
          {isPdf ? (
            <iframe
              src={currentUrl}
              className="w-full h-full bg-white rounded-xl shadow-2xl border border-white/20"
              title="Proof PDF Preview"
            />
          ) : (
            <img
              src={currentUrl}
              alt="Proof Preview"
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                objectFit: "contain",
              }}
              className="rounded-xl shadow-2xl border border-white/10"
            />
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ProofViewerButton({
  proofUrl,
  viewText = "View Proof",
  missingText = "Missing Proof",
}: {
  proofUrl?: string | null;
  viewText?: string;
  missingText?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const urls = proofUrl ? proofUrl.split(",").filter(Boolean) : [];

  if (urls.length === 0) {
    return (
      <div className="flex items-center gap-1.5 text-rose-500 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-md w-max">
        <FileX className="w-3.5 h-3.5 opacity-70" />
        <span className="text-xs font-semibold">{missingText}</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setActiveIdx(0);
          setIsOpen(true);
        }}
        className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md w-max hover:bg-emerald-100 hover:shadow-sm transition-all"
      >
        <FileText className="w-3.5 h-3.5" />
        <span className="text-xs font-semibold">
          {viewText} {urls.length > 1 ? `(${urls.length})` : ""}
        </span>
      </button>

      <ProofViewerModal
        urls={urls}
        initialIndex={activeIdx}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
