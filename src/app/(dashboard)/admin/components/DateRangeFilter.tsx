"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Calendar, X } from 'lucide-react';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { DateRangePicker, RangeKeyDict, defaultStaticRanges, defaultInputRanges } from 'react-date-range';
import { addDays, subDays, subMonths, subYears, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from 'date-fns';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { ar, fr, enUS } from 'date-fns/locale';

interface DateRangeFilterProps {
  activeStartDate?: string;
  activeEndDate?: string;
}

const DateRangeFilter: React.FC<DateRangeFilterProps> = ({ activeStartDate, activeEndDate }) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const { t, locale } = useLanguage();
  const containerRef = useRef<HTMLDivElement>(null);

  const dfnsLocale = locale === 'ar' ? ar : locale === 'fr' ? fr : enUS;

  const initialStartDate = activeStartDate ? new Date(activeStartDate) : startOfMonth(new Date());
  const initialEndDate = activeEndDate ? new Date(activeEndDate) : endOfMonth(new Date());

  const [state, setState] = useState([
    {
      startDate: initialStartDate,
      endDate: initialEndDate,
      key: 'selection'
    }
  ]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApply = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('start', state[0].startDate.toISOString());
    params.set('end', state[0].endDate.toISOString());
    params.delete('month');
    params.delete('year');
    params.delete('timeFilter');
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('start');
    params.delete('end');
    params.delete('month');
    params.delete('year');
    params.delete('timeFilter');
    setState([{ startDate: startOfMonth(new Date()), endDate: endOfMonth(new Date()), key: 'selection' }]);
    router.push(`?${params.toString()}`, { scroll: false });
    setIsOpen(false);
  };

  const isFiltered = !!(activeStartDate && activeEndDate);

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2.5 bg-[#ffffff] rounded-[4px] border transition-all ${isFiltered ? 'border-[#080808] ring-1 ring-[#080808]' : 'border-[#d8d8d8] hover:bg-[#f9f9f9]'}`}
      >
        <Calendar size={16} className="text-[#080808]" />
        <span className="text-[14px] font-medium text-[#080808] tracking-tight">
          {isFiltered ? `${format(state[0].startDate, 'MMM d, yyyy', {locale: dfnsLocale})} - ${format(state[0].endDate, 'MMM d, yyyy', {locale: dfnsLocale})}` : t.adminWidgets.selectPeriod || 'Select Period'}
        </span>
        {isFiltered && (
          <div onClick={clearFilter} className="ml-1 hover:bg-slate-100 p-0.5 rounded-full transition-colors cursor-pointer">
            <X size={14} className="text-slate-500 hover:text-slate-800" />
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.15)] border border-slate-100 z-50 animate-in fade-in slide-in-from-top-2 overflow-hidden flex flex-col">
          <div className="overflow-x-auto no-scrollbar">
            <DateRangePicker
              onChange={(item: any) => setState([item.selection])}
              moveRangeOnFirstSelection={false}
              months={2}
              ranges={state}
              direction="horizontal"
              locale={dfnsLocale}
              rangeColors={['#2563eb']}
              staticRanges={defaultStaticRanges}
              inputRanges={defaultInputRanges}
            />
          </div>
          <div className="border-t border-slate-100 p-3 bg-slate-50 flex items-center justify-between">
             <div className="text-sm font-medium text-slate-700 ml-4">
                {format(state[0].startDate, 'MMM d', {locale: dfnsLocale})} - {format(state[0].endDate, 'MMM d', {locale: dfnsLocale})}
             </div>
             <div className="flex gap-2">
                <button onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
                   Cancel
                </button>
                <button onClick={handleApply} className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
                   Apply
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
