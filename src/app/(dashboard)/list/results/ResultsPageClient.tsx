"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import GradeSheetRecorder from "../../admin/grades/GradeSheetRecorder";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import TableSearch from "@/components/TableSearch";

interface Props {
  role: string | undefined;
  sheets: any[];
  classes: any[];
  subjects: any[];
  teachers: any[];
  initialStudents: any[];
  data: any[];
  count: number;
  page: number;
  columns: any[];
  renderRow: (item: any) => React.ReactNode;
}

export default function ResultsPageClient({
  role,
  sheets,
  classes,
  subjects,
  teachers,
  initialStudents,
  data,
  count,
  page,
  columns,
  renderRow,
}: Props) {
  const [view, setView] = useState<"recorder" | "history">("recorder");

  if (view === "recorder") {
    return (
      <div className="flex flex-col h-screen bg-slate-50 relative">
        <div className="absolute top-4 right-6 z-50">
          <button
            onClick={() => setView("history")}
            className="px-4 py-2 bg-white text-slate-500 font-bold text-[10px] uppercase tracking-widest rounded-xl shadow-sm border border-slate-100 hover:bg-slate-50 transition-all"
          >
            Switch to History View 📜
          </button>
        </div>
        <GradeSheetRecorder
          students={initialStudents}
          subjects={subjects}
          classes={classes}
          teachers={teachers}
          initialClassId={classes[0]?.id}
          onCloseRedirect="/list/results"
        />
      </div>
    );
  }

  return (
    <div className="p-6 flex flex-col gap-6 bg-slate-50 min-h-screen">
      <div className="flex items-center justify-between bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">HISTORICAL AUDIT</h1>
          <p className="text-sm text-slate-500 font-medium tracking-tight uppercase tracking-widest text-[10px]">Review and search all digital result entries</p>
        </div>
        <button
          onClick={() => setView("recorder")}
          className="px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:-translate-y-0.5 transition-all text-[11px] uppercase tracking-widest"
        >
          ← Back to Recorder
        </button>
      </div>

      {/* RECENT SHEETS (Optional in history view) */}
      {sheets.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Verified Proofs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {sheets.map((sheet) => (
              <div key={sheet.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                   <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-sm">📄</div>
                   <a href={sheet.proofUrl} target="_blank" className="text-[10px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">VIEW</a>
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 truncate">{sheet.subject.name}</p>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{sheet.class.name} · Term {sheet.term}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLE */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <TableSearch />
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-50 border border-slate-100">
               <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
          </div>
        </div>

        <Table columns={columns} renderRow={renderRow} data={data} />
        <Pagination page={page} count={count} />
      </div>
    </div>
  );
}
