import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 m-4 p-8 bg-white rounded-2xl border border-slate-50 flex flex-col items-center justify-center text-center gap-4 shadow-sm animate-pulse">
      <div className="w-12 h-12 rounded-full border-4 border-indigo-50 border-t-indigo-500 animate-spin" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-slate-100 rounded mx-auto" />
        <div className="h-3 w-48 bg-slate-50 rounded mx-auto" />
      </div>
    </div>
  );
}
