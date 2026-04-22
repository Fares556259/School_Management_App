"use client";

import { useState } from "react";
import { RefreshCcw, CheckCircle2, AlertCircle } from "lucide-react";
import { syncClerkUsers } from "./sync-clerk";

export default function SyncClerkBtn() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ synchronizedCount: number; alreadySyncedCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await syncClerkUsers();
      if (res.success) {
        setResult({
          synchronizedCount: res.synchronizedCount ?? 0,
          alreadySyncedCount: res.alreadySyncedCount ?? 0,
        });
      } else {
        setError(res.error || "Failed to sync users.");
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all shadow-lg
          ${loading ? "bg-slate-100 text-slate-400 cursor-not-allowed" : "bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 shadow-indigo-100/50"}`}
      >
        <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Synchronizing..." : "Sync with Clerk"}
      </button>

      {result && (
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Imported {result.synchronizedCount} new leads. ({result.alreadySyncedCount} up to date)
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
