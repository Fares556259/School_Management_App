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
        {isPending ? <Loader2 className="absolute start-3.5 top-1/2 -translate-y-1/2 animate-spin text-brand-600" size={17} /> : <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={17} />}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          className="ss-field ps-10 pe-3"
        />
      </label>
      <label className="relative block w-full sm:w-56">
        <span className="sr-only">{allClassesLabel}</span>
        <select
          value={searchParams.get("classId") || defaultClass}
          onChange={(event) => updateParams({ classId: event.target.value })}
          className="ss-field appearance-none pe-9"
        >
          <option value="">{allClassesLabel}</option>
          {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
        </select>
        <ChevronDown className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-400" size={16} strokeWidth={1.75} />
      </label>
    </div>
  );
}
