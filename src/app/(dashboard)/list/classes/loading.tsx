import React from "react";
import TableSkeleton from "@/components/TableSkeleton";
import { cookies } from "next/headers";
import { translations, Locale } from "@/lib/translations";


export default function Loading() {
  const cookieStore = cookies();
  const locale = (cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;
  const t = translations[locale];

  
  const columns = [
    {
      header: t.classes.className,
      accessor: "name",
    },
    {
      header: t.classes.capacity,
      accessor: "capacity",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.level,
      accessor: "level",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.teachers,
      accessor: "teachers",
      className: "hidden md:table-cell",
    },
    {
      header: t.classes.actions,
      accessor: "action",
      className: "text-right",
    },
  ];

  return (
    <div className="bg-white p-6 rounded-[8px] border border-[#dddddd] shadow-sm flex-1 m-4 mt-0 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 bg-slate-200 animate-pulse rounded-md w-1/4" />
        <div className="h-8 bg-slate-200 animate-pulse rounded-md w-1/4" />
      </div>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div className="h-8 bg-slate-200 animate-pulse rounded-md w-1/3" />
        <div className="h-10 bg-slate-200 animate-pulse rounded-md w-full md:w-1/3" />
      </div>
      
      <TableSkeleton columns={columns} />
    </div>
  );
}
