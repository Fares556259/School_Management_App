"use client";

import { useState, useTransition } from "react";
import { receiveStudentPayment } from "../actions";
import { MONTHS } from "@/lib/dateUtils";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { toast } from "react-toastify";

export default function StudentPaymentTracker({
  studentId,
  studentName,
  gradeLevel,
  customTuition,
  levelTuitionFee,
  payments,
  isAdmin,
}: {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  customTuition?: number | null;
  levelTuitionFee: number;
  payments: any[];
  isAdmin: boolean;
}) {
  const { t, locale } = useLanguage();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPending, startTransition] = useTransition();
  // Local set of months paid — initialised from DB data, updated on success
  const [paidMonths, setPaidMonths] = useState<Set<string>>(() => {
    const s = new Set<string>();
    payments.forEach((p) => {
      if (p.status === "PAID") s.add(`${MONTHS[p.month - 1]} ${p.year}`);
    });
    return s;
  });

  const handlePrevMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  const monthStr = currentDate.toLocaleString(
    locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR",
    {
      month: "long",
      year: "numeric",
    }
  );

  const internalMonthStr = `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  const isPaid = paidMonths.has(internalMonthStr);
  const tuitionAmount = customTuition ?? levelTuitionFee;

  const handlePay = () => {
    if (!isAdmin || isPending || isPaid) return;
    startTransition(async () => {
      const result = await receiveStudentPayment(studentId, studentName, tuitionAmount, internalMonthStr);
      if (result.success) {
        // Update local state so the badge flips immediately without reload
        setPaidMonths((prev) => new Set(prev).add(internalMonthStr));
        toast.success(t.studentTuition.paymentRecorded);
      } else {
        toast.error(result.error || t.toasts.paymentFailed);
      }
    });
  };

  return (
    <div className="bg-white p-4 rounded-md mt-4 shadow-sm border border-slate-100">
      <h1 className="text-xl font-semibold mb-4 text-slate-800">{t.studentTuition.tuitionTracker}</h1>

      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md mb-4 border border-slate-100">
        <button
          onClick={handlePrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
        >
          <span className="text-slate-500 font-bold">{"<"}</span>
        </button>
        <span className="font-semibold text-slate-700">{monthStr}</span>
        <button
          onClick={handleNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors"
        >
          <span className="text-slate-500 font-bold">{">"}</span>
        </button>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex w-full items-center justify-between px-2">
          <span
            className="text-sm font-medium text-slate-500 cursor-help"
            title={t.studentTuition.baseRateGrade.replace("{grade}", String(gradeLevel))}
          >
            {t.studentTuition.monthlyRate}:
          </span>
          <span className="text-sm font-bold text-slate-700">{tuitionAmount} DT</span>
        </div>
        <div className="flex w-full items-center justify-between px-2 mt-1 mb-2 border-b border-slate-100 pb-4">
          <span className="text-sm font-medium text-slate-500">{t.students.paidStatus}:</span>
          <div className="flex items-center gap-2">
            {isPaid && (
              <>
                {payments.find((p) => `${MONTHS[p.month - 1]} ${p.year}` === internalMonthStr)?.img && (
                  <a
                    href={payments.find((p) => `${MONTHS[p.month - 1]} ${p.year}` === internalMonthStr).img}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-indigo-500 hover:underline flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 shadow-sm"
                  >
                    {t.studentTuition.viewReceipt}
                  </a>
                )}
              </>
            )}
            <span
              className={`px-3 py-1 text-xs font-bold rounded-full ${
                isPaid
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {isPaid ? t.studentTuition.statusPaid : t.studentTuition.statusUnpaid}
            </span>
          </div>
        </div>

        {!isPaid && isAdmin && (
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full mt-2 bg-lamaSky hover:bg-blue-400 text-white font-semibold py-3 rounded-md transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            {isPending
              ? t.studentTuition.processing
              : t.studentTuition.receiveForMonth
                  .replace("{amount}", String(tuitionAmount))
                  .replace("{month}", monthStr)}
          </button>
        )}
      </div>
    </div>
  );
}
