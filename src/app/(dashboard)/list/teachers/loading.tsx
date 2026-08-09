import React from "react";
import TableSkeleton from "@/components/TableSkeleton";

export default function Loading() {
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
      
      {/* SKELETON COLUMNS */}
      <TableSkeleton 
        columns={[
          { header: "Info", accessor: "info" },
          { header: "Subjects", accessor: "subjects", className: "hidden md:table-cell" },
          { header: "Classes", accessor: "classes", className: "hidden md:table-cell" },
          { header: "Phone", accessor: "phone", className: "hidden lg:table-cell" },
          { header: "Status", accessor: "isPaid" },
          { header: "Actions", accessor: "action" },
        ]}
      />
    </div>
  );
}
