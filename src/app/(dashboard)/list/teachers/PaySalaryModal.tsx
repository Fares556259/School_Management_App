"use client";

import React, { useState, useTransition, useEffect } from "react";
import { payTeacherSalary, updateMissedHours } from "./actions";
import { getSchoolYearMonths, isMonthBefore, MONTHS } from "@/lib/dateUtils";
import { Banknote } from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

const dict = {
  en: {
    processSalary: "Process Salary",
    for: "For",
    targetMonth: "Target Month",
    selectMonth: "Select Month",
    salaryBreakdown: "Salary Breakdown",
    hourlyRate: "Hourly Rate",
    monthlyHours: "Monthly Hours",
    baseSalary: "Base Salary",
    missedHours: "Missed Hours",
    reset: "Reset",
    hoursMissed: "hours missed",
    deduction: "deduction",
    add: "+ Add",
    finalAmount: "Final Amount",
    hoursToAdd: "Hours to add",
    cancel: "Cancel",
    confirmPayment: "Confirm Payment",
    confirming: "Confirming...",
    expensePrefix: "Salary", expenseAdvancePrefix: "Advance", auditSalary: "Paid salary of {amount} DT to {name} for {month}", auditAdvance: "Paid advance of {amount} DT to {name} for {month}", missedSuffix: "missed", deductionSuffix: "deduction", success: "Salary processed successfully!", advanceSuccess: "Advance recorded!", advance: "Advance (Avance)", advanceAmount: "Advance Amount", giveAdvance: "Give Advance", advancePaid: "Advance Paid", remainingToPay: "Remaining to Pay", fullSalary: "Full Salary",
    error: "Failed to process salary",
    skipWarning: "Please pay for {earliestUnpaid} first to maintain chronological bookkeeping."
  },
  fr: {
    processSalary: "Traiter le salaire",
    for: "Pour",
    targetMonth: "Mois cible",
    selectMonth: "Sélectionner le mois",
    salaryBreakdown: "Détail du salaire",
    hourlyRate: "Taux horaire",
    monthlyHours: "Heures mensuelles",
    baseSalary: "Salaire de base",
    missedHours: "Heures manquées",
    reset: "Réinitialiser",
    hoursMissed: "heures manquées",
    deduction: "déduction",
    add: "+ Ajouter",
    finalAmount: "Montant final",
    hoursToAdd: "Heures à ajouter",
    cancel: "Annuler",
    confirmPayment: "Confirmer le paiement",
    confirming: "Confirmation...",
    expensePrefix: "Salaire", expenseAdvancePrefix: "Avance", auditSalary: "Salaire payé de {amount} DT à {name} pour {month}", auditAdvance: "Avance payée de {amount} DT à {name} pour {month}", missedSuffix: "manquées", deductionSuffix: "déduction", success: "Salaire traité avec succès!", advanceSuccess: "Avance enregistrée!", advance: "Avance", advanceAmount: "Montant avance", giveAdvance: "Donner une avance", advancePaid: "Avance payée", remainingToPay: "Reste à payer", fullSalary: "Salaire complet",
    error: "Échec du traitement du salaire",
    skipWarning: "Veuillez d'abord payer {earliestUnpaid} pour maintenir une comptabilité chronologique."
  },
  ar: {
    processSalary: "معالجة الراتب",
    for: "لـ",
    targetMonth: "الشهر المستهدف",
    selectMonth: "اختر الشهر",
    salaryBreakdown: "تفاصيل الراتب",
    hourlyRate: "معدل الساعة",
    monthlyHours: "الساعات الشهرية",
    baseSalary: "الراتب الأساسي",
    missedHours: "الساعات الضائعة",
    reset: "إعادة ضبط",
    hoursMissed: "ساعات ضائعة",
    deduction: "خصم",
    add: "+ إضافة",
    finalAmount: "المبلغ النهائي",
    hoursToAdd: "الساعات المضافة",
    cancel: "إلغاء",
    confirmPayment: "تأكيد الدفع",
    confirming: "جاري التأكيد...",
    expensePrefix: "راتب", expenseAdvancePrefix: "سلفة", auditSalary: "تم دفع راتب قدره {amount} د.ت إلى {name} لشهر {month}", auditAdvance: "تم دفع سلفة قدرها {amount} د.ت إلى {name} لشهر {month}", missedSuffix: "ساعات ضائعة", deductionSuffix: "خصم", success: "تمت معالجة الراتب بنجاح!", advanceSuccess: "تم تسجيل السلفة!", advance: "سلفة", advanceAmount: "مبلغ السلفة", giveAdvance: "إعطاء سلفة", advancePaid: "سلفة مدفوعة", remainingToPay: "المتبقي للدفع", fullSalary: "الراتب الكامل",
    error: "فشلت معالجة الراتب",
    skipWarning: "يرجى الدفع لشهر {earliestUnpaid} أولاً للحفاظ على التسلسل الزمني."
  }
};

export default function PaySalaryModal({
  teacherId,
  teacherName,
  salary,
  hourlyRate,
  hoursPerMonth,
  isPaid,
  isAdmin,
  monthName,
  paidMonths = [],
  payments = [],
  onSuccess,
  onMissedHoursUpdate,
}: {
  teacherId: string;
  teacherName: string;
  salary: number;
  hourlyRate?: number;
  hoursPerMonth?: number;
  isPaid: boolean;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
  payments?: any[];
  onSuccess?: (status: "PAID" | "PARTIAL", targetMonth: string, amount: number) => void;
  onMissedHoursUpdate?: (targetMonth: string, newTotal: number) => void;
}) {
  const { locale } = useLanguage();
  const t = dict[locale as keyof typeof dict] || dict.en;

  const allMonths = getSchoolYearMonths();
  const monthsList = allMonths.filter(m => !paidMonths.includes(m));

  const [isOpen, setIsOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(monthName || monthsList[0] || "");
  const [isPending, startTransition] = useTransition();

  // Get existing missed hours for the selected month from payments data
  const getExistingAdvance = (monthKey: string): number => {
    if (!payments || !monthKey) return 0;
    const [mName, yStr] = monthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal && p.status === "PARTIAL");
    return found?.amount || 0;
  };

  const getExistingMissedHours = (monthKey: string): number => {
    if (!payments || !monthKey) return 0;
    const [mName, yStr] = monthKey.split(" ");
    const monthIdx = MONTHS.indexOf(mName) + 1;
    const yearVal = parseInt(yStr);
    const found = payments.find(p => p.month === monthIdx && p.year === yearVal);
    return found?.missedHours || 0;
  };

  const [missedHours, setMissedHours] = useState(0);
  const [addHours, setAddHours] = useState<number | string>(0);
  const [isAdvanceMode, setIsAdvanceMode] = useState(false);
  const [advanceInput, setAdvanceInput] = useState<number | string>("");

  const rate = hourlyRate || 0;
  const monthlyHours = hoursPerMonth || 0;
  const baseSalary = rate > 0 && monthlyHours > 0 ? rate * monthlyHours : salary;
  const existingAdvance = getExistingAdvance(selectedMonth);
  const deduction = missedHours * rate;
  const finalAmount = Math.max(0, baseSalary - deduction - existingAdvance);

  const earliestUnpaid = monthsList[0];
  const isSkipping = !!(selectedMonth && earliestUnpaid && isMonthBefore(earliestUnpaid, selectedMonth));

  useEffect(() => {
    if (monthName && !paidMonths.includes(monthName)) {
      setSelectedMonth(monthName);
    }
  }, [monthName]);

  useEffect(() => {
    if (isOpen) {
      if (!selectedMonth || paidMonths.includes(selectedMonth)) {
        setSelectedMonth(monthsList[0] || "");
      } else if (monthName && !paidMonths.includes(monthName)) {
        setSelectedMonth(monthName);
      }
    }
  }, [isOpen]);

  // Update missed hours when month changes
  useEffect(() => {
    const existing = getExistingMissedHours(selectedMonth);
    setMissedHours(existing);
    setAddHours(0);
  }, [selectedMonth]);

  const handleAddMissedHours = () => {
    const toAdd = Number(addHours);
    if (toAdd <= 0) return;
    const newTotal = missedHours + toAdd;
    setMissedHours(newTotal);
    setAddHours(0);
    
    if (onMissedHoursUpdate) {
      onMissedHoursUpdate(selectedMonth, newTotal);
    }

    // Save to DB in the background
    startTransition(async () => {
      await updateMissedHours(teacherId, selectedMonth, newTotal);
    });
  };

  const handleResetMissedHours = () => {
    setMissedHours(0);
    setAddHours(0);
    
    if (onMissedHoursUpdate) {
      onMissedHoursUpdate(selectedMonth, 0);
    }
    
    startTransition(async () => {
      await updateMissedHours(teacherId, selectedMonth, 0);
    });
  };

  const handlePay = () => {
    if (!isAdmin || !selectedMonth || isSkipping) return;
    
    const amountToPay = isAdvanceMode ? Number(advanceInput) : finalAmount;
    if (isAdvanceMode && (amountToPay <= 0 || amountToPay > finalAmount)) return;

    setIsOpen(false);
    if (onSuccess) {
      onSuccess(isAdvanceMode ? "PARTIAL" : "PAID", selectedMonth, amountToPay);
    }

    startTransition(async () => {
      let expenseTitle = isAdvanceMode 
        ? `${t.expenseAdvancePrefix}: ${teacherName} (${selectedMonth})`
        : `${t.expensePrefix}: ${teacherName} (${selectedMonth})`;
        
      if (!isAdvanceMode && deduction > 0) {
        expenseTitle += ` - ${missedHours}h ${t.missedSuffix}`;
      }

      let auditDesc = isAdvanceMode
        ? t.auditAdvance.replace("{amount}", amountToPay.toString()).replace("{name}", teacherName).replace("{month}", selectedMonth)
        : t.auditSalary.replace("{amount}", amountToPay.toString()).replace("{name}", teacherName).replace("{month}", selectedMonth);
        
      if (!isAdvanceMode && deduction > 0) {
        auditDesc += ` (${missedHours}h ${t.missedSuffix}, -${deduction} DT ${t.deductionSuffix})`;
      }

      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedMonth,
        isAdvanceMode ? undefined : missedHours,
        isAdvanceMode ? undefined : deduction,
        isAdvanceMode,
        expenseTitle,
        auditDesc
      );
      if (!result.success) {
        console.error("Failed to process payment");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        disabled={!isAdmin}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-[#ffffff] border border-[#dddddd] shadow-sm hover:bg-[#f8fafc] transition-colors text-[#41454d] disabled:opacity-50"
        title={t.processSalary}
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
              <h2 className="text-[18px] font-semibold text-[#181d26] tracking-tight">{t.processSalary}</h2>
              <p className="text-[13px] text-[#5a5a5a]">
                {t.for} <span className="font-medium text-[#181d26]">{teacherName}</span>
              </p>
            </div>

            <div className="p-6">
              {/* Target Month */}
              <div className="mb-5">
                <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">{t.targetMonth}</label>
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

              {/* Advance Toggle */}
              <div className="mb-5 flex items-center justify-between p-3 border border-[#e2e8f0] rounded-[8px] bg-[#f8fafc]">
                <label className="text-[13px] font-medium text-[#41454d] cursor-pointer" onClick={() => setIsAdvanceMode(!isAdvanceMode)}>
                  {t.giveAdvance}
                </label>
                <input 
                  type="checkbox" 
                  checked={isAdvanceMode}
                  onChange={(e) => setIsAdvanceMode(e.target.checked)}
                  className="w-4 h-4 cursor-pointer accent-[#181d26]"
                />
              </div>

              {isAdvanceMode ? (
                <div className="mb-5">
                  <label className="block text-[13px] font-medium text-[#41454d] mb-1.5">{t.advanceAmount} (Max: {finalAmount} DT)</label>
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

              {/* Salary Breakdown */}
              {rate > 0 && monthlyHours > 0 && (
                <div className="mb-5 p-4 bg-[#f8fafc] rounded-[8px] border border-[#e2e8f0]">
                  <span className="text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">{t.salaryBreakdown}</span>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748b]">{t.hourlyRate}</span>
                      <span className="font-medium text-[#181d26]">{rate} DT/h</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-[#64748b]">{t.monthlyHours}</span>
                      <span className="font-medium text-[#181d26]">{monthlyHours} h</span>
                    </div>
                    <div className="flex justify-between text-[13px] pt-1 border-t border-[#e2e8f0]">
                      <span className="text-[#64748b]">{t.baseSalary}</span>
                      <span className="font-semibold text-[#181d26]">{baseSalary.toLocaleString()} DT</span>
                    </div>
                  </div>
                </div>
              )}

                            {/* Advance History Section */}
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

              {/* Missed Hours Section */}
              <div className="mb-5">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[13px] font-medium text-[#41454d]">{t.missedHours}</label>
                  {missedHours > 0 && (
                    <button
                      type="button"
                      onClick={handleResetMissedHours}
                      className="text-[11px] text-rose-500 hover:text-rose-700 font-medium"
                    >{t.reset}</button>
                  )}
                </div>

                {/* Current counter */}
                <div className="flex items-center gap-2 mb-2">
                  <div className={`flex-1 px-3 py-2 rounded-[8px] border text-[14px] font-medium ${
                    missedHours > 0 
                      ? "bg-rose-50 border-rose-200 text-rose-700" 
                      : "bg-emerald-50 border-emerald-200 text-emerald-700"
                  }`}>
                    {missedHours} {t.hoursMissed}
                    {missedHours > 0 && rate > 0 && (
                      <span className="text-[12px] font-normal ml-1">
                        (−{(missedHours * rate).toLocaleString()} DT)
                      </span>
                    )}
                  </div>
                </div>

                {/* Add hours input */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      value={addHours}
                      onChange={(e) => setAddHours(e.target.value)}
                      min={0}
                      placeholder={t.hoursToAdd}
                      className="w-full border border-[#dddddd] bg-white rounded-[8px] pl-3 pr-8 py-2 outline-none focus:border-[#181d26] focus:ring-1 focus:ring-[#181d26] transition-all text-[13px] text-[#181d26]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#94a3b8]">h</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMissedHours}
                    disabled={!addHours || Number(addHours) <= 0}
                    className="px-3 py-2 text-[12px] font-medium text-white bg-[#181d26] hover:bg-[#2a313e] rounded-[8px] transition-all disabled:opacity-40 whitespace-nowrap"
                  >{t.add}</button>
                </div>
              </div>

              {/* Final Amount */}
              <div className="mb-6 p-4 bg-[#f0fdf4] rounded-[8px] border border-[#bbf7d0]">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] font-semibold text-[#166534]">{t.finalAmount}</span>
                  <span className="text-[20px] font-bold text-[#166534]">
                    {finalAmount.toLocaleString()} <span className="text-[14px] font-normal">DT</span>
                  </span>
                </div>
                {deduction > 0 || existingAdvance > 0 ? (
                  <p className="text-[11px] text-[#166534] mt-1">
                    {baseSalary.toLocaleString()} 
                    {deduction > 0 ? ` − ${deduction.toLocaleString()} (${t.deduction})` : ""}
                    {existingAdvance > 0 ? ` − ${existingAdvance.toLocaleString()} (${t.advancePaid})` : ""}
                  </p>
                ) : null}
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
                  disabled={isPending || !selectedMonth || isSkipping}
                  className="flex-1 px-4 py-2.5 text-[13px] font-medium text-white bg-[#181d26] hover:bg-[#2a313e] rounded-[8px] transition-all disabled:opacity-50 shadow-sm"
                >
                  {isPending ? t.confirming : t.confirmPayment}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
