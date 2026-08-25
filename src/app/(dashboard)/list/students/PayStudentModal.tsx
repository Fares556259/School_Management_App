"use client";

import React, { useState, useTransition, useEffect } from "react";
import { receiveMultipleStudentPayments } from "./actions";
import { getSchoolYearMonths, isMonthBefore, MONTHS } from "@/lib/dateUtils";
import { Banknote } from "lucide-react";

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
  tuitionFee = 450,
  payments = [],
  onSuccess,
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
  tuitionFee?: number;
  payments?: any[];
  onSuccess?: (amount: number, status: "PAID" | "PARTIAL", targetMonth: string) => void;
}) {
  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  const tuitionAmount = tuitionFee || 450;
  
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  
  // Dynamically compute the already paid amount for the currently selected month
  const dynamicInitialPaidAmount = React.useMemo(() => {
    if (!payments || !selectedMonth) return initialPaidAmount || 0;
    const [mName, yStr] = selectedMonth.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal);
    return found?.amount || 0;
  }, [selectedMonth, payments, initialPaidAmount]);

  const remainingBalance = tuitionAmount - dynamicInitialPaidAmount;
  const displayBalance = remainingBalance < 0 ? 0 : remainingBalance;

  const [additionalAmount, setAdditionalAmount] = useState(displayBalance);
  const [recoveryMonth, setRecoveryMonth] = useState("");
  const [isPending, startTransition] = useTransition();

  // Reset additionalAmount when the modal opens or selectedMonth changes
  useEffect(() => {
    if (isOpen) {
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        const nextMonth = monthsList[0] || "";
        setSelectedMonth(nextMonth);
      } else {
        setAdditionalAmount(displayBalance);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, selectedMonth]);

  const handlePay = () => {
    if (!isAdmin || !selectedMonth || (isSkipping && !isPartial)) return;

    let moneyToDistribute = additionalAmount;
    let currentIdx = allMonths.indexOf(selectedMonth);
    
    const paymentsToProcess: any[] = [];
    
    // We loop to distribute moneyToDistribute across subsequent months
    while ((moneyToDistribute > 0 || paymentsToProcess.length === 0) && currentIdx >= 0 && currentIdx < allMonths.length) {
       const mKey = allMonths[currentIdx];
       const [mName, yStr] = mKey.split(" ");
       const monthIdx = MONTHS.indexOf(mName) + 1;
       const yearVal = parseInt(yStr);
       
       const found = payments?.find(p => p.month === monthIdx && p.year === yearVal);
       const alreadyPaid = found?.amount || 0;
       
       if (currentIdx === allMonths.indexOf(selectedMonth)) {
         // This is the primary month
         const targetTotal = alreadyPaid + moneyToDistribute;
         if (targetTotal > tuitionAmount) {
             const applyHere = tuitionAmount - alreadyPaid;
             // Apply just enough to pay this month fully, if applyHere > 0
             // But wait, what if they overpaid this month already?
             const actualApply = applyHere > 0 ? applyHere : 0;
             paymentsToProcess.push({
                 monthYear: mKey,
                 amount: alreadyPaid + actualApply,
                 isPartial: false,
                 gap: 0
             });
             moneyToDistribute -= actualApply;
         } else {
             paymentsToProcess.push({
                 monthYear: mKey,
                 amount: targetTotal,
                 isPartial: targetTotal < tuitionAmount,
                 gap: tuitionAmount - targetTotal
             });
             moneyToDistribute = 0;
         }
       } else {
         // This is a cascading month
         if (moneyToDistribute > 0) {
             const targetTotal = alreadyPaid + moneyToDistribute;
             if (targetTotal > tuitionAmount) {
                 const applyHere = tuitionAmount - alreadyPaid;
                 const actualApply = applyHere > 0 ? applyHere : 0;
                 paymentsToProcess.push({
                     monthYear: mKey,
                     amount: alreadyPaid + actualApply,
                     isPartial: false,
                     gap: 0
                 });
                 moneyToDistribute -= actualApply;
             } else {
                 paymentsToProcess.push({
                     monthYear: mKey,
                     amount: targetTotal,
                     isPartial: targetTotal < tuitionAmount,
                     gap: tuitionAmount - targetTotal
                 });
                 moneyToDistribute = 0;
             }
         }
       }
       currentIdx++;
    }
    
    // If there is STILL moneyToDistribute (e.g. paid for whole year and excess), apply it to the last processed month
    if (moneyToDistribute > 0 && paymentsToProcess.length > 0) {
        paymentsToProcess[paymentsToProcess.length - 1].amount += moneyToDistribute;
        paymentsToProcess[paymentsToProcess.length - 1].isPartial = false; // Overpaid
        paymentsToProcess[paymentsToProcess.length - 1].gap = 0;
    }

    setIsOpen(false);
    if (onSuccess) {
      // Just fire onSuccess for the selectedMonth to optimistically update it
      const prm = paymentsToProcess[0];
      if (prm) {
         onSuccess(prm.amount, prm.isPartial ? "PARTIAL" : "PAID", prm.monthYear);
      }
    }

    startTransition(async () => {
      const result = await receiveMultipleStudentPayments(
        studentId,
        studentName,
        paymentsToProcess
      );
      if (!result.success && 'error' in result) {
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
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d] disabled:opacity-50"
        title="Receive Tuition Fee"
      >
        <Banknote size={16} strokeWidth={2} />
      </button>

      {isOpen && (
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
                    Balance: <strong className="text-[#181d26] font-medium">{displayBalance} DT</strong>
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={additionalAmount}
                    onChange={(e) => setAdditionalAmount(Number(e.target.value))}
                    max={displayBalance > 0 ? displayBalance : 0}
                    min={0}
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
                  disabled={isPending || !selectedMonth || (isSkipping && !isPartial) || additionalAmount < 0}
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
