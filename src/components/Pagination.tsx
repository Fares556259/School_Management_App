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
    <div className="pt-6 mt-4 flex items-center justify-between text-[#41454d]">
      <button
        disabled={!hasPrev}
        className="py-2.5 px-5 rounded-[8px] border border-[#dddddd] bg-white text-[13px] font-medium hover:bg-slate-50 disabled:opacity-40 transition-all disabled:cursor-not-allowed"
        onClick={() => changePage(page - 1)}
      >
        Previous
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
                className={`w-8 h-8 rounded-[8px] flex items-center justify-center text-[13px] font-medium transition-all border ${
                  page === p ? "bg-[#181d26] text-white border-[#181d26]" : "border-transparent hover:bg-slate-100 text-[#41454d]"
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
        className="py-2.5 px-5 rounded-[8px] border border-[#dddddd] bg-white text-[13px] font-medium hover:bg-slate-50 disabled:opacity-40 transition-all disabled:cursor-not-allowed"
        onClick={() => changePage(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

export default Pagination;
