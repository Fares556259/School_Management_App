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
        className={`px-3 py-1 text-[13px] font-medium rounded-[6px] transition-colors w-24 text-center ${
          isPaid
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : isPartial
              ? "bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 cursor-pointer"
              : "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
        }`}
      >
        {isPaid ? "Paid" : isPartial ? "Partial" : "Receive Fee"}
      </button>

    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
      onClick={() => setIsOpen(false)}
    >
          <div 
            className="bg-white rounded-[12px] shadow-2xl max-w-sm w-full relative overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-[#f1f5f9] flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold text-[#181d26] tracking-tight">
                {isPartial ? "Complete Tuition Fee" : "Receive Tuition Fee"}
              </h2>
              <p className="text-[13px] text-[#5a5a5a]">
                For <span className="font-medium text-[#181d26]">{studentName}</span>
              </p>
            </div>

            <div className="p-6">
              {/* Financial Progress Summary */}
              {initialPaidAmount > 0 && (
                <div className="mb-5 p-4 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Payment History</span>
                    <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-100">PARTIAL</span>
                  </div>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[12px] font-medium text-[#64748b]">Already Paid</p>
                      <p className="text-[16px] font-semibold text-[#181d26]">{initialPaidAmount} <span className="text-[12px] font-normal text-[#64748b]">DT</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] font-medium text-[#64748b]">Total Due</p>
                      <p className="text-[16px] font-semibold text-[#181d26]">{tuitionAmount} <span className="text-[12px] font-normal text-[#64748b]">DT</span></p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 rounded-full" 
                      style={{ width: `${(initialPaidAmount / tuitionAmount) * 100}%` }} 
                    />
                  </div>
                </div>
              )}

              <div className="mb-5">
                <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">
                  Target Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={isPartial}
                  className="w-full border border-[#dddddd] bg-white rounded-[8px] px-3 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26] disabled:opacity-60 disabled:bg-[#f8fafc]"
                >
                  <option value="" disabled>Select Month</option>
                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {isPartial && <option value={selectedMonth}>{selectedMonth}</option>}
                </select>
              </div>

              <div className="mb-6">
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-[13px] font-medium text-[#41454d]">
                    {isPartial ? "Additional Amount" : "Amount Received"}
                  </label>
                  <span className="text-[12px] text-[#64748b]">
                    Balance: <strong className="text-[#181d26] font-medium">{remainingBalance} DT</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                    max={remainingBalance}
                    min={1}
                    className="w-full border border-[#dddddd] bg-white rounded-[8px] pl-3 pr-10 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#94a3b8]">DT</span>
                </div>
              </div>

              {additionalAmount < remainingBalance && (
                <div className="mb-6 p-4 bg-orange-50 rounded-[8px] border border-orange-100 animate-in slide-in-from-top-2 duration-300">
                  <label className="flex items-center gap-2 text-[12px] font-semibold text-orange-700 uppercase tracking-wider mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    Schedule Next Recovery
                  </label>
                  <select
                    value={recoveryMonth}
                    onChange={(e) => setRecoveryMonth(e.target.value)}
                    className="w-full border border-orange-200 bg-white rounded-[6px] px-3 py-2 outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 text-[13px] text-orange-800"
                  >
                    <option value="" disabled>Select Month</option>
                    {allMonths.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}

              {isSkipping && !isPartial && (
                <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-start gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    Please pay for <strong className="font-semibold">{earliestUnpaid}</strong> first to maintain chronological bookkeeping.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-[#41454d] bg-white border border-[#dddddd] hover:bg-[#f8fafc] rounded-[8px] transition-all"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isPending || !selectedMonth || (isSkipping && !isPartial) || additionalAmount <= 0}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-[#181d26] hover:bg-[#2a313e] rounded-[8px] transition-all disabled:opacity-50 shadow-sm"
                >
                  {isPending ? "Confirming..." : "Confirm Payment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
