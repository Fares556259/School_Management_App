"use client";

import { useRouter, useSearchParams } from "next/navigation";

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

  const handleChange = (name: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(name, value);
    router.push(`/admin/grades?${params.toString()}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Class</label>
        <select
          value={classId || ""}
          onChange={(e) => handleChange("classId", e.target.value)}
          className="bg-slate-50 border border-slate-100 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Select Class</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Academic Term</label>
        <select
          value={term}
          onChange={(e) => handleChange("term", e.target.value)}
          className="bg-slate-50 border border-slate-100 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="1">Term 1</option>
          <option value="2">Term 2</option>
          <option value="3">Term 3</option>
        </select>
      </div>

      <div className="ml-auto pt-5">
        <button
          onClick={() => {
            if (classId) {
                window.open(`/admin/grades/bulk/${classId}?term=${term}`, '_blank');
            }
          }}
          disabled={!classId}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all ${
            classId 
              ? "bg-blue-600 text-white shadow-lg shadow-blue-100 hover:bg-blue-700 active:scale-95" 
              : "bg-slate-100 text-slate-400 cursor-not-allowed opacity-50"
          }`}
        >
          <Printer size={16} />
          Print Class Report Cards
        </button>
      </div>
    </div>
  );
}

import { Printer } from "lucide-react";
