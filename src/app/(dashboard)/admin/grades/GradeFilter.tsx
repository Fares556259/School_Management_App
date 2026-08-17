"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Printer, Loader2, Filter, Layers, Calendar } from "lucide-react";

interface ClassItem {
  id: number;
  name: string;
}

export default function GradeFilter({
  classes,
  classId,
  term,
}: {
  classes: ClassItem[];
  classId: number | null;
  term: number;
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

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-2xl shadow-sm border border-slate-200/80">
      {/* Class Selector */}
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
        <Layers size={14} className="text-slate-400 shrink-0" />
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-tight">
            {t.gradeEntry.classLabel}
          </label>
          <select
            value={classId || ""}
            onChange={(e) => handleChange("classId", e.target.value)}
            disabled={isPending}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:opacity-50 py-0.5"
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
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <div className="flex flex-col">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider leading-tight">
            {t.gradeEntry.termLabel}
          </label>
          <select
            value={term}
            onChange={(e) => handleChange("term", e.target.value)}
            disabled={isPending}
            className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer disabled:opacity-50 py-0.5"
          >
            <option value="1">{t.gradeEntry.term} 1</option>
            <option value="2">{t.gradeEntry.term} 2</option>
            <option value="3">{t.gradeEntry.term} 3</option>
          </select>
        </div>
      </div>

      {isPending && (
        <div className="flex items-center justify-center px-2">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
        </div>
      )}

      {/* Print All Report Cards Button */}
      <button
        type="button"
        onClick={() => {
          if (classId) {
            window.open(`/admin/grades/bulk/${classId}?term=${term}`, '_blank');
          }
        }}
        disabled={!classId}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
          classId 
            ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700 active:scale-95 ml-auto" 
            : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50 ml-auto"
        }`}
      >
        <Printer size={15} />
        <span>{t.gradeEntry.printReportCards}</span>
      </button>
    </div>
  );
}
