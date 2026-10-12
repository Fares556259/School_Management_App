"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState, useEffect } from "react";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { useLanguage } from "@/lib/translations/LanguageContext";

const Pagination = ({
  page = 1,
  count = 0,
  onPageChange,
  itemPerPage,
}: {
  page?: number;
  count?: number;
  onPageChange?: (newPage: number) => void;
  itemPerPage?: number;
}) => {
  const router = useRouter();
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const [pendingPage, setPendingPage] = useState<number | null>(null);

  const pageSize = itemPerPage && itemPerPage > 0 ? itemPerPage : ITEM_PER_PAGE;
  const totalPages = Math.ceil(count / pageSize);
  const rawPage = (page && !isNaN(page) && page > 0) ? page : 1;
  const safePage = Math.max(1, Math.min(rawPage, Math.max(1, totalPages)));
  const hasPrev = pageSize * (safePage - 1) > 0;
  const hasNext = pageSize * (safePage - 1) + pageSize < count;

  const getUrl = (newPage: number) => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    return `${window.location.pathname}?${params.toString()}`;
  };

  useEffect(() => {
    if (typeof window === "undefined" || onPageChange) return;
    const range = 2;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= safePage - range && i <= safePage + range)) {
        router.prefetch(getUrl(i));
      }
    }
  }, [page, count, router, onPageChange, totalPages, safePage]);

  const changePage = (newPage: number) => {
    if (onPageChange) {
      onPageChange(newPage);
    } else {
      setPendingPage(newPage);
      startTransition(() => {
        router.push(getUrl(newPage));
      });
    }
  };

  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 pt-5 text-ink-600">
      <button
        disabled={!hasPrev || isPending}
        className="ss-button-secondary px-3 sm:px-4"
        aria-label={t.pagination.previous}
        onClick={() => changePage(safePage - 1)}
        onMouseEnter={() => router.prefetch(getUrl(safePage - 1))}
      >
        {isPending && pendingPage === safePage - 1 ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
            <span>{t.pagination.previous}</span>
          </>
        ) : (
          t.pagination.previous
        )}
      </button>
      <div className="hidden items-center gap-1 text-[13px] sm:flex">
        {(() => {
          const pages = [];
          const range = 2; // Pages to show on either side of current page

          for (let i = 1; i <= totalPages; i++) {
            if (
              i === 1 ||
              i === totalPages ||
              (i >= safePage - range && i <= safePage + range)
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
                aria-current={safePage === p ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={`flex h-8 w-8 items-center justify-center rounded-control border text-[13px] font-medium transition ${
                  safePage === p ? "border-brand-600 bg-brand-600 text-white" : "border-transparent text-ink-600 hover:bg-ink-100"
                } ${isPending && safePage !== p ? "opacity-50" : ""}`}
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
        className="ss-button-secondary px-3 sm:px-4"
        aria-label={t.pagination.next}
        onClick={() => changePage(safePage + 1)}
        onMouseEnter={() => router.prefetch(getUrl(safePage + 1))}
      >
        {isPending && pendingPage === safePage + 1 ? (
          <>
            <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full" />
            <span>{t.pagination.next}</span>
          </>
        ) : (
          t.pagination.next
        )}
      </button>
    </nav>
  );
};

export default Pagination;
