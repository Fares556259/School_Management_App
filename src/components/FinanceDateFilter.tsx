"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

export default function FinanceDateFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  const [isOpen, setIsOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState(currentFrom);
  const [tempTo, setTempTo] = useState(currentTo);

  const applyFilter = (from: string, to: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    else params.delete("from");
    
    if (to) params.set("to", to);
    else params.delete("to");
    
    // Reset to page 1 when filtering
    params.delete("page");
    
    router.push(`?${params.toString()}`);
    setIsOpen(false);
  };

  const setPremadeRange = (type: "thisMonth" | "lastMonth" | "thisYear" | "all") => {
    const now = new Date();
    let from = "";
    let to = "";

    if (type === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      from = start.toISOString().split("T")[0];
      to = end.toISOString().split("T")[0];
    } else if (type === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      from = start.toISOString().split("T")[0];
      to = end.toISOString().split("T")[0];
    } else if (type === "thisYear") {
      from = `${now.getFullYear()}-01-01`;
      to = `${now.getFullYear()}-12-31`;
    }

    applyFilter(from, to);
  };

  const isActive = currentFrom || currentTo;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
          isActive ? "bg-lamaSky text-white" : "bg-lamaYellow"
        }`}
        title="Filter by Date"
      >
        <Image src="/filter.png" alt="" width={14} height={14} className={isActive ? "invert" : ""} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 p-4 animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Filter by Date</h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-2 mb-4">
            <button
              onClick={() => setPremadeRange("thisMonth")}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              🗓️ This Month
            </button>
            <button
              onClick={() => setPremadeRange("lastMonth")}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              📅 Last Month
            </button>
            <button
              onClick={() => setPremadeRange("thisYear")}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
            >
              🎆 This Year
            </button>
            <button
              onClick={() => setPremadeRange("all")}
              className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
            >
              🧹 Clear Filter (All Time)
            </button>
          </div>

          <div className="border-t border-slate-50 pt-4">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-3">Custom Range</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">From</label>
                <input
                  type="date"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-lamaSky outline-none"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-500 ml-1">To</label>
                <input
                  type="date"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg p-2 focus:ring-2 focus:ring-lamaSky outline-none"
                />
              </div>
            </div>
            <button
              onClick={() => applyFilter(tempFrom, tempTo)}
              className="w-full py-2 bg-lamaSky text-white rounded-lg text-xs font-bold hover:bg-blue-400 transition-colors shadow-sm"
            >
              Apply Custom Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
