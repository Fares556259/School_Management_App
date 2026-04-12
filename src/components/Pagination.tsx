"use client";

import { useRouter } from "next/navigation";
import { ITEM_PER_PAGE } from "@/lib/settings";

const Pagination = ({
  page = 1,
  count = 0,
}: {
  page?: number;
  count?: number;
}) => {
  const router = useRouter();

  const hasPrev = ITEM_PER_PAGE * (page - 1) > 0;
  const hasNext = ITEM_PER_PAGE * (page - 1) + ITEM_PER_PAGE < count;

  const changePage = (newPage: number) => {
    const params = new URLSearchParams(window.location.search);
    params.set("page", newPage.toString());
    router.push(`${window.location.pathname}?${params.toString()}`);
  };

  return (
    <div className="p-4 flex items-center justify-between text-gray-500">
      <button
        disabled={!hasPrev}
        className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => changePage(page - 1)}
      >
        Prev
      </button>
      <div className="flex items-center gap-2 text-sm">
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
              return <span key={`dots-${index}`}>...</span>;
            }
            return (
              <button
                key={p}
                className={`px-2 rounded-sm ${
                  page === p ? "bg-lamaSky" : ""
                }`}
                onClick={() => changePage(p as number)}
              >
                {p}
              </button>
            );
          });
        })()}
      </div>
      <button
        disabled={!hasNext}
        className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={() => changePage(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
