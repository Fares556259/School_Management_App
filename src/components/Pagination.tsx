"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { useLanguage } from "@/lib/translations/LanguageContext";

const Pagination = ({
  page = 1,
  count = 0,
}: {
  page?: number;
  count?: number;
}) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  const hasPrev = ITEM_PER_PAGE * (page - 1) > 0;
  const hasNext = ITEM_PER_PAGE * (page - 1) + ITEM_PER_PAGE < count;

  const getUrl = (newPage: number) => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    return `${window.location.pathname}?${params.toString()}`;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const totalPages = Math.ceil(count / ITEM_PER_PAGE);
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - range && i <= page + range)) {
        router.prefetch(getUrl(i));
      }
    }
  }, [page, count, router]);

  const changePage = (newPage: number) => {
    setPendingPage(newPage);
    startTransition(() => {
      router.push(getUrl(newPage));
    });
  };

  return (
    <div className="pt-6 mt-4 flex items-center justify-between text-[#41454d]">
      <button
        disabled={!hasPrev || isPending}
        className="py-2.5 px-5 rounded-[8px] border border-[#dddddd] bg-white text-[13px] font-medium hover:bg-slate-50 disabled:opacity-40 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        onClick={() => changePage(page - 1)}
        onMouseEnter={() => router.prefetch(getUrl(page - 1))}
      >
        {isPending && pendingPage === page - 1 ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
            <span>{t.pagination.previous}</span>
          </>
        ) : (
          t.pagination.previous
        )}
      </button>
      <div className="flex items-center gap-1.5 text-[13px]">
        {(() => {
          const totalPages = Math.ceil(count / ITEM_PER_PAGE);
          const pages = [];
          const range = 2; // Pages to show on either side of current page

          for (let i = 1; i <= totalPages; i++) {
            if (
              i === 1 ||
              i === totalPages ||
              (i >= page - range && i <= page + range)
            ) {
              if (pages.length > 0 && i > (pages[pages.length - 1] as number) + 1) {
                pages.push("...");
              }
              pages.push(i);
            }
          }

          return pages.map((p, index) => {
            if (p === "...") {
              return <span key={`dots-${index}`} className="px-1 font-medium">...</span>;
            }
            return (
              <button
                key={p}
                disabled={isPending}
                className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] font-medium transition-all border ${
                  page === p ? "bg-[#181d26] text-white border-[#181d26]" : "border-transparent hover:bg-slate-100 text-[#41454d]"
                } ${isPending && page !== p ? "opacity-50" : ""}`}
                onClick={() => changePage(p as number)}
                onMouseEnter={() => router.prefetch(getUrl(p as number))}
              >
                {isPending && pendingPage === p ? (
                  <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  p
                )}
              </button>
            );
          });
        })()}
      </div>
      <button
        disabled={!hasNext || isPending}
        className="py-2.5 px-5 rounded-[8px] border border-[#dddddd] bg-white text-[13px] font-medium hover:bg-slate-50 disabled:opacity-40 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        onClick={() => changePage(page + 1)}
        onMouseEnter={() => router.prefetch(getUrl(page + 1))}
      >
        {isPending && pendingPage === page + 1 ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
            <span>{t.pagination.next}</span>
          </>
        ) : (
          t.pagination.next
        )}
      </button>
    </div>
  );
};

export default Pagination;
