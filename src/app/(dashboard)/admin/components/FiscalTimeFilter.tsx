"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface FiscalTimeFilterProps {
  activeFilter: string;
}

const FiscalTimeFilter: React.FC<FiscalTimeFilterProps> = ({ activeFilter }) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilterChange = (filter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeFilter', filter);
    router.push(`?${params.toString()}`, { scroll: false });
  };

  const filters = [
    { id: 'thisMonth', label: 'This Month' },
    { id: 'lastMonth', label: 'Last Month' },
    { id: 'last3Months', label: 'Last 3 Months' },
  ];

  return (
    <div className="flex items-center p-1 bg-slate-50 rounded-[14px] border border-slate-100">
      {filters.map((f) => (
        <button
          key={f.id}
          onClick={() => handleFilterChange(f.id)}
          className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all duration-200 rounded-[10px] ${
            activeFilter === f.id
              ? 'bg-white text-slate-800 shadow-sm'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
};

export default FiscalTimeFilter;
