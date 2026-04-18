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
  initialPaidAmount = 0,
  isAdmin,
  monthName,
  paidMonths = [],
}: {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  isPaid: boolean;
  isPartial?: boolean;
  initialPaidAmount?: number;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
}) {
  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  // "1 to 6 the monthly paiment change" mapping logic
  const tuitionAmount = 80 + gradeLevel * 20; // Grade 1 = 100, Grade 6 = 200
  const remainingBalance = tuitionAmount - initialPaidAmount;

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [additionalAmount, setAdditionalAmount] = useState(remainingBalance);
  const [recoveryMonth, setRecoveryMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // Initialize the modal state when it opens
  useEffect(() => {
    if (isOpen) {
      // If the current target month is already paid, jump to the first unpaid one
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        const nextMonth = monthsList[0] || "";
        setSelectedMonth(nextMonth);
      }
      // Always reset additional amount to the remaining balance for the current target month
      setAdditionalAmount(remainingBalance);
    }
  }, [isOpen, selectedMonth, paidMonths, monthsList, remainingBalance]); // Include all dependencies to satisfy linter

  const handlePay = () => {
    if (!isAdmin || !selectedMonth || (isSkipping && !isPartial)) return;

    startTransition(async () => {
      const recoveryMonthIdx = allMonths.indexOf(recoveryMonth);
      const totalCumulative = initialPaidAmount + additionalAmount;
      
      const recoveryDate = (totalCumulative < tuitionAmount && recoveryMonthIdx !== -1) 
        ? `2026-${String(recoveryMonthIdx + 1).padStart(2, '0')}-01`
        : undefined;

      const result = await receiveStudentPayment(
        studentId,
        studentName,
        tuitionAmount, 
        selectedMonth,
        totalCumulative, // Pass the NEW TOTAL
        recoveryDate
      );
      if (result.success) {
        setIsOpen(false);
      } else {
        alert(result.error);
      }
    });
  };

  const earliestUnpaid = monthsList[0];
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full relative overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-slate-50 p-6 border-b border-slate-100">
              <h2 className="text-xl font-bold text-slate-800">
                {isPartial ? "Complete Tuition Fee" : "Receive Tuition Fee"}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Student: <span className="font-bold text-slate-700">{studentName}</span>
              </p>
            </div>

            <div className="p-6">
              {/* Financial Progress Summary */}
              {initialPaidAmount > 0 && (
                <div className="mb-6 p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Payment History</span>
                    <span className="text-[10px] font-black text-indigo-600 bg-white px-2 py-0.5 rounded-full border border-indigo-100">PARTIAL</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs font-medium text-slate-600">Already Paid</p>
                      <p className="text-lg font-bold text-slate-800">{initialPaidAmount} <span className="text-sm">DT</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-slate-600">Total Due</p>
                      <p className="text-lg font-bold text-slate-800">{tuitionAmount} <span className="text-sm">DT</span></p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-indigo-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-600" 
                      style={{ width: `${(initialPaidAmount / tuitionAmount) * 100}%` }} 
                    />
                  </div>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  1. Target Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={isPartial}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-lamaSky transition-all font-semibold text-slate-700 disabled:opacity-75"
                >
                  <option value="" disabled>-- Select Month --</option>
                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {isPartial && <option value={selectedMonth}>{selectedMonth}</option>}
                </select>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                  2. {isPartial ? "Additional Amount Today" : "Amount Received"} (DT)
                </label>
                <input
                  type="number"
                  value={additionalAmount}
                  onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                  max={remainingBalance}
                  min={1}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none focus:ring-2 focus:ring-lamaSky transition-all font-bold text-slate-800 text-lg"
                />
                <p className="text-[10px] text-slate-400 mt-2 font-medium">
                  Remaining Gap: <strong className="text-slate-600">{remainingBalance} DT</strong>
                </p>
              </div>

              {additionalAmount < remainingBalance && (
                <div className="mb-6 p-4 bg-orange-50 rounded-2xl border border-orange-100 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">
                    🔄 Schedule Next Recovery
                  </label>
                  <select
                    value={recoveryMonth}
                    onChange={(e) => setRecoveryMonth(e.target.value)}
                    className="w-full border border-orange-200 bg-white rounded-xl p-3 outline-none focus:ring-2 focus:ring-orange-400 font-semibold text-orange-700"
                  >
                    <option value="" disabled>-- Select Month --</option>
                    {allMonths.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {isSkipping && !isPartial && (
                <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <span className="text-amber-500 font-bold">⚠️</span>
                  <p className="text-[10px] text-amber-700 leading-relaxed">
                    Sequential Error: Please pay for <strong>{earliestUnpaid}</strong> first to maintain chronological bookkeeping.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePay}
                  disabled={isPending || !selectedMonth || (isSkipping && !isPartial) || additionalAmount <= 0}
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-lamaSky hover:bg-blue-400 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
                >
                  {isPending ? "Syncing..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
