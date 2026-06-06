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
import ResetPasswordButton from "@/components/ResetPasswordButton";
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
  relatedData?: Record<string, { value: string; label: string }[]>;
}

export default function TeacherListClient({
  initialData,
  columns,
  count,
  page,
  role,
  selectedMonthKey,
  paidThisMonth,
  relatedData,
}: Props) {
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  const renderRow = (
    item: Teacher & { subjects: Subject[]; classes: Class[]; payments: Payment[]; timetable?: any[] }
  ) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const isPaidThisMonth = item.payments.some(
      (p) => p.month === monthIdx && p.year === yearVal && p.status === "PAID"
    );

    const allSubjectsMap = new Map();
    item.subjects?.forEach(s => allSubjectsMap.set(s.id, s));
    item.timetable?.forEach(t => { if (t.subject) allSubjectsMap.set(t.subject.id, t.subject); });
    const allSubjects = Array.from(allSubjectsMap.values());

    const allClassesMap = new Map();
    item.classes?.forEach(c => allClassesMap.set(c.id, c));
    item.timetable?.forEach(t => { if (t.class) allClassesMap.set(t.class.id, t.class); });
    const allClasses = Array.from(allClassesMap.values());

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
        <td className="hidden md:table-cell py-4 px-6 max-w-[200px]">
          {allSubjects.length > 0 ? (
            <div 
              className="text-[13px] font-medium text-blue-700 truncate bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-[6px]"
              title={allSubjects.map(s => s.name.split('|')[0].trim()).join(', ')}
            >
              {allSubjects.map(s => s.name.split('|')[0].trim()).join(', ')}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">No subjects</span>
          )}
        </td>
        <td className="hidden md:table-cell py-4 px-6 max-w-[150px]">
          {allClasses.length > 0 ? (
            <div 
              className="text-[13px] font-medium text-purple-700 truncate bg-purple-50 border border-purple-100 px-3 py-1.5 rounded-[6px]"
              title={allClasses.map(c => c.name).join(', ')}
            >
              {allClasses.map(c => c.name).join(', ')}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">No classes</span>
          )}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.phone || <span className="text-[#a1a1aa] italic text-[13px]">Not provided</span>}</td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d] truncate max-w-[150px]" title={item.address || ""}>{item.address || <span className="text-[#a1a1aa] italic text-[13px]">Not provided</span>}</td>
        <td className="py-4 px-6">
          {isPaidThisMonth ? (
            <span className="px-2 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium">
              Paid
            </span>
          ) : (
            <span className="px-2 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium">
              Unpaid
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          {item.password ? (
            <span className="px-2 py-1 rounded-[4px] bg-indigo-50 border border-indigo-200 text-indigo-700 text-[12px] font-medium">
              Activated
            </span>
          ) : (
            <span className="px-2 py-1 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-medium">
              Non-activated
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <TeacherDetailsModal teacher={item} />
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
            {role === "admin" && (
              <>
                <ResetPasswordButton teacherId={item.id} />
                <CrudFormModal entity="teacher" mode="update" data={item} id={item.id} relatedData={relatedData} />
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
                <CrudFormModal entity="teacher" mode="create" relatedData={relatedData} />
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
