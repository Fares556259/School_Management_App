"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Printer, Loader2 } from "lucide-react";

interface ClassItem {
  id: number;
  name: string;
}

export default function GradeFilter({
  classes, classId, term, studentsTotal, studentsComplete,
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
    startTransition(() => router.push(`/admin/grades?${params.toString()}`));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Class */}
      <select
        value={classId || ""}
        onChange={e => handleChange("classId", e.target.value)}
        disabled={isPending}
        className="h-9 px-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all disabled:opacity-50 cursor-pointer"
      >
        {classes
          .filter(c => c.name.toLowerCase() !== "all classes")
          .map(c => (
            <option key={c.id} value={c.id}>Classe {c.name}</option>
          ))}
      </select>

      {/* Term */}
      <select
        value={term}
        onChange={e => handleChange("term", e.target.value)}
        disabled={isPending}
        className="h-9 px-3 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-400 transition-all disabled:opacity-50 cursor-pointer"
      >
        <option value="1">Trimestre 1</option>
        <option value="2">Trimestre 2</option>
        <option value="3">Trimestre 3</option>
      </select>

      {/* Completion count */}
      {studentsTotal !== undefined && studentsTotal > 0 && (
        <span className="text-xs font-medium text-slate-400 px-2">
          {studentsComplete}/{studentsTotal} complets
        </span>
      )}

      {isPending && <Loader2 size={15} className="animate-spin text-slate-400" />}

      {/* Print button */}
      <button
        type="button"
        onClick={() => { if (classId) window.open(`/admin/grades/bulk/${classId}?term=${term}`, '_blank'); }}
        disabled={!classId || isPending}
        className="h-9 flex items-center gap-2 px-4 text-xs font-bold rounded-lg transition-all bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Printer size={13} />
        <span>{t.gradeEntry.printReportCards}</span>
      </button>
    </div>
  );
}
