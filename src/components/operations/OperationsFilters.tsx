"use client";

import { ChevronDown, Loader2, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";

export default function OperationsFilters({
  classes,
  searchPlaceholder,
  allClassesLabel,
  defaultSearch = "",
  defaultClass = "",
}: {
  classes: Array<{ id: number; name: string }>;
  searchPlaceholder: string;
  allClassesLabel: string;
  defaultSearch?: string;
  defaultClass?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(defaultSearch);
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    params.delete("page");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }, [pathname, router, searchParams]);

  useEffect(() => {
    const currentSearch = searchParams.get("search") || "";
    if (search === currentSearch) return;
    const timeout = setTimeout(() => updateParams({ search }), 350);
    return () => clearTimeout(timeout);
  }, [search, searchParams, updateParams]);

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
      <label className="relative block w-full sm:max-w-sm">
        <span className="sr-only">{searchPlaceholder}</span>
        {isPending ? <Loader2 className="absolute start-3.5 top-1/2 -translate-y-1/2 animate-spin text-blue-600" size={17} /> : <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white ps-10 pe-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </label>
      <label className="relative block w-full sm:w-56">
        <span className="sr-only">{allClassesLabel}</span>
        <select
          value={searchParams.get("classId") || defaultClass}
          onChange={(event) => updateParams({ classId: event.target.value })}
          className="h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 pe-9 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          <option value="">{allClassesLabel}</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      </label>
    </div>
  );
}
