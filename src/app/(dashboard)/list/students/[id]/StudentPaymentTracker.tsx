"use client";

import { useState, useTransition } from "react";
import { receiveStudentPayment } from "../actions";
import { MONTHS } from "@/lib/dateUtils";

export default function StudentPaymentTracker({
  studentId,
  studentName,
  gradeLevel,
  payments,
  isAdmin,
}: {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  payments: any[];
  isAdmin: boolean;
}) {
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

  const monthStr = currentDate.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const isPaid = paidMonths.has(monthStr);
  const tuitionAmount = 80 + gradeLevel * 20;

  const handlePay = () => {
    if (!isAdmin || isPending || isPaid) return;
    startTransition(async () => {
      const result = await receiveStudentPayment(studentId, studentName, tuitionAmount, monthStr);
      if (result.success) {
        // Update local state so the badge flips immediately without reload
        setPaidMonths((prev) => new Set(prev).add(monthStr));
      } else {
        alert(result.error);
      }
    });
  };

  return (
    <div className="bg-white p-4 rounded-md mt-4 shadow-sm border border-slate-100">
      <h1 className="text-xl font-semibold mb-4 text-slate-800">Tuition Tracker</h1>

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
          <span className="text-sm font-medium text-slate-500 cursor-help" title={`Grade ${gradeLevel} base rate`}>
            Monthly Fee:
          </span>
          <span className="text-sm font-bold text-slate-700">${tuitionAmount}</span>
        </div>
        <div className="flex w-full items-center justify-between px-2 mt-1 mb-2 border-b border-slate-100 pb-4">
          <span className="text-sm font-medium text-slate-500">Status:</span>
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full ${
              isPaid
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {isPaid ? "PAID" : "UNPAID"}
          </span>
        </div>

        {!isPaid && isAdmin && (
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full mt-2 bg-lamaSky hover:bg-blue-400 text-white font-semibold py-3 rounded-md transition-all disabled:opacity-50 shadow-sm hover:shadow-md"
          >
            {isPending ? "Processing..." : `Receive $${tuitionAmount} for ${monthStr}`}
          </button>
        )}
      </div>
    </div>
  );
}
