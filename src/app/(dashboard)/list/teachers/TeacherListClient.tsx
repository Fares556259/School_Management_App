"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkTeacherImport from "./BulkTeacherImport";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import TeacherDetailsModal from "@/components/TeacherDetailsModal";
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
        className="border-b border-[#dddddd] hover:bg-[#f8fafc] transition-colors group"
      >
        <td className="flex items-center gap-4 py-4 px-6">
          <Image
            src={item.img || "/noavatar.png"}
            alt=""
            width={40}
            height={40}
            className="md:hidden xl:block w-10 h-10 rounded-full object-cover border border-[#dddddd]"
          />
          <div className="flex flex-col">
            <h3 className="text-[14px] font-medium text-[#181d26]">{item.name}</h3>
          </div>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.username}</td>
        <td className="hidden md:table-cell py-4 px-6">
          {item.subjects.length > 0 ? (
            <div className="relative group/subject">
              <div className="flex items-center gap-2 cursor-default bg-blue-50 text-blue-700 px-3 py-1.5 rounded-[6px] border border-blue-100 hover:bg-blue-100 transition-colors w-fit">
                <BookOpen size={14} className="text-blue-500" />
                <span className="font-medium text-[12px] tracking-wide">
                  {item.subjects[0].name}
                </span>
                {item.subjects.length > 1 && (
                  <div className="flex items-center gap-1 ml-1 pl-1 border-l border-blue-200">
                    <span className="text-[11px] text-blue-600">+{item.subjects.length - 1}</span>
                    <ChevronDown size={12} className="group-hover/subject:rotate-180 transition-transform" />
                  </div>
                )}
              </div>
              
              {item.subjects.length > 1 && (
                <div className="absolute top-full left-0 mt-2 hidden group-hover/subject:block z-50 bg-white border border-[#dddddd] rounded-[8px] shadow-lg p-2 min-w-[160px] animate-in fade-in zoom-in duration-200">
                  <p className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2 px-2">Assigned Subjects</p>
                  <div className="space-y-1">
                    {item.subjects.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8fafc] rounded-[6px] transition-colors group/item">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 group-hover/item:scale-125 transition-transform" />
                        <span className="text-[13px] font-medium text-[#41454d]">{s.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">No subjects</span>
          )}
        </td>
        <td className="hidden md:table-cell py-4 px-6">
          {item.classes.length > 0 ? (
            <div className="relative group/class">
              <div className="flex items-center gap-2 cursor-default bg-purple-50 text-purple-700 px-3 py-1.5 rounded-[6px] border border-purple-100 hover:bg-purple-100 transition-colors w-fit">
                <Layers size={14} className="text-purple-500" />
                <span className="font-medium text-[12px] tracking-wide">
                  {item.classes[0].name}
                </span>
                {item.classes.length > 1 && (
                  <div className="flex items-center gap-1 ml-1 pl-1 border-l border-purple-200">
                    <span className="text-[11px] text-purple-600">+{item.classes.length - 1}</span>
                    <ChevronDown size={12} className="group-hover/class:rotate-180 transition-transform" />
                  </div>
                )}
              </div>
              
              {item.classes.length > 1 && (
                <div className="absolute top-full left-0 mt-2 hidden group-hover/class:block z-50 bg-white border border-[#dddddd] rounded-[8px] shadow-lg p-2 min-w-[140px] animate-in fade-in zoom-in duration-200">
                  <p className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider mb-2 px-2">Teaching Classes</p>
                  <div className="space-y-1">
                    {item.classes.map((c) => (
                      <div key={c.id} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8fafc] rounded-[6px] transition-colors group/item">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 group-hover/item:scale-125 transition-transform" />
                        <span className="text-[13px] font-medium text-[#41454d]">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">No classes</span>
          )}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.phone || <span className="text-[#a1a1aa] italic text-[13px]">Not provided</span>}</td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d] truncate max-w-[150px]" title={item.address || ""}>{item.address || <span className="text-[#a1a1aa] italic text-[13px]">Not provided</span>}</td>
        <td className="hidden lg:table-cell py-4 px-6">
          {item.activated ? (
            <span className="px-2 py-1 rounded-[4px] bg-green-50 border border-green-200 text-green-700 text-[12px] font-medium">
              Activated
            </span>
          ) : (
            <span className="px-2 py-1 rounded-[4px] bg-slate-50 border border-slate-200 text-slate-500 text-[12px] font-medium">
              Pending
            </span>
          )}
        </td>
        <td className="py-4 px-6">
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
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <TeacherDetailsModal teacher={item} />
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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">Teachers</h1>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <div className="flex items-center gap-2 self-end md:self-auto">
            {role === "admin" && (
              <div className="flex items-center gap-2 ml-1">
                <button 
                  onClick={() => setIsBulkOpen(true)}
                  className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-[#ffffff] text-[#181d26] border border-[#dddddd] text-[13px] font-medium rounded-[6px] hover:bg-[#f8fafc] transition-all shadow-sm group shrink-0"
                >
                  <Sparkles size={16} className="text-[#41454d] group-hover:rotate-12 transition-transform" />
                  AI Bulk Enroll
                </button>
                <button 
                  onClick={() => setIsBulkOpen(true)}
                  className="lg:hidden w-10 h-10 flex items-center justify-center rounded-[6px] bg-white border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-all text-[#41454d]"
                  title="AI Bulk Enroll"
                >
                  <Sparkles size={16} />
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
