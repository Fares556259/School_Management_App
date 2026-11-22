"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import StudentBillingModal from "./StudentBillingModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import { schoolWorkspaceCopy } from "@/lib/schoolWorkspaceCopy";
import StudentDetailsModal from "@/components/StudentDetailsModal";
import AttendanceCertificateModal from "@/components/AttendanceCertificateModal";

import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Sparkles, Users, Eye, ExternalLink, Printer, Search, RotateCcw } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";
import { Student, Class, Level, Payment } from "@prisma/client";
import { getUserAvatar } from "@/lib/avatar";

import ShareParentLinkModal from "@/components/ShareParentLinkModal";
import { studentTuitionForMonth } from '@/lib/tuitionPolicy';
import BulkStudentImport from "./BulkStudentImport";
import { Share2 } from "lucide-react";

interface Props {
  halfBoundaryMonths?: boolean;
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
  paidThisMonth: number;
  partialThisMonth?: number;
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
  partialThisMonth = 0,
  totalThisMonth,
  relatedData,
  halfBoundaryMonths = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isFilterPending, startTransition] = useTransition();
  const [isSearchPending, setIsSearchPending] = useState(false);
  const isPending = isFilterPending || isSearchPending;
  const currentClassId = searchParams.get("classId") || "";
  const [optimisticData, setOptimisticData] = useState<any[]>(initialData || []);
  const [clientSearch, setClientSearch] = useState(searchParams.get("search") || "");
  const [clientClassId, setClientClassId] = useState(searchParams.get("classId") || "");
  const [clientLevelId, setClientLevelId] = useState(searchParams.get("levelId") || "");
  const [clientStatus, setClientStatus] = useState(searchParams.get("status") || "");
  const [clientMonthKey, setClientMonthKey] = useState(selectedMonthKey);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
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
    setOptimisticData(initialData || []);
  }, [initialData]);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { t, locale } = useLanguage();

  const classList = [
    { id: "unassigned", name: locale === 'ar' ? 'غير موزع على قسم' : (t.students?.noClass || 'Non classé') },
    ...(relatedData?.classId || []).map((c: any) => ({
      id: c.value === "null" ? "null" : parseInt(c.value, 10),
      name: c.label,
    }))
  ];

  const copy = schoolWorkspaceCopy[locale];
  const [draft, setDraft] = useState({ search: clientSearch, classId: clientClassId, status: clientStatus, month: clientMonthKey, levelId: clientLevelId });
  const applyFilters = (next: typeof draft) => {
    setClientLevelId(next.levelId);
    setClientSearch(next.search);
    setClientClassId(next.classId);
    setClientStatus(next.status);
    setClientMonthKey(next.month);
    handleFilterResetPage();
    updateUrl({ search: next.search, classId: next.classId, status: next.status, levelId: next.levelId, month: next.month });
  };
  const schoolYearMonths = getSchoolYearMonths();

  const matchesStudentScope = (item: any) => {
    if (clientLevelId && String(item.levelId) !== clientLevelId) return false;
    if (clientSearch) {
      const q = clientSearch.toLowerCase().trim();
      const fullName = `${item.name} ${item.surname}`.toLowerCase();
      const match = item.name.toLowerCase().includes(q) || 
                    item.surname.toLowerCase().includes(q) ||
                    fullName.includes(q) ||
                    (item.nationalId && String(item.nationalId).includes(q)) ||
                    (item.id && String(item.id).toLowerCase().includes(q));
      if (!match) return false;
    }
    if (clientClassId) {
      if (clientClassId === "unassigned") {
        if (item.classId !== null && item.classId !== undefined && item.classId !== 0) return false;
      } else if (String(item.classId) !== clientClassId) {
        return false;
      }
    }
    return true;
  };

  const filteredData = optimisticData.filter(item => {
    if (!matchesStudentScope(item)) return false;
    if (clientStatus) {
      const [mName, yStr] = (clientMonthKey || "").trim().split(/\s+/);
      const monthIdx = MONTHS.indexOf(mName) !== -1 ? MONTHS.indexOf(mName) + 1 : (new Date().getMonth() + 1);
      const yearVal = parseInt(yStr) || new Date().getFullYear();
      const currentPayment = item.payments?.find((p: any) => p.month === monthIdx && p.year === yearVal);
      const statusUpper = currentPayment?.status ? String(currentPayment.status).toUpperCase() : "";

      const tuition = studentTuitionForMonth(item, monthIdx, yearVal, halfBoundaryMonths);
      const amountPaid = ['PAID', 'PARTIAL'].includes(statusUpper) ? currentPayment?.amount || 0 : 0;
      const remaining = Math.max(0, tuition - amountPaid);
      const isPaid = remaining <= 0;
      const isPartial = !isPaid && (statusUpper === "PARTIAL" || (amountPaid > 0 && remaining > 0));
      const isUnpaid = !isPaid && !isPartial;

      if (clientStatus === "PAID" && !isPaid) return false;
      if (clientStatus === "PARTIAL" && !isPartial) return false;
      if (clientStatus === "UNPAID" && !isUnpaid) return false;
    }
    return true;
  });

  const displayedData = filteredData;

  // Month payment summary is based on the class/search filter, NOT restricted by the status filter itself
  const summaryBaseData = optimisticData.filter(matchesStudentScope);

  const [sumMName, sumYStr] = (clientMonthKey || "").trim().split(/\s+/);
  const sumMonthIdx = MONTHS.indexOf(sumMName) !== -1 ? MONTHS.indexOf(sumMName) + 1 : (new Date().getMonth() + 1);
  const sumYearVal = parseInt(sumYStr) || new Date().getFullYear();

  const displayTotalThisMonth = summaryBaseData.length;
  const displayPaidThisMonth = summaryBaseData.filter(item => {
    const currentPayment = item.payments?.find((p: any) => p.month === sumMonthIdx && p.year === sumYearVal);
    const statusUpper = currentPayment?.status ? String(currentPayment.status).toUpperCase() : "";
    const tuition = studentTuitionForMonth(item, sumMonthIdx, sumYearVal, halfBoundaryMonths);
    const amountPaid = ['PAID', 'PARTIAL'].includes(statusUpper) ? currentPayment?.amount || 0 : 0;
    const remaining = Math.max(0, tuition - amountPaid);
    return remaining <= 0;
  }).length;
  const displayPartialThisMonth = summaryBaseData.filter(item => {
    const currentPayment = item.payments?.find((p: any) => p.month === sumMonthIdx && p.year === sumYearVal);
    const statusUpper = currentPayment?.status ? String(currentPayment.status).toUpperCase() : "";
    const tuition = studentTuitionForMonth(item, sumMonthIdx, sumYearVal, halfBoundaryMonths);
    const amountPaid = ['PAID', 'PARTIAL'].includes(statusUpper) ? currentPayment?.amount || 0 : 0;
    const remaining = Math.max(0, tuition - amountPaid);
    const isPaid = remaining <= 0;
    return !isPaid && (statusUpper === "PARTIAL" || (amountPaid > 0 && remaining > 0));
  }).length;

  const ITEM_PER_PAGE = 25;
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
            : c.accessor === "nationalId" ? t.crud.fields["Unique Student Identifier"]
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
    const tuition = studentTuitionForMonth(item, monthIdx, yearVal, halfBoundaryMonths);
    const amountPaid = ['PAID', 'PARTIAL'].includes(statusUpper) ? currentPayment?.amount || 0 : 0;
    const remaining = Math.max(0, tuition - amountPaid);
    const isPaidThisMonth = remaining <= 0;
    const isPartialThisMonth = !isPaidThisMonth && (statusUpper === "PARTIAL" || (amountPaid > 0 && remaining > 0));

    return (
      <tr
        key={item.id}
        className="border-b border-ink-200 hover:bg-ink-50 transition-colors group"
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
              className="md:hidden xl:block w-10 h-10 rounded-full object-cover border border-ink-200 group-hover/name:border-blue-400 transition-colors"
            />
            <div className="flex flex-col">
              <h3 className="text-[14px] font-medium text-ink-900 group-hover/name:text-brand-600 group-hover/name:underline transition-colors">
                {item.name} {item.surname}
              </h3>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {item.class?.name ? (
                  <p className="text-[12px] text-[#5a5a5a] font-medium">{item.class.name}</p>
                ) : (
                  <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    {locale === 'ar' ? 'غير موزع على قسم' : (t.students?.noClass || "Non classé")}
                  </span>
                )}
                {item.address && (
                  <span className="text-[12px] text-slate-500 truncate max-w-[180px]" title={item.address}>
                    <span aria-hidden="true" className="mx-1">·</span>{item.address}
                  </span>
                )}
              </div>
            </div>
          </Link>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-ink-600">
          {item.level ? (item.level.level === 0 ? (locale === 'ar' ? 'تحضيري' : 'Préscolaire') : `${locale === 'ar' ? 'السنة' : (t.systemSettings?.level || "Niveau")} ${item.level.level}`) : "-"}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-ink-600">
          {item.parent ? (
            <div className="flex flex-col">
              <span className="font-medium text-ink-900">{item.parent.name} {item.parent.surname}</span>
              {item.parent.phone && (
                <span className="text-[12px] text-[#71717a]">{item.parent.phone}</span>
              )}
            </div>
          ) : (
            <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Sans parent
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          {item.nationalId ? (
            <span dir="ltr" className="inline-block font-mono text-[13px] font-semibold tracking-wide text-brand-700 bg-brand-50 border border-brand-100 rounded-md px-2.5 py-1 select-all whitespace-nowrap">
              {item.nationalId}
            </span>
          ) : <span className="text-slate-400 text-[13px]">{t.students.notProvided}</span>}
        </td>
        <td className="py-4 px-6">
          <div className="flex flex-wrap items-center gap-1.5">
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
          {(item as any).serviceAssignments?.some((assignment: any) => assignment.kind === 'GARDE') && (
            <span title={locale === 'ar' ? 'الحضانة' : locale === 'en' ? 'After-school care' : 'Garde'} className="rounded border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">
              {locale === 'ar' ? 'حضانة' : locale === 'en' ? 'Care' : 'Garde'}
            </span>
          )}
          {(item as any).serviceAssignments?.some((assignment: any) => assignment.kind === 'TRANSPORT') && (
            <span title={locale === 'ar' ? 'النقل' : locale === 'en' ? 'School bus' : 'Transport'} className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
              {locale === 'ar' ? 'نقل' : locale === 'en' ? 'Bus' : 'Transport'}
            </span>
          )}
          </div>
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <StudentDetailsModal 
              student={item} 
              className={item.class?.name ?? "No class"} 
              schoolName={relatedData?.schoolName || "SnapSchool"}
              adminName={relatedData?.adminName || "Administration"}
            />
            <AttendanceCertificateModal
              student={item}
              className={item.class?.name ?? ""}
              schoolName={relatedData?.schoolName || "SnapSchool"}
              adminName={relatedData?.adminName || "Administration"}
              delegation={relatedData?.delegation}
              schoolAddress={relatedData?.schoolAddress}
            />
            <StudentBillingModal
              studentId={item.id}
              studentName={`${item.name} ${item.surname}`}
              monthName={clientMonthKey}
              isAdmin={role === 'admin'}
              onTuitionPaid={(newAmount, newStatus, targetMonth) => {
                setOptimisticData(prev => prev.map(s => {
                  if (s.id !== item.id) return s;
                  const monthIdx = MONTHS.indexOf(targetMonth.split(' ')[0]) + 1;
                  const yearVal = Number(targetMonth.split(' ')[1]);
                  const payments = [...(s.payments || [])];
                  const index = payments.findIndex((p: any) => p.month === monthIdx && p.year === yearVal);
                  if (index >= 0) payments[index] = { ...payments[index], amount: newAmount, status: newStatus };
                  else payments.push({ month: monthIdx, year: yearVal, amount: newAmount, status: newStatus });
                  return { ...s, payments };
                }));
              }}
            />
            {role === "admin" && (
              <>
                <CrudFormModal entity="student" mode="update" data={item} id={item.id} relatedData={relatedData} />
                <CrudFormModal
                  entity="student"
                  mode="delete"
                  id={item.id}
                  onSuccess={(_, mode, deletedId) => {
                    if (mode === "delete" && deletedId) {
                      setOptimisticData((prev) => prev.filter((student) => student.id !== deletedId));
                    }
                  }}
                />
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
          partialCount={displayPartialThisMonth}
          monthLabel={clientMonthKey}
          entityName="students"
        />
      </div>

      <section className="school-panel school-search-panel" aria-labelledby="student-search-title">
        <h2 id="student-search-title" className="school-panel-heading">{copy.searchOptions}</h2>
        <form className="school-panel-body" onSubmit={event => { event.preventDefault(); applyFilters(draft); }}>
          <div className="school-search-grid">
            <label className="school-field">{copy.name}<input value={draft.search} onChange={event => setDraft({ ...draft, search: event.target.value })} /></label>
            <label className="school-field">{copy.level}
              <select value={draft.levelId} onChange={event => setDraft({ ...draft, levelId: event.target.value, classId: "" })}>
                <option value="">{copy.allLevels}</option>
                {(relatedData?.levelId || []).map((level: { value: string; label: string }) => <option key={level.value} value={level.value}>{level.label}</option>)}
              </select>
            </label>
            <label className="school-field">{copy.className}
              <select value={draft.classId} onChange={event => setDraft({ ...draft, classId: event.target.value })}>
                <option value="">{locale === "ar" ? "جميع الأقسام" : locale === "fr" ? "Toutes les classes" : "All classes"}</option>
                {classList.filter(c => c.id !== "null").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="school-field">{copy.month}
              <select value={draft.month} onChange={event => setDraft({ ...draft, month: event.target.value })}>
                {schoolYearMonths.map(month => { const [name, year] = month.split(" "); return <option key={month} value={month}>{t.months?.[MONTHS.indexOf(name)] || name} {year}</option>; })}
              </select>
            </label>
            <label className="school-field">{copy.status}
              <select value={draft.status} onChange={event => setDraft({ ...draft, status: event.target.value })}>
                <option value="">{locale === "ar" ? "جميع الحالات" : locale === "fr" ? "Tous les statuts" : "All statuses"}</option>
                <option value="PAID">{locale === "ar" ? "مدفوع" : locale === "fr" ? "Payé" : "Paid"}</option>
                <option value="PARTIAL">{locale === "ar" ? "تسبيق" : locale === "fr" ? "Avance" : "Advance"}</option>
                <option value="UNPAID">{locale === "ar" ? "غير مدفوع" : locale === "fr" ? "Non payé" : "Unpaid"}</option>
              </select>
            </label>
          </div>
          <div className="school-search-actions">
            <button type="submit" className="school-action"><Search size={15}/>{copy.search}</button>
            <button type="button" className="school-action school-action-secondary" onClick={() => { const cleared = { search: "", classId: "", status: "", month: selectedMonthKey, levelId: "" }; setDraft(cleared); applyFilters(cleared); }}><RotateCcw size={15}/>{copy.reset}</button>
          </div>
        </form>
      </section>
      <div className="school-student-actions">
          {role === "admin" && (
            <div className="flex items-center gap-2">
              {/^\d+$/.test(clientClassId) && (
                <Link
                  href={`/list/classes/${clientClassId}/parent-access`}
                  className="flex items-center gap-2 px-3.5 py-2.5 bg-white text-indigo-700 border border-indigo-200 text-[13px] font-semibold rounded-control hover:bg-indigo-50 transition-all shadow-sm shrink-0"
                >
                  <Printer size={15} />
                  <span>{locale === "ar" ? "بطاقات دخول الأولياء A4" : locale === "en" ? "Parent access · A4 slips" : "Accès parents · Fiches A4"}</span>
                </Link>
              )}
              <button 
                onClick={() => setIsBulkImportOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[13px] font-semibold rounded-control hover:bg-indigo-100 transition-all shadow-sm group shrink-0"
                title={locale === 'ar' ? 'استيراد التلاميذ (نص، صورة أو معرف تربوي)' : 'Importer des élèves'}
              >
                <Sparkles size={15} className="text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>{locale === 'ar' ? 'استيراد' : 'Importer'}</span>
              </button>
              <button 
                onClick={() => setIsShareModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[13px] font-semibold rounded-control hover:bg-emerald-100 transition-all shadow-sm group shrink-0"
              >
                <Share2 size={15} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                <span>{locale === 'ar' ? 'تحميل التطبيق' : locale === 'fr' ? 'Télécharger l’app' : 'Download app'}</span>
              </button>
              <CrudFormModal entity="student" mode="create" relatedData={relatedData} />
            </div>
          )}
      </div>

      {/* 3. TABLE & PAGINATION */}
      <h2 className="school-panel-heading rounded-t-md mb-0">{copy.studentList} · {displayCount}</h2>
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
          <>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1 font-medium">
              <span>
                {displayCount} {displayCount > 1 
                  ? (locale === "ar" ? "تلاميذ" : locale === "fr" ? "élèves" : "students") 
                  : (locale === "ar" ? "تلميذ" : locale === "fr" ? "élève" : "student")}
                {clientStatus === "UNPAID" 
                  ? ` (${locale === "ar" ? "غير مدفوع" : locale === "fr" ? "Non payé" : "Unpaid"})`
                  : clientStatus === "PARTIAL" 
                  ? ` (${locale === "ar" ? "تسبيق" : locale === "fr" ? "Avance" : "Advance"})`
                  : clientStatus === "PAID" 
                  ? ` (${locale === "ar" ? "مدفوع" : locale === "fr" ? "Payé" : "Paid"})`
                  : ""}
              </span>
              {totalPages > 1 && (
                <span>
                  Page {safePage} / {totalPages}
                </span>
              )}
            </div>
            <Table columns={translatedColumns} renderRow={renderRow} data={paginatedData} />
          </>
        )}
      </div>
      <Pagination 
        page={safePage} 
        count={displayCount} 
        itemPerPage={ITEM_PER_PAGE}
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
      {isBulkImportOpen && (
        <BulkStudentImport onClose={() => {
          setIsBulkImportOpen(false);
          router.refresh();
        }} />
      )}

      <ShareParentLinkModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        classes={classList}
        schoolName={relatedData?.schoolName || "SnapSchool"}
        schoolSubdomain={relatedData?.schoolSubdomain || "snapschool-academy"}
        onApproved={() => router.refresh()}
      />
    </>
  );
}
