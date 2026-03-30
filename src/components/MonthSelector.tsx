"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MONTHS, getMonthKey } from "@/lib/dateUtils";

export default function MonthSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read current month from URL or default to current month
  const now = new Date();
  const monthParam = searchParams.get("month");
  
  let currentMonth: number;
  let currentYear: number;

  if (monthParam) {
    const [m, y] = monthParam.split("-").map(Number);
    currentMonth = m;
    currentYear = y;
  } else {
    currentMonth = now.getMonth(); // 0-indexed
    currentYear = now.getFullYear();
  }

  const navigate = (month: number, year: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", `${month}-${year}`);
    params.delete("page"); // reset pagination
    router.push(`${pathname}?${params.toString()}`);
  };

  const goBack = () => {
    let m = currentMonth - 1;
    let y = currentYear;
    if (m < 0) { m = 11; y--; }
    navigate(m, y);
  };

  const goForward = () => {
    let m = currentMonth + 1;
    let y = currentYear;
    if (m > 11) { m = 0; y++; }
    navigate(m, y);
  };
  return (
    <div className="flex items-center justify-between bg-slate-50 rounded-xl px-6 py-3 mb-4 border border-slate-200">
      <button
        onClick={goBack}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-600 font-bold text-lg"
      >
        ‹
      </button>
      <h2 className="text-base font-bold text-slate-700 tracking-tight">
        {MONTHS[currentMonth]} {currentYear}
      </h2>
      <button
        onClick={goForward}
        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors text-slate-600 font-bold text-lg"
      >
        ›
      </button>
    </div>
  );
}

