"use client";

import { useState } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import BulkStudentImport from "./BulkStudentImport";
import PayStudentModal from "./PayStudentModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";
import StudentDetailsModal from "@/components/StudentDetailsModal";

import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Sparkles, Users, Eye } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS } from "@/lib/dateUtils";
import { Student, Class, Level, Payment } from "@prisma/client";

import ShareParentLinkModal from "@/components/ShareParentLinkModal";
import { Share2 } from "lucide-react";

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
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: parseInt(c.value, 10),
    name: c.label,
  }));

  const translatedColumns = columns
    .filter(c => c.accessor !== "studentId")
    .map(c => ({
      ...c,
      header: c.accessor === "info" ? t.students.info 
            : c.accessor === "grade" ? t.students.grade 
            : c.accessor === "phone" ? t.students.phone 
            : c.accessor === "address" ? t.students.address 
            : c.accessor === "isPaid" ? t.students.paidStatus 
            : c.accessor === "action" ? t.students.actions 
            : c.header
    }));

  const renderRow = (
    item: Student & { class: Class | null; level: Level; payments: Payment[]; parent?: any }
  ) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const currentPayment = item.payments.find(
      (p) => p.month === monthIdx && p.year === yearVal
    );

    const isPaidThisMonth = currentPayment?.status === "PAID";
    const isPartialThisMonth = currentPayment?.status === "PARTIAL";

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
            <p className="text-[12px] text-[#5a5a5a]">{item.class?.name ?? t.students.noClass}</p>
          </div>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-[#41454d]">Level {item.level.level}</td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">
          {item.phone || <span className="text-[#a1a1aa] italic text-[13px]">{t.students.notProvided}</span>}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d] truncate max-w-[150px]" title={item.address || ""}>
          {item.address || <span className="text-[#a1a1aa] italic text-[13px]">{t.students.notProvided}</span>}
        </td>
        <td className="py-4 px-6">
          {isPaidThisMonth ? (
            <span className="px-2 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium">
              {t.students.paid}
            </span>
          ) : isPartialThisMonth ? (
            <span className="px-2 py-1 rounded-[4px] bg-orange-50 border border-orange-200 text-orange-700 text-[12px] font-medium">
              {t.students.partial}
            </span>
          ) : (
            <span className="px-2 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium">
              {t.students.unpaid}
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <StudentDetailsModal 
              student={item} 
              className={item.class?.name ?? "No class"} 
              schoolName={relatedData.schoolName}
              adminName={relatedData.adminName}
            />
            <PayStudentModal
              studentId={item.id}
              studentName={item.name + " " + item.surname}
              gradeLevel={item.level.level}
              tuitionFee={item.level.tuitionFee}
              isPaid={isPaidThisMonth}
              isPartial={isPartialThisMonth}
              initialPaidAmount={currentPayment?.amount || 0}
              isAdmin={role === "admin"}
              monthName={selectedMonthKey}
              paidMonths={item.payments
                .filter(p => p.status === "PAID" || p.status === "PARTIAL")
                .map(p => `${MONTHS[p.month - 1]} ${p.year}`)}
            />
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
      {/* 1. MONTH SUMMARY */}
      <div className="flex items-center justify-between mb-6">
        <MonthPaymentSummary
          total={initialData.length}
          paidCount={paidThisMonth}
          monthLabel={selectedMonthKey}
          entityName="students"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">{t.students.title}</h1>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 self-end md:self-auto">
            {role === "admin" && (
              <div className="flex items-center gap-2 ml-1">
                <button 
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-semibold rounded-[6px] hover:bg-emerald-100 transition-all shadow-sm group shrink-0"
                >
                  <Share2 size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span>Lien Parents (WhatsApp)</span>
                </button>
                <button 
                  onClick={() => setIsBulkOpen(true)}
                  className="hidden lg:flex items-center gap-2 px-4 py-2.5 bg-[#ffffff] text-[#181d26] border border-[#dddddd] text-[13px] font-medium rounded-[6px] hover:bg-[#f8fafc] transition-all shadow-sm group shrink-0"
                >
                  <Sparkles size={16} className="text-[#41454d] group-hover:rotate-12 transition-transform" />
                  {t.students.bulkEnroll}
                </button>
                <button 
                  onClick={() => setIsBulkOpen(true)}
                  className="lg:hidden w-10 h-10 flex items-center justify-center rounded-[6px] bg-white border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-all text-[#41454d]"
                  title={t.students.bulkEnroll}
                >
                  <Sparkles size={16} />
                </button>
                <CrudFormModal entity="student" mode="create" relatedData={relatedData} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABLE & PAGINATION */}
      <Table columns={translatedColumns} renderRow={renderRow} data={initialData} />
      <Pagination page={page} count={count} />

      {/* MODALS */}
      {isBulkOpen && (
        <BulkStudentImport onClose={() => setIsBulkOpen(false)} />
      )}
      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classes={classList}
        schoolName={relatedData.schoolName}
      />
    </>
  );
}
