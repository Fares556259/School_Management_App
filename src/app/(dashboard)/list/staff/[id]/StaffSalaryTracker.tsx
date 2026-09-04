"use client";

import { useState, useTransition } from "react";
import { payStaffSalary } from "../actions";
import { MONTHS } from "@/lib/dateUtils";

export default function StaffSalaryTracker({
  staffId,
  staffName,
  salary,
  payments,
  isAdmin,
}: {
  staffId: string;
  staffName: string;
  salary: number;
  payments: any[];
  isAdmin: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPending, startTransition] = useTransition();

  // FIX Bug 1: proper template literals + correct month index (p.month is 1-based, so -1 for array)
  const [paidMonths, setPaidMonths] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    payments.forEach((p) => {
      if (p.status === "PAID" || p.status === "PARTIAL") {
        const key = `${MONTHS[p.month - 1]} ${p.year}`;
        m.set(key, p.status);
      }
    });
    return m;
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

  const status = paidMonths.get(monthStr);
  const isPaid = status === "PAID";
  const isPartial = status === "PARTIAL";

  const handlePay = () => {
    if (!isAdmin || isPending || isPaid) return;
    startTransition(async () => {
      const result = await payStaffSalary(staffId, staffName, salary, monthStr);
      if (result.success) {
        setPaidMonths((prev) => new Map(prev).set(monthStr, "PAID"));
      } else {
        alert(result.error);
      }
    });
  };

  const badgeClass = isPaid
    ? "bg-emerald-100 text-emerald-700"
    : isPartial
    ? "bg-purple-100 text-purple-700"
    : "bg-rose-100 text-rose-700";

  const badgeLabel = isPaid ? "PAID" : isPartial ? "ADVANCE" : "UNPAID";

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm mt-4">
      <h1 className="text-base font-bold text-slate-800 mb-4">Salary Tracker</h1>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg mb-4 border border-slate-100">
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
          <span className="text-sm font-medium text-slate-500">Monthly Salary:</span>
          <span className="text-sm font-bold text-slate-700">
            {salary.toLocaleString("en-US").replace(/,/g, " ") + " DT"}
          </span>
        </div>

        {/* FIX Bug 2: proper template literal className */}
        <div className="flex w-full items-center justify-between px-2 mt-1 mb-2 border-b border-slate-100 pb-4">
          <span className="text-sm font-medium text-slate-500">Status:</span>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {!isPaid && isAdmin && (
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full mt-2 bg-lamaSky hover:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md text-sm"
          >
            {/* FIX Bug 3: proper template literal button label */}
            {isPending
              ? "Processing..."
              : isPartial
              ? `Complete salary for ${monthStr}`
              : `Pay ${salary.toLocaleString("en-US").replace(/,/g, " ")} DT for ${monthStr}`}
          </button>
        )}
      </div>
    </div>
  );
}
