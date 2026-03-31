"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { MONTHS } from "@/lib/dateUtils";

export default function MonthSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read current month from URL or default to current month
  const now = new Date();
  const monthParam = searchParams.get("month");
  
  let currentMonthIndex: number;
  let currentYear: number;

  if (monthParam) {
    const [m, y] = monthParam.split("-").map(Number);
    currentMonthIndex = m;
    currentYear = y;
  } else {
    currentMonthIndex = now.getMonth();
    currentYear = now.getFullYear();
  }

  // Determine school year start (September)
  // If we are in Jan-Jun (0-5), the school year started in Sep (8) of the previous year
  // If we are in Aug-Dec (7-11), the school year started in Sep (8) of the current year
  // (July/August are typically excluded or part of the summer, let's treat Aug as start)
  const schoolYearStartYear = (currentMonthIndex >= 8) ? currentYear : currentYear - 1;

  // Build the 10 months list: Sep, Oct, Nov, Dec, Jan, Feb, Mar, Apr, May, Jun
  const schoolMonths = [
    { m: 8, y: schoolYearStartYear },        // Sep
    { m: 9, y: schoolYearStartYear },        // Oct
    { m: 10, y: schoolYearStartYear },       // Nov
    { m: 11, y: schoolYearStartYear },       // Dec
    { m: 0, y: schoolYearStartYear + 1 },    // Jan
    { m: 1, y: schoolYearStartYear + 1 },    // Feb
    { m: 2, y: schoolYearStartYear + 1 },    // Mar
    { m: 3, y: schoolYearStartYear + 1 },    // Apr
    { m: 4, y: schoolYearStartYear + 1 },    // May
    { m: 5, y: schoolYearStartYear + 1 },    // Jun
  ];

  const navigate = (month: number, year: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", `${month}-${year}`);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="bg-white border-b border-slate-200 mb-6 -mx-4 px-4 overflow-x-auto no-scrollbar">
      <div className="flex items-center gap-1 min-w-max py-2">
        <div className="pr-4 border-r border-slate-200 mr-2 flex flex-col">
          <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Academic Year</span>
          <span className="text-xs font-bold text-slate-700 whitespace-nowrap">{schoolYearStartYear}/{schoolYearStartYear + 1}</span>
        </div>
        {schoolMonths.map(({ m, y }) => {
          const isActive = currentMonthIndex === m && currentYear === y;
          return (
            <button
              key={`${m}-${y}`}
              onClick={() => navigate(m, y)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-lamaSky text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              }`}
            >
              {MONTHS[m].substring(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
