"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Audit Error:", error);
  }, [error]);

  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-center gap-6 shadow-xl shadow-slate-200/50 m-6">
      <div className="w-20 h-20 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 shadow-inner">
        <AlertCircle size={40} />
      </div>
      <div className="max-w-md">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-3 italic">Administrative Oversight Halted</h2>
        <p className="text-slate-500 text-sm leading-relaxed">
          We encountered a critical error while fetching the sensitive audit logs. This might be due to a Clerk authentication failure or a database timeout.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-[240px]">
        <button
            onClick={() => reset()}
            className="w-full flex items-center justify-center gap-3 px-8 py-3.5 bg-slate-800 text-white rounded-2xl font-black text-sm hover:bg-slate-700 transition-all shadow-lg active:scale-95 group"
        >
            <RefreshCcw size={18} className="group-hover:rotate-180 transition-transform duration-500" />
            Re-verify System
        </button>
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
            Error ID: {error.digest || "N/A"}
        </p>
      </div>
    </div>
  );
}
