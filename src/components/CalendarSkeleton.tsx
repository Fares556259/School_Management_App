import React from "react";

export default function CalendarSkeleton() {
  return (
    <div className="bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm flex-1 m-4 mt-0 animate-in fade-in duration-300">
      {/* Header Controls Skeleton */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="h-10 bg-slate-200 animate-pulse rounded-xl w-48" />
        <div className="flex gap-2 w-full md:w-auto">
          <div className="h-10 bg-slate-200 animate-pulse rounded-xl w-24" />
          <div className="h-10 bg-slate-200 animate-pulse rounded-xl w-24" />
        </div>
      </div>

      {/* Grid Skeleton */}
      <div className="w-full border border-slate-200 rounded-2xl overflow-hidden bg-slate-50">
        {/* Days Header */}
        <div className="grid grid-cols-6 border-b border-slate-200">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="py-4 px-2 border-r border-slate-200 last:border-r-0 flex justify-center">
              <div className="h-5 bg-slate-200 animate-pulse rounded-md w-16" />
            </div>
          ))}
        </div>
        {/* Time Blocks */}
        <div className="grid grid-cols-6 h-[500px]">
          {Array.from({ length: 6 }).map((_, col) => (
            <div key={col} className="border-r border-slate-200 last:border-r-0 relative p-2 flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, row) => (
                <div 
                  key={row} 
                  className="bg-white border border-slate-100 rounded-xl shadow-sm p-3 h-24 animate-pulse flex flex-col gap-2"
                  style={{ marginTop: `${Math.random() * 40}px` }}
                >
                  <div className="h-3 bg-slate-200 rounded-md w-2/3" />
                  <div className="h-3 bg-slate-100 rounded-md w-1/2" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
