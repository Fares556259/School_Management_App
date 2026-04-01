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
    // Log the error to an error reporting service
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div className="w-full h-full min-h-[400px] flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-200">
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
        <AlertCircle className="text-red-600 w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">Something went wrong</h2>
      <p className="text-slate-600 text-center max-w-md mb-8">
        We encountered an unexpected error while rendering this page. 
        {error.message && <span className="block mt-2 text-sm font-mono text-red-500 bg-red-50 p-2 rounded">{error.message}</span>}
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-6 py-3 bg-lamaSky text-white rounded-lg font-semibold hover:bg-sky-500 transition-colors shadow-sm"
      >
        <RefreshCcw size={18} />
        Try again
      </button>
    </div>
  );
}
