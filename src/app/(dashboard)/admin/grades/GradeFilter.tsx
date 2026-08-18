"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Printer, Loader2, Layers, Calendar, CheckCircle2 } from "lucide-react";

interface ClassItem {
  id: number;
  name: string;
}

export default function GradeFilter({
  classes,
  classId,
  term,
  studentsTotal,
  studentsComplete,
}: {
  classes: ClassItem[];
  classId: number | null;
  term: number;
  studentsTotal?: number;
  studentsComplete?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { t } = useLanguage();

  const handleChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    startTransition(() => {
      router.push(`/admin/grades?${params.toString()}`);
    });
  };

  const completionPct = studentsTotal && studentsTotal > 0
    ? Math.round((studentsComplete ?? 0) / studentsTotal * 100)
    : 0;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {/* Class Selector */}
      <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 ${isPending ? "opacity-60" : "border-slate-200 hover:border-slate-300"}`}>
        <Layers size={14} className="text-slate-400 shrink-0" />
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-tight">
            {t.gradeEntry.classLabel}
          </label>
          <select
            value={classId || ""}
            onChange={(e) => handleChange("classId", e.target.value)}
            disabled={isPending}
            className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer disabled:opacity-50 py-0.5 pr-1"
          >
            {classes
              .filter(c => String(c.id).toLowerCase() !== "all" && c.name.toLowerCase() !== "all classes")
              .map((c) => (
                <option key={c.id} value={c.id}>
                  Classe {c.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Term Selector */}
      <div className={`flex items-center gap-2 bg-white border rounded-xl px-3 py-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 ${isPending ? "opacity-60" : "border-slate-200 hover:border-slate-300"}`}>
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-tight">
            {t.gradeEntry.termLabel}
          </label>
          <select
            value={term}
            onChange={(e) => handleChange("term", e.target.value)}
            disabled={isPending}
            className="bg-transparent text-sm font-black text-slate-800 outline-none cursor-pointer disabled:opacity-50 py-0.5 pr-1"
          >
            <option value="1">{t.gradeEntry.term} 1</option>
            <option value="2">{t.gradeEntry.term} 2</option>
            <option value="3">{t.gradeEntry.term} 3</option>
          </select>
        </div>
      </div>

      {/* Class completion badge */}
      {studentsTotal !== undefined && studentsTotal > 0 && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold shadow-sm ${
          completionPct === 100
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-slate-50 border-slate-200 text-slate-600"
        }`}>
          {completionPct === 100 ? <CheckCircle2 size={13} /> : null}
          <div className="flex flex-col gap-0.5">
            <span>{studentsComplete}/{studentsTotal} complets</span>
            <div className="h-1 w-16 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${completionPct === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {isPending && (
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
      )}

      {/* Print All Report Cards Button */}
      <button
        type="button"
        onClick={() => {
          if (classId) {
            window.open(`/admin/grades/bulk/${classId}?term=${term}`, '_blank');
          }
        }}
        disabled={!classId || isPending}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all shadow-sm ${
          classId && !isPending
            ? "bg-slate-900 text-white hover:bg-slate-800 active:scale-95"
            : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
        }`}
      >
        <Printer size={14} />
        <span>{t.gradeEntry.printReportCards}</span>
      </button>
    </div>
  );
}
