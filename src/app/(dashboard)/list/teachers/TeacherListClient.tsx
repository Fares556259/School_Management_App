"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkTeacherImport from "./BulkTeacherImport";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";
import MonthSelector from "@/components/MonthSelector";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { Sparkles } from "lucide-react";
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
            <p className="text-xs text-gray-500">{item?.email}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.username}</td>
        <td className="hidden md:table-cell">
          {item.subjects.map((s) => s.name).join(",")}
        </td>
        <td className="hidden md:table-cell">
          {item.classes.map((c) => c.name).join(",")}
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
          <PaymentTimeline payments={item.payments} />
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
      {/* 1. MONTH NAVIGATOR & SUMMARY */}
      <MonthSelector />
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
