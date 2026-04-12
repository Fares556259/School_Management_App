"use client";
import { useRouter, useSearchParams } from "next/navigation";

const periods = ["This Month", "Last 3 Months", "Last 6 Months", "This Year", "All Time", "Custom"];

export default function PeriodFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPeriod = searchParams.get("period") || "This Month";

  const handleSelect = (p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex gap-2 text-xs font-semibold">
      {periods.map(p => (
        <button
          key={p}
          onClick={() => handleSelect(p)}
          className={`px-3 py-1.5 rounded-full border transition-colors ${currentPeriod === p ? "bg-indigo-500 text-white border-transparent shadow-sm" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"}`}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
