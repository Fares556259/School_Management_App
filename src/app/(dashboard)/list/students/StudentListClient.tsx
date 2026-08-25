"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
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
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";
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
  totalThisMonth: number;
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
  totalThisMonth,
  relatedData,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isFilterPending, startTransition] = useTransition();
  const [isSearchPending, setIsSearchPending] = useState(false);
  const isPending = isFilterPending || isSearchPending;
  const currentClassId = searchParams.get("classId") || "";
  const [optimisticData, setOptimisticData] = useState(initialData);
  const [clientSearch, setClientSearch] = useState("");
  const [clientClassId, setClientClassId] = useState(searchParams.get("classId") || "");
  const [clientStatus, setClientStatus] = useState(searchParams.get("status") || "");

  useEffect(() => {
    setOptimisticData(initialData);
  }, [initialData]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t, locale } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: parseInt(c.value, 10),
    name: c.label,
  }));

  const schoolYearMonths = getSchoolYearMonths();

  const filteredData = optimisticData.filter(item => {
    if (clientSearch) {
      const match = item.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                    item.surname.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    `${item.name} ${item.surname}`.toLowerCase().includes(clientSearch.toLowerCase());
      if (!match) return false;
    }
    if (clientClassId && String(item.classId) !== clientClassId) {
      return false;
    }
    if (clientStatus) {
      const [mName, yStr] = selectedMonthKey.split(" ");
      const monthIdx = MONTHS.indexOf(mName) + 1;
      const yearVal = parseInt(yStr);
      const currentPayment = item.payments.find((p: any) => p.month === monthIdx && p.year === yearVal);
      const isPaid = currentPayment?.status === "PAID";
      const isPartial = currentPayment?.status === "PARTIAL";

      if (clientStatus === "PAID" && !isPaid) return false;
      if (clientStatus === "PARTIAL" && !isPartial) return false;
      if (clientStatus === "UNPAID" && (isPaid || isPartial)) return false;
    }
    return true;
  });

  const displayedData = filteredData;
  const displayTotalThisMonth = displayedData.length;
  const displayPaidThisMonth = displayedData.filter(item => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    return item.payments.some((p: any) => p.month === monthIdx && p.year === yearVal && p.status === "PAID");
  }).length;


  const ITEM_PER_PAGE = 10;
  const paginatedData = displayedData.slice((page - 1) * ITEM_PER_PAGE, page * ITEM_PER_PAGE);
  const displayCount = displayedData.length;


  const translatedColumns = columns
    .filter(c => c.accessor !== "studentId")
    .map(c => ({
      ...c,
      header: c.accessor === "info" ? t.students.info 
            : c.accessor === "grade" ? t.students.grade 
            : (c.accessor === "parent" || c.accessor === "phone") ? (t.students.parent || "Parent")
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
            src={(item.img && item.img !== "null" && item.img !== "undefined" && item.img.trim() !== "") ? item.img : "/noAvatar.png"}
            alt=""
            width={40}
            height={40}
            className="md:hidden xl:block w-10 h-10 rounded-full object-cover border border-[#dddddd]"
          />
          <div className="flex flex-col">
            <h3 className="text-[14px] font-medium text-[#181d26]">{item.name} {item.surname}</h3>
            <p className="text-[12px] text-[#5a5a5a]">{item.class?.name ?? t.students.noClass}</p>
          </div>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-[#41454d]">Level {item.level.level}</td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">
          {item.parent ? (
            <div className="flex flex-col">
              <span className="font-medium text-[#181d26]">{item.parent.name} {item.parent.surname}</span>
              {item.parent.phone && (
                <span className="text-[12px] text-[#71717a]">{item.parent.phone}</span>
              )}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">{t.students.notProvided}</span>
          )}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d] truncate max-w-[150px]" title={item.address || ""}>
          {item.address || <span className="text-[#a1a1aa] italic text-[13px]">{t.students.notProvided}</span>}
        </td>
        <td className="py-4 px-6">
          {isPaidThisMonth ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium whitespace-nowrap">
              {t.students.paid}
            </span>
          ) : isPartialThisMonth ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-orange-50 border border-orange-200 text-orange-700 text-[12px] font-medium whitespace-nowrap">
              {t.students.partial}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium whitespace-nowrap">
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
              tuitionFee={item.customTuition ?? item.level.tuitionFee}
              isPaid={isPaidThisMonth}
              isPartial={isPartialThisMonth}
              initialPaidAmount={currentPayment?.amount || 0}
              isAdmin={role === "admin"}
              monthName={selectedMonthKey}
              paidMonths={item.payments
                .filter(p => p.status === "PAID" || p.status === "PARTIAL")
                .map(p => `${MONTHS[p.month - 1]} ${p.year}`)}
              onSuccess={(newAmount, newStatus, targetMonth) => {
                setOptimisticData((prev: any[]) => prev.map((s: any) => {
                  if (s.id === item.id) {
                    const monthIdx = MONTHS.indexOf(targetMonth.split(" ")[0]) + 1;
                    const yearVal = parseInt(targetMonth.split(" ")[1]);
                    const payments = [...(s.payments || [])];
                    const existingIdx = payments.findIndex(p => p.month === monthIdx && p.year === yearVal);
                    if (existingIdx >= 0) {
                      payments[existingIdx] = { ...payments[existingIdx], amount: newAmount, status: newStatus };
                    } else {
                      payments.push({ month: monthIdx, year: yearVal, amount: newAmount, status: newStatus });
                    }
                    return { ...s, payments };
                  }
                  return s;
                }));
              }}
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
          total={displayTotalThisMonth}
          paidCount={displayPaidThisMonth}
          monthLabel={selectedMonthKey}
          entityName="students"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          {/* SEARCH AND FILTER */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <TableSearch clientSideOnly={true} onChangeImmediate={setClientSearch} />
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm min-w-[120px]"
              value={clientClassId}
              onChange={(e) => {
                setClientClassId(e.target.value);
              }}
            >
              <option value="">{locale === 'ar' ? 'جميع الأقسام' : locale === 'fr' ? 'Toutes les classes' : 'All Classes'}</option>
              {classList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* MONTH FILTER */}
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm min-w-[120px]"
              value={selectedMonthKey}
              onChange={(e) => {
                startTransition(() => {
                  const params = new URLSearchParams(searchParams.toString());
                  const val = e.target.value;
                  if (val) {
                    const [mName, yStr] = val.split(" ");
                    const mIdx = MONTHS.indexOf(mName);
                    params.set("month", `${mIdx}-${yStr}`);
                  } else {
                    params.delete("month");
                  }
                  params.delete("page");
                  router.push(`${pathname}?${params.toString()}`, { scroll: false });
                });
              }}
            >
              {schoolYearMonths.map(m => {
                const [mName, yStr] = m.split(" ");
                const mIdx = MONTHS.indexOf(mName);
                const translatedMonth = t.months?.[mIdx] || mName;
                return (
                  <option key={m} value={m}>{translatedMonth} {yStr}</option>
                );
              })}
            </select>

            {/* STATUS FILTER */}
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm min-w-[120px]"
              value={clientStatus}
              onChange={(e) => {
                setClientStatus(e.target.value);
              }}
            >
              <option value="">{locale === 'ar' ? 'جميع الحالات' : locale === 'fr' ? 'Tous les statuts' : 'All Statuses'}</option>
              <option value="PAID">{locale === 'ar' ? 'مدفوع' : locale === 'fr' ? 'Payé' : 'Paid'}</option>
              <option value="PARTIAL">{locale === 'ar' ? 'جزئي' : locale === 'fr' ? 'Partiel' : 'Partial'}</option>
              <option value="UNPAID">{locale === 'ar' ? 'غير مدفوع' : locale === 'fr' ? 'Non payé' : 'Unpaid'}</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end lg:self-auto shrink-0 mt-4 lg:mt-0 w-full lg:w-auto justify-end">
          {role === "admin" && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-semibold rounded-[6px] hover:bg-emerald-100 transition-all shadow-sm group shrink-0"
              >
                <Share2 size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>{locale === 'ar' ? 'التسجيلات' : locale === 'fr' ? 'Inscriptions' : 'Registrations'}</span>
              </button>
              <CrudFormModal entity="student" mode="create" relatedData={relatedData} />
            </div>
          )}
        </div>
      </div>

      {/* 3. TABLE & PAGINATION */}
      <div className={`transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <Table columns={translatedColumns} renderRow={renderRow} data={paginatedData} />
      </div>
      <Pagination page={page} count={displayCount} />

      {/* MODALS */}
      {isBulkOpen && (
        <BulkStudentImport onClose={() => setIsBulkOpen(false)} />
      )}
      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classes={classList}
        schoolName={relatedData.schoolName}
        schoolSubdomain={relatedData.schoolSubdomain}
        onApproved={() => router.refresh()}
      />
    </>
  );
}
