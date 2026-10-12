"use client";

import { Search, Loader2 } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface TableSearchProps {
  onPending?: (isPending: boolean) => void;
  onChangeImmediate?: (val: string) => void;
  clientSideOnly?: boolean;
}

const TableSearch = ({ onPending, onChangeImmediate, clientSideOnly }: TableSearchProps = {}) => {
  const router = useRouter();
  const { t } = useLanguage();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const initialSearch = searchParams.get("search") || "";
  const [searchValue, setSearchValue] = useState(clientSideOnly ? "" : initialSearch);

  // Sync state if URL changes externally
  useEffect(() => {
    if (!clientSideOnly) {
      setSearchValue(searchParams.get("search") || "");
    }
  }, [searchParams, clientSideOnly]);

  useEffect(() => {
    if (clientSideOnly) return;

    const timeoutId = setTimeout(() => {
      // Only push if the value actually changed to prevent infinite loops
      if (searchValue !== (searchParams.get("search") || "")) {
        if (onPending) onPending(true);
        startTransition(() => {
          const params = new URLSearchParams(searchParams.toString());
          if (searchValue) {
            params.set("search", searchValue);
          } else {
            params.delete("search");
          }
          params.delete("page");
          router.push(`${pathname}?${params.toString()}`, { scroll: false });
        });
      }
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [searchValue, searchParams, pathname, router, clientSideOnly, onPending]);

  useEffect(() => {
    if (onPending && !isPending) {
      onPending(false);
    }
  }, [isPending, onPending]);

  return (
    <label className="relative block w-full sm:w-72">
      <span className="sr-only">{t.navbar.search || "Search"}</span>
      {isPending ? (
        <span className="absolute start-3.5 top-1/2 -translate-y-1/2 text-brand-600">
          <Loader2 className="animate-spin" size={16} />
        </span>
      ) : (
        <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 text-ink-400" size={16} />
      )}
      <input
        type="text"
        placeholder={t.navbar.search || "Search..."}
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value);
          if (onChangeImmediate) onChangeImmediate(e.target.value);
        }}
        className="ss-field ps-10 pe-4"
      />
    </label>
  );
};

export default TableSearch;
