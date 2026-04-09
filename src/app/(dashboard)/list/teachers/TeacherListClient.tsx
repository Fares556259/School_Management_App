"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkTeacherImport from "./BulkTeacherImport";
import { UserPlus, Sparkles } from "lucide-react";

interface Props {
  initialData: any[];
  columns: any[];
  renderRow: (item: any) => React.ReactNode;
  count: number;
  page: number;
  role: string | undefined;
}

export default function TeacherListClient({
  initialData,
  columns,
  renderRow,
  count,
  page,
  role,
}: Props) {
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-4 relative">
        {role === "admin" && (
          <div className="absolute right-0 top-[-60px] flex items-center gap-3">
             <button 
               onClick={() => setIsBulkOpen(true)}
               className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group"
             >
               <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
               AI Bulk Enroll
             </button>
          </div>
        )}
        
        <Table columns={columns} renderRow={renderRow} data={initialData} />
        <Pagination page={page} count={count} />
      </div>

      {isBulkOpen && (
        <BulkTeacherImport onClose={() => setIsBulkOpen(false)} />
      )}
    </>
  );
}
