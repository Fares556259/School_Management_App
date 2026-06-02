"use client";

import { useState, useTransition, useEffect } from "react";
import { payStaffSalary } from "./actions";
import { getSchoolYearMonths, isMonthBefore } from "@/lib/dateUtils";

import { Banknote } from "lucide-react";

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
  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [amountToPay, setAmountToPay] = useState<number | string>(salary);
  const [isPending, startTransition] = useTransition();

  const earliestUnpaid = monthsList[0];
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

  useEffect(() => {
    if (isOpen && (!selectedMonth || paidMonths.includes(selectedMonth))) {
      setSelectedMonth(monthsList[0] || "");
    }
    if (isOpen) {
      setAmountToPay(salary);
    }
  }, [isOpen, monthsList, selectedMonth, paidMonths, salary]);

  const handlePay = () => {
    const finalAmount = Number(amountToPay);
    if (!isAdmin || !selectedMonth || isSkipping || !finalAmount || finalAmount <= 0) return;

    startTransition(async () => {
      const result = await payStaffSalary(
        staffId,
        staffName,
        finalAmount,
        selectedMonth
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
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d] disabled:opacity-50"
        title="Process Salary"
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
                Process Salary
              </h2>
              <p className="text-[13px] text-[#5a5a5a]">
                For <span className="font-medium text-[#181d26]">{staffName}</span>
              </p>
            </div>

            <div className="p-6">
              {/* Financial Summary */}
              <div className="mb-5 p-4 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">Payment Amount</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-[12px] font-medium text-[#64748b] mb-1">Base Salary: {salary} DT</p>
                    <div className="relative flex items-center max-w-[200px]">
                      <input 
                        type="number" 
                        value={amountToPay} 
                        onChange={(e) => setAmountToPay(e.target.value)}
                        className="w-full text-[20px] font-semibold text-[#181d26] bg-white border border-[#dddddd] rounded-[6px] px-3 py-1 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all"
                      />
                      <span className="absolute right-3 text-[14px] font-normal text-[#64748b]">DT</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">
                  Target Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border border-[#dddddd] bg-white rounded-[8px] px-3 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26]"
                >
                  <option value="" disabled>Select Month</option>
                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {isSkipping && (
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
                  disabled={isPending || !selectedMonth || isSkipping}
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
