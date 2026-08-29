"use client";

import { useState, useTransition, useEffect } from "react";
import { payStaffSalary } from "./actions";
import { getSchoolYearMonths, isMonthBefore } from "@/lib/dateUtils";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { Banknote } from "lucide-react";

const dict = {
  en: {
    processSalary: "Process Salary",
    for: "For",
    targetMonth: "Target Month",
    selectMonth: "Select Month",
    cancel: "Cancel",
    confirmPayment: "Confirm Payment",
    confirming: "Confirming...",
    advanceAmount: "Advance Amount",
    giveAdvance: "Give an advance",
    advancePaid: "Advance Paid",
    finalAmount: "Final Amount",
    skipWarning: "Please pay for {earliestUnpaid} first to maintain chronological bookkeeping."
  },
  fr: {
    processSalary: "Traiter le salaire",
    for: "Pour",
    targetMonth: "Mois cible",
    selectMonth: "Sélectionner le mois",
    cancel: "Annuler",
    confirmPayment: "Confirmer le paiement",
    confirming: "Confirmation...",
    advanceAmount: "Montant avance (Max: {max} DT)",
    giveAdvance: "Donner une avance",
    advancePaid: "Avance payée",
    finalAmount: "Montant final",
    skipWarning: "Veuillez d'abord payer {earliestUnpaid} pour maintenir une comptabilité chronologique."
  },
  ar: {
    processSalary: "معالجة الراتب",
    for: "لـ",
    targetMonth: "الشهر المستهدف",
    selectMonth: "اختر الشهر",
    cancel: "إلغاء",
    confirmPayment: "تأكيد الدفع",
    confirming: "جاري التأكيد...",
    advanceAmount: "مبلغ السلفة (الحد الأقصى: {max} د.ت)",
    giveAdvance: "إعطاء سلفة",
    advancePaid: "سلفة مدفوعة",
    finalAmount: "المبلغ النهائي",
    skipWarning: "يرجى الدفع لشهر {earliestUnpaid} أولاً للحفاظ على التسلسل الزمني."
  }
};

export default function PayStaffModal({
  staffId,
  staffName,
  salary,
  isPaid,
  isAdmin,
  monthName,
  paidMonths = [],
  payments = [],
  onSuccess,
}: {
  staffId: string;
  staffName: string;
  salary: number;
  isPaid: boolean;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
  payments?: any[];
  onSuccess?: (status: "PAID" | "PARTIAL", targetMonth: string) => void;
}) {
  const { locale } = useLanguage();
  const t = dict[locale as keyof typeof dict] || dict.en;
  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [amountToPay, setAmountToPay] = useState<number | string>(salary);
  const [isPending, startTransition] = useTransition();

  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [advanceInput, setAdvanceInput] = useState<number | string>("");

  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const getExistingAdvance = (monthKey: string): number => {
    if (!payments || !monthKey) return 0;
    const [mName, yStr] = monthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal && p.status === "PARTIAL");
    return found?.amount || 0;
  };

  const existingAdvance = getExistingAdvance(selectedMonth);
  const finalAmount = Math.max(0, salary - existingAdvance);

  const earliestUnpaid = monthsList[0];
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

  useEffect(() => {
    if (isOpen) {
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        setSelectedMonth(monthsList[0] || "");
      }
      setIsAdvanceMode(false);
      setAdvanceInput("");
    }
  }, [isOpen]);

  const handlePay = () => {
    let amt = Number(isAdvanceMode ? advanceInput : finalAmount);
    if (!isAdmin || !selectedMonth || isSkipping || !amt || amt <= 0) return;

    setIsOpen(false);
    if (onSuccess) onSuccess(isAdvanceMode ? "PARTIAL" : "PAID", selectedMonth);

    startTransition(async () => {
      const result = await payStaffSalary(
        staffId,
        staffName,
        amt,
        selectedMonth,
        isAdvanceMode
      );
      if (!result.success) {
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
            <div className="p-6 border-b border-[#f1f5f9] flex flex-col gap-1">
              <h2 className="text-[18px] font-semibold text-[#181d26] tracking-tight">
                {t.processSalary}
              </h2>
              <p className="text-[13px] text-[#5a5a5a]">
                {t.for} <span className="font-medium text-[#181d26]">{staffName}</span>
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">
                  {t.targetMonth}
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full border border-[#dddddd] bg-white rounded-[8px] px-3 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26]"
                >
                  <option value="" disabled>{t.selectMonth}</option>
                  {monthsList.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="mb-6 border border-[#dddddd] rounded-[8px] p-4 bg-[#f8fafc]">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isAdvanceMode}
                    onChange={(e) => setIsAdvanceMode(e.target.checked)}
                    className="w-4 h-4 rounded border-[#dddddd] text-[#181d26] focus:ring-[#181d26] cursor-pointer accent-[#181d26]"
                  />
                  <span className="text-[14px] font-medium text-[#181d26]">{t.giveAdvance}</span>
                </label>
              </div>

              {isAdvanceMode ? (
                <div className="mb-6">
                  <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">{t.advanceAmount.replace("{max}", String(finalAmount))}</label>
                  <input
                    type="number"
                    value={advanceInput}
                    onChange={(e) => setAdvanceInput(e.target.value)}
                    placeholder="0.00"
                    min={0}
                    max={finalAmount}
                    className="w-full border border-[#dddddd] bg-white rounded-[8px] px-3 py-2.5 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[14px] text-[#181d26]"
                  />
                </div>
              ) : (
                <div className="flex flex-col">
                  {!isAdvanceMode && existingAdvance > 0 && (
                    <div className="mb-5">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[13px] font-medium text-[#41454d]">
                          {t.advancePaid}
                        </label>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 px-3 py-2 rounded-[8px] border text-[14px] font-medium bg-amber-50 border-amber-200 text-amber-700">
                          {existingAdvance.toLocaleString()} DT
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mb-6 p-4 bg-[#f0fdf4] rounded-[8px] border border-[#bbf7d0]">
                    <div className="flex justify-between items-center">
                      <span className="text-[13px] font-semibold text-[#166534]">{t.finalAmount}</span>
                      <span className="text-[20px] font-bold text-[#166534]">
                        {finalAmount.toLocaleString()} <span className="text-[14px] font-normal">DT</span>
                      </span>
                    </div>
                    {existingAdvance > 0 && (
                      <p className="text-[11px] text-[#166534] mt-1">
                        {salary.toLocaleString()} − {existingAdvance.toLocaleString()} ({t.advancePaid})
                      </p>
                    )}
                  </div>
                </div>
              )}

              {isSkipping && (
                <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-[8px] flex items-start gap-2.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0 mt-0.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    {t.skipWarning.split("{earliestUnpaid}")[0]}
                    <strong className="font-semibold">{earliestUnpaid}</strong>
                    {t.skipWarning.split("{earliestUnpaid}")[1]}
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-[#41454d] bg-white border border-[#dddddd] hover:bg-[#f8fafc] rounded-[8px] transition-all"
                  disabled={isPending}
                >{t.cancel}</button>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={isPending || !selectedMonth || isSkipping || (isAdvanceMode ? (!advanceInput || Number(advanceInput) <= 0 || Number(advanceInput) > finalAmount) : finalAmount <= 0)}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-[#181d26] hover:bg-[#2a313e] rounded-[8px] transition-all disabled:opacity-50 shadow-sm"
                >
                  {isPending ? (t.confirming) : (t.confirmPayment)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
