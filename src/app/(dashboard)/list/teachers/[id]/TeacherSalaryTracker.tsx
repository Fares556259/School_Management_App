"use client";

import { useState, useTransition } from "react";
import { payTeacherSalary } from "../actions";
import { MONTHS } from "@/lib/dateUtils";

export default function TeacherSalaryTracker({
  teacherId,
  teacherName,
  salary,
  payments,
  isAdmin,
}: {
  teacherId: string;
  teacherName: string;
  salary: number;
  payments: any[];
  isAdmin: boolean;
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPending, startTransition] = useTransition();

  // FIX Bug 1: proper template literals with $ signs
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

  const status = paidMonths.get(monthStr); // "PAID" | "PARTIAL" | undefined
  const isPaid = status === "PAID";
  const isPartial = status === "PARTIAL";

  const handlePay = () => {
    if (!isAdmin || isPending || isPaid) return;
    startTransition(async () => {
      // FIX Bug 3: proper template literal with $ signs
      const result = await payTeacherSalary(teacherId, teacherName, salary, monthStr);
      if (result.success) {
        setPaidMonths((prev) => new Map(prev).set(monthStr, "PAID"));
      } else {
        alert(result.error);
      }
    });
  };

  // Badge color logic
  const badgeClass = isPaid
    ? "bg-emerald-100 text-emerald-700"
    : isPartial
    ? "bg-purple-100 text-purple-700"
    : "bg-rose-100 text-rose-700";

  const badgeLabel = isPaid ? "PAID" : isPartial ? "ADVANCE" : "UNPAID";

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
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

        {/* FIX Bug 2: proper template literal with $ sign for className */}
        <div className="flex w-full items-center justify-between px-2 mt-1 mb-2 border-b border-slate-100 pb-4">
          <span className="text-sm font-medium text-slate-500">Status:</span>
          <span className={`px-3 py-1 text-xs font-bold rounded-full ${badgeClass}`}>
            {badgeLabel}
          </span>
        </div>

        {/* Pay button — only for admins when not fully paid */}
        {!isPaid && isAdmin && (
          <button
            onClick={handlePay}
            disabled={isPending}
            className="w-full mt-2 bg-lamaSky hover:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 shadow-sm hover:shadow-md text-sm"
          >
            {/* FIX Bug 3: proper template literal with $ sign */}
            {isPending
              ? "Processing..."
              : isPartial
              ? `Complete salary for ${monthStr}`
              : `Pay ${salary.toLocaleString("en-US").replace(/,/g, " ")} DT for ${monthStr}`}
          </button>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <h2 className="text-sm font-bold text-slate-600 mb-3">Payment History</h2>
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
            {[...payments]
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p: any) => (
                <div key={p.id} className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-none">
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
