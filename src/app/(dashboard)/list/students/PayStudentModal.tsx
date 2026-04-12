"use client";

import { useState, useTransition, useEffect } from "react";
import { receiveStudentPayment } from "./actions";
import { getSchoolYearMonths, isMonthBefore } from "@/lib/dateUtils";

export default function PayStudentModal({
  studentId,
  studentName,
  gradeLevel,
  isPaid,
  isPartial,
  isAdmin,
  monthName,
  paidMonths = [],
}: {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  isPaid: boolean;
  isPartial?: boolean;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
}) {
  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [paidAmount, setPaidAmount] = useState(80 + gradeLevel * 20);
  const [recoveryMonth, setRecoveryMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // "1 to 6 the monthly paiment change" mapping logic
  const tuitionAmount = 80 + gradeLevel * 20; // Grade 1 = $100, Grade 6 = $200

  const earliestUnpaid = monthsList[0];
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

  useEffect(() => {
    if (isOpen && (!selectedMonth || paidMonths.includes(selectedMonth))) {
      setSelectedMonth(monthsList[0] || "");
    }
  }, [isOpen, monthsList, selectedMonth, paidMonths]);

  const handlePay = () => {
    if (!isAdmin || !selectedMonth || isSkipping) return;

    startTransition(async () => {
      const recoveryMonthIdx = allMonths.indexOf(recoveryMonth);
      const recoveryDate = (paidAmount < tuitionAmount && recoveryMonthIdx !== -1) 
        ? `2026-${String(recoveryMonthIdx + 1).padStart(2, '0')}-01`
        : undefined;

      const result = await receiveStudentPayment(
        studentId,
        studentName,
        tuitionAmount, 
        selectedMonth,
        paidAmount,
        recoveryDate
      );
      if (result.success) {
        setIsOpen(false);
      } else {
        alert(result.error);
      }
    });
  };


  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isAdmin}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors w-24 ${
          isPaid
            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
            : isPartial
              ? "bg-orange-100 text-orange-700 border border-orange-200 hover:bg-orange-200 cursor-pointer"
              : "bg-rose-100 text-rose-700 border border-rose-200 hover:bg-rose-200 cursor-pointer"
        }`}
      >
        {isPaid ? "Paid" : isPartial ? "Partial" : "Receive Fee"}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full relative">
            <h2 className="text-xl font-bold text-slate-800 mb-4">
              Receive Tuition Fee
            </h2>
            <p className="text-sm text-slate-500 mb-4">
              Process a monthly tuition payment of{" "}
              <strong>${tuitionAmount}</strong> (Grade {gradeLevel}) for{" "}
              <strong>{studentName}</strong> {selectedMonth ? <>for <strong>{selectedMonth}</strong></> : ""}. 
              This logs an Income.
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

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Amount Paid ($)
              </label>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                max={tuitionAmount}
                min={1}
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-lamaSky"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Full tuition for Grade {gradeLevel}: <strong>${tuitionAmount}</strong>
              </p>
            </div>

            {paidAmount < tuitionAmount && (
              <div className="mb-6 animate-in slide-in-from-top-2 duration-300">
                <label className="block text-sm font-medium text-orange-700 mb-2">
                  Recovery Month (Rest of Fee)
                </label>
                <select
                  value={recoveryMonth}
                  onChange={(e) => setRecoveryMonth(e.target.value)}
                  className="w-full border border-orange-200 bg-orange-50 rounded-md p-2 outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="" disabled>-- Select Recovery Month --</option>
                  {allMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <p className="text-[10px] text-orange-600 mt-1 italic">
                  * Scheduling the remaining balance for future recovery.
                </p>
              </div>
            )}

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
