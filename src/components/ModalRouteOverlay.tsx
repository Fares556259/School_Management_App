"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export default function ModalRouteOverlay({ children, closeUrl }: { children: React.ReactNode, closeUrl: string }) {
  const router = useRouter();
  
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  const handleClose = () => {
    router.push(closeUrl);
  };

  return (
    <div className="fixed inset-0 z-[150] flex justify-center items-center p-4 sm:p-6 md:p-10">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="relative z-10 bg-[#f8fafc] rounded-[24px] shadow-2xl w-full max-w-[1400px] h-[90vh] flex flex-col overflow-hidden"
      >
        <button 
          onClick={handleClose}
          className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-white border border-slate-200 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-full z-[100] transition-colors shadow-sm"
        >
          <X size={20} strokeWidth={2.5} />
        </button>
        <div className="flex-1 overflow-y-auto relative custom-scrollbar">
          {children}
        </div>
      </motion.div>
    </div>
  );
}
