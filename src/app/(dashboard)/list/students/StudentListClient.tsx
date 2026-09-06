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
import { Sparkles, Users, Eye, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";
import { Student, Class, Level, Payment } from "@prisma/client";
import { getUserAvatar } from "@/lib/avatar";

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
  const [clientMonthKey, setClientMonthKey] = useState(selectedMonthKey);
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const p = Number(searchParams.get("page") || page);
    return !isNaN(p) && p > 0 ? p : 1;
  });

  useEffect(() => {
    const p = Number(searchParams.get("page") || page);
    if (!isNaN(p) && p > 0) {
      setCurrentPage(p);
    }
  }, [page, searchParams]);

  const updateUrl = (updates: Record<string, string | undefined>) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, val);
      }
    });
    window.history.replaceState({}, "", url.toString());
  };

  const handleFilterResetPage = () => {
    setCurrentPage(1);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("page");
      window.history.replaceState({}, "", url.toString());
    }
  };

  useEffect(() => {
    setOptimisticData(initialData);
  }, [initialData]);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t, locale } = useLanguage();

  const classList = (relatedData?.classId || []).map((c: any) => ({
    id: c.value === "null" ? "null" : parseInt(c.value, 10),
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
      const [mName, yStr] = (clientMonthKey || "").trim().split(/\s+/);
      const monthIdx = MONTHS.indexOf(mName) !== -1 ? MONTHS.indexOf(mName) + 1 : (new Date().getMonth() + 1);
      const yearVal = parseInt(yStr) || new Date().getFullYear();
      const currentPayment = item.payments?.find((p: any) => p.month === monthIdx && p.year === yearVal);
      const statusUpper = currentPayment?.status ? String(currentPayment.status).toUpperCase() : "";
      const isPaid = statusUpper === "PAID";
      const isPartial = statusUpper === "PARTIAL";

      if (clientStatus === "PAID" && !isPaid) return false;
      if (clientStatus === "PARTIAL" && !isPartial) return false;
      if (clientStatus === "UNPAID" && (isPaid || isPartial)) return false;
    }
    return true;
  });

  const displayedData = filteredData;

  // Month payment summary is based on the class/search filter, NOT restricted by the status filter itself
  const summaryBaseData = optimisticData.filter(item => {
    if (clientSearch) {
      const match = item.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
                    item.surname.toLowerCase().includes(clientSearch.toLowerCase()) ||
                    `${item.name} ${item.surname}`.toLowerCase().includes(clientSearch.toLowerCase());
      if (!match) return false;
    }
    if (clientClassId && String(item.classId) !== clientClassId) {
      return false;
    }
    return true;
  });

  const [sumMName, sumYStr] = (clientMonthKey || "").trim().split(/\s+/);
  const sumMonthIdx = MONTHS.indexOf(sumMName) !== -1 ? MONTHS.indexOf(sumMName) + 1 : (new Date().getMonth() + 1);
  const sumYearVal = parseInt(sumYStr) || new Date().getFullYear();

  const displayTotalThisMonth = summaryBaseData.length;
  const displayPaidThisMonth = summaryBaseData.filter(item => {
    return item.payments?.some((p: any) => {
      const st = p.status ? String(p.status).toUpperCase() : "";
      return p.month === sumMonthIdx && p.year === sumYearVal && st === "PAID";
    });
  }).length;

  const ITEM_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(displayedData.length / ITEM_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedData = displayedData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
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
    const [mName, yStr] = (clientMonthKey || "").trim().split(/\s+/);
    const monthIdx = MONTHS.indexOf(mName) !== -1 ? MONTHS.indexOf(mName) + 1 : (new Date().getMonth() + 1);
    const yearVal = parseInt(yStr) || new Date().getFullYear();

    const currentPayment = item.payments?.find(
      (p) => p.month === monthIdx && p.year === yearVal
    );

    const statusUpper = currentPayment?.status ? String(currentPayment.status).toUpperCase() : "";
    const isPaidThisMonth = statusUpper === "PAID";
    const isPartialThisMonth = statusUpper === "PARTIAL";

    return (
      <tr
        key={item.id}
        className="border-b border-[#dddddd] hover:bg-[#f8fafc] transition-colors group"
      >
        <td className="py-4 px-6">
          <Link
            href={`/list/students/${item.id}`}
            className="flex items-center gap-4 group/name"
          >
            <Image
              src={getUserAvatar(item.img, "student", item.sex)}
              alt=""
              width={40}
              height={40}
              className="md:hidden xl:block w-10 h-10 rounded-full object-cover border border-[#dddddd] group-hover/name:border-blue-400 transition-colors"
            />
            <div className="flex flex-col">
              <h3 className="text-[14px] font-medium text-[#181d26] group-hover/name:text-blue-600 group-hover/name:underline transition-colors">
                {item.name} {item.surname}
              </h3>
              <p className="text-[12px] text-[#5a5a5a]">{item.class?.name ?? t.students.noClass}</p>
            </div>
          </Link>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-[#41454d]">
          {item.classId ? `Level ${item.level.level}` : "-"}
        </td>
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
            <Link
              href={`/list/students/${item.id}`}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors text-[#41454d]"
              title="Profil complet"
            >
              <ExternalLink size={15} strokeWidth={2} />
            </Link>
            <PayStudentModal
              studentId={item.id}
              studentName={item.name + " " + item.surname}
              gradeLevel={item.level.level}
              tuitionFee={item.customTuition ?? item.level.tuitionFee}
              isPaid={isPaidThisMonth}
              isPartial={isPartialThisMonth}
              initialPaidAmount={currentPayment?.amount || 0}
              isAdmin={role === "admin"}
              monthName={clientMonthKey}
              payments={item.payments}
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
          monthLabel={clientMonthKey}
          entityName="students"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
        <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
          {/* SEARCH AND FILTER */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <TableSearch clientSideOnly={true} onChangeImmediate={(val) => {
              setClientSearch(val);
              handleFilterResetPage();
            }} />
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm min-w-[120px]"
              value={clientClassId}
              onChange={(e) => {
                const val = e.target.value;
                setClientClassId(val);
                handleFilterResetPage();
                updateUrl({ classId: val || undefined });
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
              value={clientMonthKey}
              onChange={(e) => {
                const val = e.target.value;
                setClientMonthKey(val);
                handleFilterResetPage();
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
                const val = e.target.value;
                setClientStatus(val);
                handleFilterResetPage();
                updateUrl({ status: val || undefined });
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
        {displayedData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mt-6">
            <Users className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="text-[14px] font-medium text-slate-700">
              {locale === "ar" ? "لم يتم العثور على أي طالب" : locale === "fr" ? "Aucun élève trouvé" : "No students found"}
            </p>
            <p className="text-[12px] text-slate-400 mt-1">
              {locale === "ar" ? "جرّب تغيير معايير البحث أو الفلترة" : locale === "fr" ? "Essayez de modifier vos critères de recherche ou de filtre" : "Try changing your search or filter criteria"}
            </p>
          </div>
        ) : (
          <Table columns={translatedColumns} renderRow={renderRow} data={paginatedData} />
        )}
      </div>
      <Pagination 
        page={safePage} 
        count={displayCount} 
        onPageChange={(newPage) => {
          setCurrentPage(newPage);
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            if (newPage === 1) {
              url.searchParams.delete("page");
            } else {
              url.searchParams.set("page", String(newPage));
            }
            window.history.replaceState({}, "", url.toString());
          }
        }} 
      />

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
