"use client";

import { Search, ChevronDown } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function AnnouncementFilters({ 
  classes, 
  defaultSearch, 
  defaultClass 
}: { 
  classes: { id: number; name: string }[];
  defaultSearch?: string;
  defaultClass?: string;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch || "");

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      // Reset page to 1 when filters change
      params.delete("page");
      return params.toString();
    },
    [searchParams]
  );

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    router.push(`?${createQueryString("classId", val)}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`?${createQueryString("search", search)}`);
  };

  return (
    <div className="flex flex-wrap items-center bg-[#f8fafc] border border-[#dddddd] rounded-[8px] px-3 py-2 gap-4 w-fit">
      {/* Search */}
      <div className="flex items-center gap-2 px-2 border-e border-[#dddddd] pe-6 relative">
        <Search size={14} className="text-[#9297a0]" />
        <form onSubmit={handleSearchSubmit}>
           <input 
             name="search"
             value={search}
             onChange={(e) => setSearch(e.target.value)}
             placeholder={t.announcementsPage?.filters?.search || "Search announcements..."}
             className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none w-48 placeholder:font-normal placeholder:text-[#9297a0]"
           />
           <button type="submit" className="hidden">Search</button>
        </form>
      </div>
      
      {/* Class Filter */}
      <div className="flex items-center gap-3 px-2">
        <span className="text-[13px] font-medium text-[#41454d]">{t.announcementsPage?.filters?.target || "Target"}</span>
        <div className="relative inline-flex items-center">
          <select 
            name="classId"
            defaultValue={defaultClass || ""}
            onChange={handleClassChange}
            className="bg-transparent border-0 text-[13px] font-medium text-[#181d26] focus:outline-none cursor-pointer appearance-none pr-5"
          >
            <option value="">{t.announcementsPage?.filters?.globalOption || "Global (All Classes)"}</option>
            {classes.map(c => <option key={c.id} value={c.id.toString()}>{t.announcementsPage?.filters?.classPrefix || "Class "}{c.name}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-0 top-1/2 -translate-y-1/2 text-[#9297a0] pointer-events-none" />
        </div>
      </div>
    </div>
  );
}
