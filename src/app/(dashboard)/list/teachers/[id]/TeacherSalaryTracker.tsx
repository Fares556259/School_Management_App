"use client";

import { useState, useTransition, useMemo } from "react";
import { payTeacherSalary } from "../actions";
import { MONTHS } from "@/lib/dateUtils";
import { computeTeacherPaymentStatus } from "@/lib/payrollUtils";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { toast } from "react-toastify";

interface PaymentRecord {
  id?: number;
  month: number;
  year: number;
  status: string;
  amount: number;
  paidAt?: Date | string | null;
  missedHours?: number | null;
  img?: string | null;
}

export default function TeacherSalaryTracker({
  teacherId,
  teacherName,
  salary,
  hourlyRate,
  hoursPerMonth,
  payments: initialPayments = [],
  isAdmin,
}: {
  teacherId: string;
  teacherName: string;
  salary: number;
  hourlyRate?: number | null;
  hoursPerMonth?: number | null;
  payments: any[];
  isAdmin: boolean;
}) {
  const { t, locale } = useLanguage();
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);

  useMemo(() => {
    setPayments(initialPayments);
  }, [initialPayments]);

  const now = new Date();
  const [currentMonth, setCurrentMonth] = useState({
    month: now.getMonth() + 1, // 1-based
    year: now.getFullYear(),
  });
  const [isPending, startTransition] = useTransition();

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      let m = prev.month - 1;
      let y = prev.year;
      if (m < 1) {
        m = 12;
        y--;
      }
      return { month: m, year: y };
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      let m = prev.month + 1;
      let y = prev.year;
      if (m > 12) {
        m = 1;
        y++;
      }
      return { month: m, year: y };
    });
  };

  const monthDate = new Date(currentMonth.year, currentMonth.month - 1, 1);
  const monthDisplayStr = monthDate.toLocaleString(
    locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-FR" : "en-US",
    { month: "long", year: "numeric" }
  );
  const canonicalMonthKey = `${MONTHS[currentMonth.month - 1]} ${currentMonth.year}`;

  const calc = useMemo(() => {
    return computeTeacherPaymentStatus(
      {
        salary,
        hourlyRate,
        hoursPerMonth,
        payments,
      },
      currentMonth.month,
      currentMonth.year
    );
  }, [salary, hourlyRate, hoursPerMonth, payments, currentMonth]);

  const { isPaid, isPartial, isUnpaid, remaining, netDue, amountPaid, deduction, baseSalary } = calc;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  const handlePay = () => {
    if (!isAdmin || isPending || isPaid || remaining <= 0) return;
    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        remaining,
        canonicalMonthKey
      );
      if (result.success) {
        const updated: PaymentRecord[] = [
          ...payments.filter((p) => !(p.month === currentMonth.month && p.year === currentMonth.year)),
          {
            id: calc.payment?.id || Date.now(),
            month: currentMonth.month,
            year: currentMonth.year,
            status: "PAID",
            amount: amountPaid + remaining,
            paidAt: new Date(),
          },
        ];
        setPayments(updated);
        toast.success(t.toasts.salaryValidated.replace("{name}", teacherName).replace("{amount}", String(remaining)));
      } else {
        toast.error(result.error || t.teacherFinance.saveError);
      }
    });
  };

  // Badge color logic
  const badgeClass = isPaid
    ? "bg-emerald-100 text-emerald-700"
    : isPartial
    ? "bg-purple-100 text-purple-700"
    : "bg-rose-100 text-rose-700";

  const badgeLabel = isPaid 
    ? t.teacherFinance.statusPaid 
    : isPartial 
    ? t.teacherFinance.statusAdvance 
    : t.teacherFinance.statusUnpaid;

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
      <h1 className="text-base font-bold text-slate-800 mb-4">{t.teacherFinance.salaryTracker}</h1>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <span className="text-slate-500 font-bold">{"<"}</span>
        </button>
        <span className="font-semibold text-slate-700">{monthDisplayStr}</span>
        <button
          type="button"
          onClick={handleNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors cursor-pointer"
        >
          <span className="text-slate-500 font-bold">{">"}</span>
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between px-2">
          <span className="text-sm font-medium text-slate-500">{t.teacherFinance.baseSalary}:</span>
          <span className="text-sm font-bold text-slate-700">{fmt(baseSalary)}</span>
        </div>

        {deduction > 0 && (
          <div className="flex w-full items-center justify-between px-2">
            <span className="text-sm font-medium text-rose-500">{(t.teacherFinance as any)?.deductions || "Retenues"}:</span>
            <span className="text-sm font-bold text-rose-600">-{fmt(deduction)}</span>
          </div>
        )}

        {amountPaid > 0 && (
          <div className="flex w-full items-center justify-between px-2">
            <span className="text-sm font-medium text-purple-600">{t.teacherFinance.advanceAmount}:</span>
            <span className="text-sm font-bold text-purple-700">{fmt(amountPaid)}</span>
          </div>
        )}

        <div className="flex w-full items-center justify-between px-2">
          <span className="text-sm font-medium text-slate-500">{t.teacherFinance.remainingToPay}:</span>
          <span className={`text-sm font-bold ${remaining > 0 ? "text-rose-600" : "text-emerald-600"}`}>
            {fmt(remaining)}
          </span>
        </div>

        <div className="flex w-full items-center justify-between px-2 mt-1 mb-2 border-b border-slate-100 pb-4">
          <span className="text-sm font-medium text-slate-500">{(t.crud.fields as any)?.Status || t.staff.paidStatus}:</span>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {/* Pay button — only for admins when not fully paid */}
        {!isPaid && isAdmin && remaining > 0 && (
          <button
            type="button"
            onClick={handlePay}
            disabled={isPending}
            className="w-full mt-2 bg-lamaSky hover:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md text-sm cursor-pointer"
          >
            {isPending
              ? t.studentTuition.processing
              : isPartial
              ? `${t.teacherFinance.completeSalaryForMonth.replace("{month}", monthDisplayStr)} (${fmt(remaining)})`
              : `${t.teacherFinance.paySalaryForMonth.replace("{amount}", remaining.toLocaleString("en-US").replace(/,/g, " ")).replace("{month}", monthDisplayStr)}`}
          </button>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-slate-600 mb-3">{t.teacherFinance.tabHistory}</h2>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {[...payments]
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p: any) => (
                <div key={p.id || `${p.month}-${p.year}`} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-none">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">
                      {MONTHS[p.month - 1]} {p.year}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-GB") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${
                      p.status === "PAID" ? "text-emerald-600" :
                      p.status === "PARTIAL" ? "text-purple-600" : "text-rose-500"
                    }`}>
                      {p.amount.toLocaleString("en-US").replace(/,/g, " ")} DT
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      p.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                      p.status === "PARTIAL" ? "bg-purple-100 text-purple-700" :
                      "bg-rose-100 text-rose-700"
                    }`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
