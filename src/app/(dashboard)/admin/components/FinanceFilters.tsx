"use client";
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, X, ChevronDown, Download } from 'lucide-react';
import { downloadCSV } from '@/lib/csvExport';

interface FinanceFiltersProps {
  currentFilters: {
    category?: string;
    type?: string;
    q?: string;
  };
  data?: any[];
}

const FinanceFilters = ({ currentFilters, data = [] }: FinanceFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();

  const handleExport = () => {
    if (!data || data.length === 0) return;
    const exportData = data.map(item => ({
      Date: new Date(item.date).toLocaleDateString(),
      Title: item.title,
      Type: item.type.toUpperCase(),
      Category: item.source || "N/A",
      Amount: item.amount
    }));
    downloadCSV(exportData, `finance-export-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const clearFilters = () => {
    router.push(pathname, { scroll: false });
  };

  const hasFilters = Object.values(currentFilters).some(v => v !== undefined);

  return (
    <div className="bg-white/80 backdrop-blur-md p-4 rounded-[24px] border border-slate-100 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-[88px] z-40">
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search transactions..."
            defaultValue={currentFilters.q}
            onChange={(e) => updateFilters({ q: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <select
            value={currentFilters.type || ""}
            onChange={(e) => updateFilters({ type: e.target.value || undefined })}
            className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer min-w-[120px]"
          >
            <option value="">All Types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>

        {/* Category Filter */}
        <div className="relative">
          <select
            value={currentFilters.category || ""}
            onChange={(e) => updateFilters({ category: e.target.value || undefined })}
            className="appearance-none pl-4 pr-10 py-2.5 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-600 focus:ring-2 focus:ring-indigo-100 transition-all cursor-pointer min-w-[140px]"
          >
            <option value="">All Categories</option>
            <option value="SALARY">Salary</option>
            <option value="TUITION">Tuition</option>
            <option value="UTILITIES">Utilities</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="OTHER">Other</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-2 px-3 py-2 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-lg transition-colors uppercase tracking-widest"
          >
            <X size={14} />
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
         {/* Exporting functionality integrated */}
         <div className="hidden sm:block">
            {/* The ExportButton requires data which we'll handle in the parent or pass via prop if needed */}
            {/* For now, let's keep it simple or integrate a placeholder */}
            <button 
               onClick={handleExport}
               disabled={data.length === 0}
               className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 disabled:opacity-50 disabled:shadow-none"
            >
               <Download size={16} />
               Export CSV
            </button>
         </div>
      </div>
    </div>
  );
};

export default FinanceFilters;
