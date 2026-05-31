"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, Loader2 } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isPending?: boolean;
  variant?: "danger" | "warning" | "primary";
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isPending = false,
  variant = "danger",
}: ConfirmModalProps) {
  
  const variantStyles = {
    danger: {
      iconBg: "bg-red-100",
      iconText: "text-red-600",
      button: "bg-red-600 hover:bg-red-700 text-white border-transparent",
    },
    warning: {
      iconBg: "bg-orange-100",
      iconText: "text-orange-600",
      button: "bg-orange-600 hover:bg-orange-700 text-white border-transparent",
    },
    primary: {
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      button: "bg-[#1b61c9] hover:bg-[#154b9e] text-white border-transparent",
    },
  };

  const style = variantStyles[variant];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* BACKDROP */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={!isPending ? onClose : undefined}
            className="fixed inset-0 z-50 bg-[#181d26]/40 backdrop-blur-[2px]"
          />

          {/* MODAL */}
          <div className="fixed inset-0 z-[51] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="w-full max-w-md bg-white rounded-[20px] shadow-xl border border-[#dddddd] overflow-hidden pointer-events-auto"
            >
              {/* MODAL HEADER */}
              <div className="flex items-start justify-between p-6 pb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${style.iconBg} ${style.iconText}`}>
                  <AlertCircle size={24} strokeWidth={2} />
                </div>
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#41454d] hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>

              {/* MODAL CONTENT */}
              <div className="px-6 pb-8">
                <h3 className="text-[20px] font-semibold text-[#181d26] mb-3 tracking-tight">
                  {title}
                </h3>
                <div className="text-[14px] text-[#41454d] leading-relaxed">
                  {message}
                </div>
              </div>

              {/* MODAL FOOTER */}
              <div className="bg-slate-50 border-t border-[#dddddd] px-6 py-4 flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isPending}
                  className="px-5 py-2.5 rounded-[8px] border border-[#dddddd] bg-white text-[#181d26] text-[14px] font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={isPending}
                  className={`px-5 py-2.5 rounded-[8px] text-[14px] font-semibold flex items-center gap-2 transition-all disabled:opacity-70 ${style.button}`}
                >
                  {isPending && <Loader2 size={16} className="animate-spin" />}
                  {confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
