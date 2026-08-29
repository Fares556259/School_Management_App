"use client";

import { useState, useEffect } from "react";
import Table from "@/components/Table";
import Pagination from "@/components/Pagination";
import PayStaffModal from "./PayStaffModal";
import CrudFormModal from "@/components/CrudFormModal";
import TableSearch from "@/components/TableSearch";
import MonthPaymentSummary from "@/components/MonthPaymentSummary";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MONTHS } from "@/lib/dateUtils";
import { Staff, Payment } from "@prisma/client";

import { useLanguage } from "@/lib/translations/LanguageContext";

interface Props {
  initialData: any[];
  columns: any[];
  count: number;
  page: number;
  role: string | undefined;
  selectedMonthKey: string;
  paidThisMonth: number;
}

export default function StaffListClient({
  initialData,
  columns,
  count,
  page,
  role,
  selectedMonthKey,
  paidThisMonth,
}: Props) {
  const [optimisticData, setOptimisticData] = useState(initialData);
  useEffect(() => {
    setOptimisticData(initialData);
  }, [initialData]);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const [clientSearch, setClientSearch] = useState("");
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const { t } = useLanguage();

  
  const filteredData = initialData.filter((item: any) => {
    if (clientSearch) {
      const s = clientSearch.toLowerCase();
      const matchesName = item.name?.toLowerCase().includes(s);
      const matchesSurname = item.surname?.toLowerCase().includes(s);
      const matchesPhone = item.phone?.toLowerCase().includes(s);
      const matchesRole = item.role?.toLowerCase().includes(s);
      if (!matchesName && !matchesSurname && !matchesPhone && !matchesRole) return false;
    }
    return true;
  });

  const ITEM_PER_PAGE = 10;
  const safePage = (page && !isNaN(page) && page > 0) ? page : 1;
  const paginatedData = filteredData.slice((safePage - 1) * ITEM_PER_PAGE, safePage * ITEM_PER_PAGE);
  const displayCount = filteredData.length;

  const translatedColumns = columns.map((c: any) => ({
    ...c,
    header: c.accessor === "info" ? t.staff.info
          : c.accessor === "role" ? t.staff.role
          : c.accessor === "phone" ? t.staff.phone
          : c.accessor === "salary" ? t.staff.salary
          : c.accessor === "isPaid" ? t.staff.paidStatus
          : c.accessor === "action" ? t.staff.actions
          : c.header
  }));

  const renderRow = (
    item: Staff & { payments: Payment[] }
  ) => {
    const [mName, yStr] = selectedMonthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);

    const paymentThisMonth = item.payments.find(
      (p) => p.month === monthIdx && p.year === yearVal
    );
    const paymentStatusThisMonth = paymentThisMonth?.status || "UNPAID";
    const isPaidThisMonth = paymentStatusThisMonth === "PAID";

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
          </div>
        </td>
        <td className="hidden md:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.role}</td>
        <td className="hidden lg:table-cell py-4 px-6 text-[14px] text-[#41454d]">{item.phone || <span className="text-[#a1a1aa] italic text-[13px]">{t.staff.notProvided}</span>}</td>
        <td className="hidden md:table-cell py-4 px-6 font-semibold text-[14px] text-[#181d26]">{item.salary} DT</td>
        <td className="py-4 px-6">
          {paymentStatusThisMonth === "PAID" ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-emerald-50 border border-emerald-200 text-emerald-700 text-[12px] font-medium whitespace-nowrap">
              {t.staff.paid}
            </span>
          ) : paymentStatusThisMonth === "PARTIAL" ? (
            <span className="px-2.5 py-1 rounded-[4px] bg-amber-50 border border-amber-200 text-amber-700 text-[12px] font-medium whitespace-nowrap">
              {(t.staff as any).partial || "Advance"}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-[4px] bg-rose-50 border border-rose-200 text-rose-700 text-[12px] font-medium whitespace-nowrap">
              {t.staff.unpaid}
            </span>
          )}
        </td>
        <td className="py-4 px-6">
          <div className="flex items-center gap-2">
            <PayStaffModal 
              staffId={item.id} 
              staffName={item.name + " " + item.surname}
              salary={item.salary}
              isPaid={isPaidThisMonth} 
              isAdmin={role === "admin"} 
              monthName={selectedMonthKey}
              payments={item.payments}
              paidMonths={item.payments
                .filter(p => p.status === "PAID" && p.month > 0 && p.month <= 12)
                .map(p => `${MONTHS[p.month - 1] || "Unknown"} ${p.year}`)}
              onSuccess={(newStatus, targetMonth, amountPaidNow) => {
                setOptimisticData((prev: any[]) => prev.map((s: any) => {
                  if (s.id === item.id) {
                    const monthIdx = MONTHS.indexOf(targetMonth.split(" ")[0]) + 1;
                    const yearVal = parseInt(targetMonth.split(" ")[1]);
                    const payments = [...(s.payments || [])];
                    const existingIdx = payments.findIndex(p => p.month === monthIdx && p.year === yearVal);
                    if (existingIdx >= 0) {
                      payments[existingIdx] = { ...payments[existingIdx], status: newStatus, amount: (payments[existingIdx].amount || 0) + amountPaidNow };
                    } else {
                      payments.push({ month: monthIdx, year: yearVal, status: newStatus, amount: amountPaidNow });
                    }
                    return { ...s, payments };
                  }
                  return s;
                }));
              }}
            />
            {role === "admin" && (
              <>
                <CrudFormModal entity="staff" mode="update" data={item} id={item.id} />
                <CrudFormModal entity="staff" mode="delete" id={item.id} />
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
          entityName="staff"
        />
      </div>

      {/* 2. TOP ACTIONS HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <h1 className="text-[24px] font-medium text-[#181d26] tracking-tight">{t.staff.title}</h1>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
          <TableSearch clientSideOnly onChangeImmediate={(val) => setClientSearch(val)} />
          <div className="flex items-center gap-2 self-end md:self-auto">
            {role === "admin" && (
              <div className="flex items-center gap-2 ml-1">
                <CrudFormModal entity="staff" mode="create" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. TABLE & PAGINATION */}
      <div className={`transition-opacity duration-200 ${isSearchPending ? "opacity-50 pointer-events-none" : "opacity-100"}`}>
        <Table columns={translatedColumns} renderRow={renderRow} data={optimisticData} />
      </div>
      <Pagination page={page} count={displayCount} />
    </>
  );
}
