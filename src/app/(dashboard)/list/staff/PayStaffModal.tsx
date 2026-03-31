"use client";

import { useState, useTransition } from "react";
import { payStaffSalary } from "./actions";
import { getSchoolYearMonths, isMonthBefore } from "@/lib/dateUtils";

export default function PayStaffModal({
  staffId,
  staffName,
  salary,
  isPaid,
  isAdmin,
  monthName,
  paidMonths = [],
}: {
  staffId: string;
  staffName: string;
  salary: number;
  isPaid: boolean;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || "");
  const [isPending, startTransition] = useTransition();

  // Find earliest unpaid month in the reachable window (last 6 months)
  const getEarliestUnpaid = () => {
    const list = [];
    const date = new Date();
    date.setMonth(date.getMonth() - 5);
    for (let i = 0; i < 6; i++) {
      const m = date.toLocaleString("en-US", { month: "long", year: "numeric" });
      list.push(m);
      date.setMonth(date.getMonth() + 1);
    }
    return list.find(m => !paidMonths.includes(m));
  };

  const earliestUnpaid = getEarliestUnpaid();
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

  const handlePay = () => {
    if (!isAdmin || !selectedMonth || isSkipping) return;

    startTransition(async () => {
      const result = await payStaffSalary(
        staffId,
        staffName,
        salary,
        selectedMonth
      );
      if (result.success) {
        setIsOpen(false);
      } else {
        alert(result.error);
      }
    });
  };

  const monthsList = getSchoolYearMonths();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isAdmin}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
          isPaid
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : "bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 cursor-pointer"
        }`}
      >
        {isPaid ? "Paid" : "Pay Salary"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full relative">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              Pay Staff Salary
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Process a monthly salary payment of <strong>${salary}</strong> for{" "}
              <strong>{staffName}</strong> {selectedMonth ? <>for <strong>{selectedMonth}</strong></> : ""}. 
              This will log an Expense in the database.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-lamaSky"
              >
                <option value="" disabled>
                  -- Choose a Month --
                </option>
                {monthsList.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {isSkipping && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                <span className="text-amber-500 font-bold">⚠️</span>
                <p className="text-xs text-amber-700">
                  You are skipping unpaid months. Please pay for <strong>{earliestUnpaid}</strong> first to maintain sequential records.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={isPending || !selectedMonth || isSkipping}
                className="px-4 py-2 text-sm font-medium text-white bg-lamaSky hover:bg-blue-400 rounded-md transition-colors disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Confirm Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
