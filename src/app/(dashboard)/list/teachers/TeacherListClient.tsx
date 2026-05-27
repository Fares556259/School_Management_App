"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkTeacherImport from "./BulkTeacherImport";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";

import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { Sparkles, ChevronDown, BookOpen, Layers } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS } from "@/lib/dateUtils";
import { Teacher, Subject, Class, Payment } from "@prisma/client";

interface Props {
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
  paidThisMonth: number;
}

export default function TeacherListClient({
  initialData,
  columns,
  count,
  page,
  role,
  selectedMonthKey,
  paidThisMonth,
}: Props) {
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const renderRow = (
    item: Teacher & { subjects: Subject[]; classes: Class[]; payments: Payment[] }
  ) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const isPaidThisMonth = item.payments.some(
      (p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID"
    );

    return (
      <tr
        key={item.id}
        className="border-b border-gray-200 even:bg-slate-50 text-sm hover:bg-lamaPurpleLight"
      >
        <td className="flex items-center gap-4 p-4">
          <Image
            src={item.img || "/noavatar.png"}
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.name}</h3>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.username}</td>
        <td className="hidden md:table-cell p-4">
          {item.subjects.length > 0 ? (
            <div className="relative group">
              <div className="flex items-center gap-2 cursor-default bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-100 hover:bg-blue-100 transition-colors w-fit">
                <BookOpen size={14} className="text-blue-500" />
                <span className="font-bold text-[11px] uppercase tracking-wide">
                  {item.subjects[0].name}
                </span>
                {item.subjects.length > 1 && (
                  <div className="flex items-center gap-1 ml-1 pl-1 border-l border-blue-200">
                    <span className="text-[10px] text-blue-600">+{item.subjects.length - 1}</span>
                    <ChevronDown size={12} className="group-hover:rotate-180 transition-transform" />
                  </div>
                )}
              </div>
              
              {item.subjects.length > 1 && (
                <div className="absolute top-full left-0 mt-2 hidden group-hover:block z-50 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 min-w-[160px] animate-in fade-in zoom-in duration-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Assigned Subjects</p>
                  <div className="space-y-1">
                    {item.subjects.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors group/item">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover/item:scale-125 transition-transform" />
                        <span className="text-xs font-bold text-slate-600">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic text-xs">No subjects</span>
          )}
        </td>
        <td className="hidden md:table-cell p-4">
          {item.classes.length > 0 ? (
            <div className="relative group">
              <div className="flex items-center gap-2 cursor-default bg-purple-50 text-purple-700 px-3 py-1.5 rounded-xl border border-purple-100 hover:bg-purple-100 transition-colors w-fit">
                <Layers size={14} className="text-purple-500" />
                <span className="font-bold text-[11px] uppercase tracking-wide">
                  {item.classes[0].name}
                </span>
                {item.classes.length > 1 && (
                  <div className="flex items-center gap-1 ml-1 pl-1 border-l border-purple-200">
                    <span className="text-[10px] text-purple-600">+{item.classes.length - 1}</span>
                    <ChevronDown size={12} className="group-hover:rotate-180 transition-transform" />
                  </div>
                )}
              </div>
              
              {item.classes.length > 1 && (
                <div className="absolute top-full left-0 mt-2 hidden group-hover:block z-50 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 min-w-[140px] animate-in fade-in zoom-in duration-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Teaching Classes</p>
                  <div className="space-y-1">
                    {item.classes.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 rounded-xl transition-colors group/item">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover/item:scale-125 transition-transform" />
                        <span className="text-xs font-bold text-slate-600">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-slate-400 italic text-xs">No classes</span>
          )}
        </td>
        <td className="hidden lg:table-cell">{item.phone}</td>
        <td className="hidden lg:table-cell">{item.address}</td>
        <td className="hidden lg:table-cell">
          {item.activated ? (
            <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              Activated
            </span>
          ) : (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
              Pending
            </span>
          )}
        </td>
        <td>
          <PaySalaryModal 
            teacherId={item.id} 
            teacherName={item.name + " " + item.surname}
            salary={item.salary}
            isPaid={isPaidThisMonth} 
            isAdmin={role === "admin"} 
            monthName={selectedMonthKey}
            paidMonths={item.payments
              .filter(p => p.status === "PAID" && p.month > 0 && p.month <= 12)
              .map(p => `${MONTHS[p.month - 1] || "Unknown"} ${p.year}`)}
          />
        </td>
        <td className="hidden xl:table-cell">
          <PaymentTimeline payments={item.payments} selectedMonthKey={selectedMonthKey} />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/teachers/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            {role === "admin" && (
              <>
                <CrudFormModal entity="teacher" mode="update" data={item} id={item.id} />
                <CrudFormModal entity="teacher" mode="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <>
      {/* 1. MONTH SUMMARY */}
      <div className="flex items-center justify-between mb-6">
        <MonthPaymentSummary
          total={initialData.length}
          paidCount={paidThisMonth}
          monthLabel={selectedMonthKey}
          entityName="teachers"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-black text-slate-800 uppercase tracking-tight">All Teachers</h1>
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-3 self-end">
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-lamaYellow border border-amber-200 shadow-sm hover:shadow transition-all">
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
            <button className="w-9 h-9 flex items-center justify-center rounded-xl bg-lamaYellow border border-amber-200 shadow-sm hover:shadow transition-all">
              <Image src="/sort.png" alt="" width={14} height={14} />
            </button>
            
            {role === "admin" && (
              <div className="flex items-center gap-2 ml-2">
                <button 
                  onClick={() => setIsBulkOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 group shrink-0"
                >
                  <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                  AI Bulk Enroll
                </button>
                <CrudFormModal entity="teacher" mode="create" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABLE & PAGINATION */}
      <Table columns={columns} renderRow={renderRow} data={initialData} />
      <Pagination page={page} count={count} />

      {/* MODALS */}
      {isBulkOpen && (
        <BulkTeacherImport onClose={() => setIsBulkOpen(false)} />
      )}
    </>
  );
}
