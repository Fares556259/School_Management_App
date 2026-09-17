"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import PaySalaryModal from "./PaySalaryModal";
import PaymentTimeline from "@/components/PaymentTimeline";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import ResetPasswordButton from "@/components/ResetPasswordButton";
import { ChevronDown, BookOpen, Layers, ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS, getSchoolYearMonths } from "@/lib/dateUtils";
import { Teacher, Subject, Class, Payment } from "@prisma/client";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { getUserAvatar } from "@/lib/avatar";

interface Props {
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
  paidThisMonth: number;
  partialThisMonth?: number;
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
  partialThisMonth = 0,
  relatedData,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isFilterPending, startTransition] = useTransition();
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const isPending = isFilterPending || isSearchPending;
  const currentClassId = searchParams.get("classId") || "";
  const [optimisticData, setOptimisticData] = useState(initialData);
  useEffect(() => {
    setOptimisticData(initialData);
  }, [initialData]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientClassId, setClientClassId] = useState(searchParams.get("classId") || "");
  const [clientMonthKey, setClientMonthKey] = useState(selectedMonthKey);
  const [clientStatus, setClientStatus] = useState("");
  const { t, locale } = useLanguage();
  const schoolYearMonths = getSchoolYearMonths();

  const classList = (relatedData?.classes || []).map((c: any) => ({
    id: c.value,
    name: c.label,
  }));

  
  
  const filteredData = optimisticData.filter((item: any) => {
    if (clientClassId && !item.classes?.some((c: any) => String(c.id) === clientClassId)) {
      return false;
    }
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesSubjects = item.subjects?.some((sub: any) => sub.name?.toLowerCase().includes(s));
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesSubjects) return false;
    }
    if (clientStatus) {
      const [mName, yStr] = (clientMonthKey || "").trim().split(/\s+/);
      const monthIdx = MONTHS.indexOf(mName) !== -1 ? MONTHS.indexOf(mName) + 1 : (new Date().getMonth() + 1);
      const yearVal = parseInt(yStr) || new Date().getFullYear();
      const payment = item.payments?.find((p: any) => p.month === monthIdx && p.year === yearVal);
      const actualStatus = payment?.status ? String(payment.status).toUpperCase() : "UNPAID";
      const amountPaid = payment?.amount || 0;
      const baseSalary = item.salary || 0;

      const isPaid = actualStatus === "PAID" || (baseSalary > 0 && amountPaid >= baseSalary);
      const isPartial = !isPaid && (actualStatus === "PARTIAL" || (amountPaid > 0 && (baseSalary <= 0 || amountPaid < baseSalary)));
      const isUnpaid = !isPaid && !isPartial;

      if (clientStatus === "PAID" && !isPaid) return false;
      if (clientStatus === "PARTIAL" && !isPartial) return false;
      if (clientStatus === "UNPAID" && !isUnpaid) return false;
    }
    return true;
  });

  // Base data for summary card (ignores clientStatus filter, respects class and search filters)
  const summaryBaseData = optimisticData.filter((item: any) => {
    if (clientClassId && !item.classes?.some((c: any) => String(c.id) === clientClassId)) {
      return false;
    }
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesSubjects = item.subjects?.some((sub: any) => sub.name?.toLowerCase().includes(s));
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesSubjects) return false;
    }
    return true;
  });

  const [sumMName, sumYStr] = (clientMonthKey || "").trim().split(/\s+/);
  const sumMonthIdx = MONTHS.indexOf(sumMName) !== -1 ? MONTHS.indexOf(sumMName) + 1 : (new Date().getMonth() + 1);
  const sumYearVal = parseInt(sumYStr) || new Date().getFullYear();

  const displayTotalCount = summaryBaseData.length;
  const displayPaidCount = summaryBaseData.filter((t: any) => {
    const payment = t.payments?.find((p: any) => p.month === sumMonthIdx && p.year === sumYearVal);
    const actualStatus = payment?.status ? String(payment.status).toUpperCase() : "UNPAID";
    const amountPaid = payment?.amount || 0;
    const baseSalary = t.salary || 0;
    return actualStatus === "PAID" || (baseSalary > 0 && amountPaid >= baseSalary);
  }).length;
  const displayPartialCount = summaryBaseData.filter((t: any) => {
    const payment = t.payments?.find((p: any) => p.month === sumMonthIdx && p.year === sumYearVal);
    const actualStatus = payment?.status ? String(payment.status).toUpperCase() : "UNPAID";
    const amountPaid = payment?.amount || 0;
    const baseSalary = t.salary || 0;
    const isPaid = actualStatus === "PAID" || (baseSalary > 0 && amountPaid >= baseSalary);
    return !isPaid && (actualStatus === "PARTIAL" || (amountPaid > 0 && (baseSalary <= 0 || amountPaid < baseSalary)));
  }).length;

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

  const ITEM_PER_PAGE = 25;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / ITEM_PER_PAGE));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedData = filteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = filteredData.length;

  const translatedColumns = columns.map((c: any) => ({
    ...c,
    header: c.accessor === "info" ? t.teachers.info
          : c.accessor === "subjects" ? t.teachers.subjects
          : c.accessor === "classes" ? t.teachers.classes
          : c.accessor === "phone" ? t.teachers.phone
          : c.accessor === "address" ? t.teachers.address
          : c.accessor === "isPaid" ? t.teachers.paidStatus
          : c.accessor === "isActivated" ? t.teachers.activation
          : c.accessor === "action" ? t.teachers.actions
          : c.header
  }));

  const renderRow = (
    item: Teacher & { subjects: Subject[]; classes: Class[]; payments: Payment[]; timetable?: any[] }
  ) => {
    const [mName, yStr] = clientMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const paymentThisMonth = item.payments.find(
      (p) => p.month === monthIdx && p.year === yearVal
    );
    const actualStatus = paymentThisMonth?.status ? String(paymentThisMonth.status).toUpperCase() : "UNPAID";
    const amountPaid = paymentThisMonth?.amount || 0;
    const baseSalary = item.salary || 0;
    const isPaidThisMonth = actualStatus === "PAID" || (baseSalary > 0 && amountPaid >= baseSalary);
    const isPartialThisMonth = !isPaidThisMonth && (actualStatus === "PARTIAL" || (amountPaid > 0 && (baseSalary <= 0 || amountPaid < baseSalary)));

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
        <td className="py-4 px-6">
          <Link
            href={`/list/teachers/${item.id}`}
            className="flex items-center gap-4 group/name"
          >
            <Image
              src={getUserAvatar(item.img, "teacher", item.sex)}
              alt=""
              width={40}
              height={40}
              className="md:hidden xl:block w-10 h-10 rounded-full object-cover border border-[#dddddd] group-hover/name:border-blue-400 transition-colors"
            />
            <div className="flex flex-col">
              <h3 className="text-[14px] font-medium text-[#181d26] group-hover/name:text-blue-600 group-hover/name:underline transition-colors">
                {item.name} {item.surname}
              </h3>
            </div>
          </Link>
        </td>
        <td className="hidden md:table-cell py-4 px-6 max-w-[200px]">
          {allSubjects.length > 0 ? (
            <div 
              className="text-[13px] font-medium text-blue-700 truncate bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-[6px]"
              title={allSubjects.map(s => s.name.split('|')[0].trim()).join(', ')}
            >
              {allSubjects.map(s => s.name.split('|')[0].trim()).join(', ')}
            </div>
          ) : (
            <span className="text-[#a1a1aa] italic text-[13px]">{t.teachers.noSubjects}</span>
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
            <span className="text-[#a1a1aa] italic text-[13px]">{t.teachers.noClasses}</span>
          )}
        </td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.phone || <span className="text-[#a1a1aa] italic text-[13px]">{t.teachers.notProvided}</span>}</td>
        <td className="py-4 px-6">
          {isPaidThisMonth ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.paid}
            </span>
          ) : isPartialThisMonth ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-purple-50 border border-purple-200 text-purple-700 text-[12px] font-medium whitespace-nowrap">
              {(t.teachers as any).partial || "Avance"}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.unpaid}
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          {item.password ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-indigo-50 border border-indigo-200 text-indigo-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.activated}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-medium whitespace-nowrap">
              {t.teachers.nonActivated}
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <Link
              href={`/list/teachers/${item.id}`}
              className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors text-[#41454d]"
              title="Profil complet"
            >
              <ExternalLink size={15} strokeWidth={2} />
            </Link>
            <PaySalaryModal 
              teacherId={item.id} 
              teacherName={item.name + " " + item.surname}
              salary={item.salary}
              hourlyRate={item.hourlyRate || undefined}
              hoursPerMonth={item.hoursPerMonth || undefined}
              isPaid={isPaidThisMonth} 
              isAdmin={role === "admin"} 
              monthName={clientMonthKey}
              payments={item.payments}
              paidMonths={item.payments
                .filter(p => p.status === "PAID" && p.month > 0 && p.month <= 12)
                .map(p => `${MONTHS[p.month - 1] || "Unknown"} ${p.year}`)}
              onSuccess={(newStatus, targetMonth, amountPaidNow) => {
                setOptimisticData((prev: any[]) => prev.map((t: any) => {
                  if (t.id === item.id) {
                    const monthIdx = MONTHS.indexOf(targetMonth.split(" ")[0]) + 1;
                    const yearVal = parseInt(targetMonth.split(" ")[1]);
                    const payments = [...(t.payments || [])];
                    const existingIdx = payments.findIndex(p => p.month === monthIdx && p.year === yearVal);
                    if (existingIdx >= 0) {
                      payments[existingIdx] = { ...payments[existingIdx], status: newStatus, amount: (payments[existingIdx].amount || 0) + amountPaidNow };
                    } else {
                      payments.push({ month: monthIdx, year: yearVal, status: newStatus, amount: amountPaidNow });
                    }
                    return { ...t, payments };
                  }
                  return t;
                }));
              }}
              onRollback={(targetMonth, prevPayment) => {
                setOptimisticData((prev: any[]) => prev.map((t: any) => {
                  if (t.id === item.id) {
                    const monthIdx = MONTHS.indexOf(targetMonth.split(" ")[0]) + 1;
                    const yearVal = parseInt(targetMonth.split(" ")[1]);
                    const payments = [...(t.payments || [])];
                    const existingIdx = payments.findIndex(p => p.month === monthIdx && p.year === yearVal);
                    if (prevPayment) {
                      if (existingIdx >= 0) payments[existingIdx] = prevPayment;
                      else payments.push(prevPayment);
                    } else {
                      if (existingIdx >= 0) payments.splice(existingIdx, 1);
                    }
                    return { ...t, payments };
                  }
                  return t;
                }));
              }}
              onMissedHoursUpdate={(targetMonth, newTotal) => {
                setOptimisticData((prev: any[]) => prev.map((t: any) => {
                  if (t.id === item.id) {
                    const monthIdx = MONTHS.indexOf(targetMonth.split(" ")[0]) + 1;
                    const yearVal = parseInt(targetMonth.split(" ")[1]);
                    const payments = [...(t.payments || [])];
                    const existingIdx = payments.findIndex(p => p.month === monthIdx && p.year === yearVal);
                    if (existingIdx >= 0) {
                      payments[existingIdx] = { ...payments[existingIdx], missedHours: newTotal };
                    } else {
                      payments.push({ month: monthIdx, year: yearVal, status: "PENDING", missedHours: newTotal });
                    }
                    return { ...t, payments };
                  }
                  return t;
                }));
              }}
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
          total={displayTotalCount}
          paidCount={displayPaidCount}
          partialCount={displayPartialCount}
          monthLabel={clientMonthKey}
          entityName="teachers"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">{t.teachers.title}</h1>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          {/* SEARCH AND FILTER */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <TableSearch clientSideOnly onChangeImmediate={(val) => {
              setClientSearch(val);
              setCurrentPage(1);
            }} />
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm"
              
              onChange={(e) => {
                setClientClassId(e.target.value);
                setCurrentPage(1);
              }}
              value={clientClassId}
            >
              <option value="">{t.teachers.allClasses}</option>
              {classList.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {/* MONTH FILTER */}
            <select
              className="bg-white border border-[#dddddd] rounded-[6px] px-3 py-2 text-[13px] font-medium text-[#181d26] focus:outline-none focus:border-[#1b61c9] focus:ring-1 focus:ring-[#1b61c9] transition-all shadow-sm min-w-[120px]"
              value={clientMonthKey}
              onChange={(e) => {
                setClientMonthKey(e.target.value);
                setCurrentPage(1);
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
                setCurrentPage(1);
              }}
            >
              <option value="">{locale === 'ar' ? 'جميع الحالات' : locale === 'fr' ? 'Tous les statuts' : 'All Statuses'}</option>
              <option value="PAID">{locale === 'ar' ? 'مدفوع' : locale === 'fr' ? 'Payé' : 'Paid'}</option>
              <option value="PARTIAL">{locale === 'ar' ? 'تسبيق' : locale === 'fr' ? 'Avance' : 'Advance'}</option>
              <option value="UNPAID">{locale === 'ar' ? 'غير مدفوع' : locale === 'fr' ? 'Non payé' : 'Unpaid'}</option>
            </select>
          </div>
          <div className="flex items-center gap-2 self-end md:self-auto">
            {role === "admin" && (
              <div className="flex items-center gap-2 ml-1">
                <CrudFormModal entity="teacher" mode="create" relatedData={relatedData} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABLE & PAGINATION */}
      <div className={`transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        {filteredData.length === 0 ? (
          <div className="py-16 text-center text-slate-500 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 mt-6">
            <p className="text-[14px] font-medium text-slate-700">
              {locale === "ar" ? "لم يتم العثور على أي أستاذ" : locale === "fr" ? "Aucun enseignant trouvé" : "No teachers found"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1 font-medium">
              <span>
                {displayCount} {displayCount > 1 
                  ? (locale === "ar" ? "أساتذة" : locale === "fr" ? "enseignants" : "teachers") 
                  : (locale === "ar" ? "أستاذ" : locale === "fr" ? "enseignant" : "teacher")}
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
        onPageChange={(newPage) => setCurrentPage(newPage)}
      />

    </>
  );
}
