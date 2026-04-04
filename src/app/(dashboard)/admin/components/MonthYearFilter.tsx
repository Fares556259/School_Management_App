"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Calendar, X } from 'lucide-react';
import { MONTHS } from "@/lib/dateUtils";

interface MonthYearFilterProps {
  activeMonth?: string;
  activeYear?: string;
}

const MonthYearFilter: React.FC<MonthYearFilterProps> = ({ activeMonth, activeYear }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  const currentMonth = activeMonth ? parseInt(activeMonth) : new Date().getMonth();
  const currentYear = activeYear ? parseInt(activeYear) : new Date().getFullYear();

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const handleUpdate = (m: number, y: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('month', m.toString());
    params.set('year', y.toString());
    params.delete('timeFilter'); // Specific month overrides preset filters
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const clearFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('month');
    params.delete('year');
    params.set('timeFilter', 'thisMonth');
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const isFiltered = !!(activeMonth && activeYear);

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm border transition-all ${isFiltered ? 'border-indigo-200 ring-2 ring-indigo-50/50' : 'border-slate-100 hover:border-slate-200'}`}
      >
        <Calendar size={16} className={isFiltered ? 'text-indigo-500' : 'text-slate-400'} />
        <span className="text-sm font-black text-slate-700 italic tracking-tight">
          {isFiltered ? `${MONTHS[currentMonth]} ${currentYear}` : "Select Period"}
        </span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pick Month & Year</span>
            {isFiltered && (
              <button 
                onClick={clearFilter}
                className="text-[10px] font-black text-rose-500 uppercase flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded-md"
              >
                <X size={10} /> Reset
              </button>
            )}
          </div>

          <div className="flex gap-4">
            <div className="flex-1 flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
              {MONTHS.map((m, idx) => (
                <button
                  key={m}
                  onClick={() => handleUpdate(idx, currentYear)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentMonth === idx && isFiltered ? 'bg-indigo-500 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
            <div className="w-px bg-slate-50" />
            <div className="flex flex-col gap-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => handleUpdate(currentMonth, y)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${currentYear === y && isFiltered ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthYearFilter;
