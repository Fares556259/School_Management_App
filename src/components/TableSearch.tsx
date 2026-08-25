"use client";

import { Search, Loader2 } from "lucide-react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState, useEffect, useTransition } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";

interface TableSearchProps {
  onPending?: (isPending: boolean) => void;
  onChangeImmediate?: (val: string) => void;
}

const TableSearch = ({ onPending, onChangeImmediate }: TableSearchProps = {}) => {
  const router = useRouter();
  const { t } = useLanguage();

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const initialSearch = searchParams.get("search") || "";
  const [searchValue, setSearchValue] = useState(initialSearch);

  // Sync state if URL changes externally
  useEffect(() => {
    setSearchValue(searchParams.get("search") || "");
  }, [searchParams]);

  useEffect(() => {
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
  }, [searchValue, searchParams, pathname, router]);

  useEffect(() => {
    if (onPending && !isPending) {
      onPending(false);
    }
  }, [isPending, onPending]);

  return (
    <div className="relative w-full sm:w-72">
      {isPending ? (
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#1b61c9]">
          <Loader2 className="animate-spin" size={16} />
        </div>
      ) : (
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#41454d]" size={16} />
      )}
      <input
        type="text"
        placeholder={t.navbar.search || "Search..."}
        value={searchValue}
        onChange={(e) => {
          setSearchValue(e.target.value);
          if (onChangeImmediate) onChangeImmediate(e.target.value);
        }}
        className="w-full bg-white border border-[#dddddd] rounded-[6px] pl-10 pr-4 py-2 text-[13px] font-medium text-[#181d26] placeholder-[#41454d]/60 focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm"
      />
    </div>
  );
};

export default TableSearch;
