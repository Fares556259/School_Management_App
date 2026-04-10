"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkStudentImport from "./BulkStudentImport";
import PayStudentModal from "./PayStudentModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";
import MonthSelector from "@/components/MonthSelector";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { Sparkles, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS } from "@/lib/dateUtils";
import { Student, Class, Level, Payment } from "@prisma/client";

interface Props {
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
  paidThisMonth: number;
  relatedData: any;
}

export default function StudentListClient({
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
    item: Student & { class: Class; level: Level; payments: Payment[] }
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
            className="md:hidden xl:block w-10 h-10 rounded-full object-cover"
          />
          <div className="flex flex-col">
            <h3 className="font-semibold">{item.name}</h3>
            <p className="text-xs text-gray-500">{item.class.name}</p>
          </div>
        </td>
        <td className="hidden md:table-cell">{item.username}</td>
        <td className="hidden md:table-cell">{item.level.level}</td>
        <td className="hidden lg:table-cell">{item.phone}</td>
        <td className="hidden lg:table-cell">{item.address}</td>
        <td>
          <PayStudentModal
            studentId={item.id}
            studentName={item.name + " " + item.surname}
            gradeLevel={item.level.level}
            isPaid={isPaidThisMonth}
            isAdmin={role === "admin"}
            monthName={selectedMonthKey}
            paidMonths={item.payments
              .filter(p => p.status === "PAID")
              .map(p => `${MONTHS[p.month - 1]} ${p.year}`)}
          />
        </td>
        <td className="hidden xl:table-cell">
          <PaymentTimeline payments={item.payments} />
        </td>
        <td>
          <div className="flex items-center gap-2">
            <Link href={`/list/students/${item.id}`}>
              <button className="w-7 h-7 flex items-center justify-center rounded-full bg-lamaSky">
                <Image src="/view.png" alt="" width={16} height={16} />
              </button>
            </Link>
            {role === "admin" && (
              <>
                <CrudFormModal entity="student" mode="update" data={item} id={item.id} relatedData={relatedData} />
                <CrudFormModal entity="student" mode="delete" id={item.id} />
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
          entityName="students"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="hidden md:block text-lg font-black text-slate-800 uppercase tracking-tight">All Students</h1>
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
                  className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-sky-700 transition-all shadow-lg shadow-sky-100 group shrink-0"
                >
                  <Sparkles size={14} className="group-hover:rotate-12 transition-transform" />
                  AI Bulk Enroll Students
                </button>
                <CrudFormModal entity="student" mode="create" relatedData={relatedData} />
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
        <BulkStudentImport onClose={() => setIsBulkOpen(false)} />
      )}
    </>
  );
}
