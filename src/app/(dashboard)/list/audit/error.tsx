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
    console.error(error);
  }, [error]);

  return (
    <div className="flex-1 m-4 p-8 bg-white rounded-2xl border-2 border-rose-50 flex flex-col items-center justify-center text-center gap-6 shadow-sm">
      <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
        <AlertCircle size={32} />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Something went wrong</h2>
        <p className="text-slate-500 text-sm max-w-md mx-auto">
          We encountered an error while loading the audit logs. This might be due to a database connection issue or a temporary glitch.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-full font-bold hover:bg-slate-700 transition-all shadow-lg active:scale-95"
      >
        <RefreshCcw size={16} />
        Try Again
      </button>
    </div>
  );
}
