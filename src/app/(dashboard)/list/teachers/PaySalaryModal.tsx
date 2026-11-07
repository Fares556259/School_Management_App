"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, X } from "lucide-react";
import { payTeacherSalary, updateMissedHours } from "./actions";
import {
  getSchoolYearMonths,
  isMonthBefore,
  parseMonthYear,
} from "@/lib/dateUtils";
import {
  computeTeacherPaymentStatus,
  getTeacherPayableMonths,
  TeacherPayrollItem,
} from "@/lib/payrollUtils";
import { useLanguage } from "@/lib/translations/LanguageContext";
import TeacherOvertimeEditor from "./[id]/TeacherOvertimeEditor";
import TeacherOvertimeSummary from "./[id]/TeacherOvertimeSummary";
import { toast } from "react-toastify";

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
    expensePrefix: "Salary",
    expenseAdvancePrefix: "Advance",
    auditSalary: "Paid salary of {amount} DT to {name} for {month}",
    auditAdvance: "Paid advance of {amount} DT to {name} for {month}",
    missedSuffix: "missed",
    deductionSuffix: "deduction",
    success: "Salary processed successfully!",
    advanceSuccess: "Advance recorded!",
    advance: "Advance",
    advanceAmount: "Advance Amount",
    giveAdvance: "Give Advance",
    advancePaid: "Advance Paid",
    remainingToPay: "Remaining to Pay",
    fullSalary: "Full Salary",
    error: "Failed to process salary",
    skipWarning:
      "Please pay for {earliestUnpaid} first to maintain chronological bookkeeping.",
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
    expensePrefix: "Salaire",
    expenseAdvancePrefix: "Avance",
    auditSalary: "Salaire payé de {amount} DT à {name} pour {month}",
    auditAdvance: "Avance payée de {amount} DT à {name} pour {month}",
    missedSuffix: "manquées",
    deductionSuffix: "déduction",
    success: "Salaire traité avec succès!",
    advanceSuccess: "Avance enregistrée!",
    advance: "Avance",
    advanceAmount: "Montant avance",
    giveAdvance: "Donner une avance",
    advancePaid: "Avance payée",
    remainingToPay: "Reste à payer",
    fullSalary: "Salaire complet",
    error: "Échec du traitement du salaire",
    skipWarning:
      "Veuillez d'abord payer {earliestUnpaid} pour maintenir une comptabilité chronologique.",
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
    expensePrefix: "راتب",
    expenseAdvancePrefix: "سلفة",
    auditSalary: "تم دفع راتب قدره {amount} د.ت إلى {name} لشهر {month}",
    auditAdvance: "تم دفع سلفة قدرها {amount} د.ت إلى {name} لشهر {month}",
    missedSuffix: "ساعات ضائعة",
    deductionSuffix: "خصم",
    success: "تمت معالجة الراتب بنجاح!",
    advanceSuccess: "تم تسجيل السلفة!",
    advance: "سلفة",
    advanceAmount: "مبلغ السلفة",
    giveAdvance: "إعطاء سلفة",
    advancePaid: "سلفة مدفوعة",
    remainingToPay: "المتبقي للدفع",
    fullSalary: "الراتب الكامل",
    error: "فشلت معالجة الراتب",
    skipWarning:
      "يرجى الدفع لشهر {earliestUnpaid} أولاً للحفاظ على التسلسل الزمني.",
  },
};

type PayrollPayment = NonNullable<TeacherPayrollItem["payments"]>[number];
type Props = {
  teacherId: string;
  teacherName: string;
  salary: number;
  hourlyRate?: number;
  hoursPerMonth?: number;
  isPaid: boolean;
  isAdmin: boolean;
  monthName?: string;
  paidMonths?: string[];
  payments?: PayrollPayment[];
  onSuccess?: (
    status: "PAID" | "PARTIAL",
    targetMonth: string,
    amount: number,
    payment?: PayrollPayment,
  ) => void;
  onRollback?: (targetMonth: string, prevPayment: any) => void;
  onMissedHoursUpdate?: (targetMonth: string, newTotal: number) => void;
};

export default function PaySalaryModal(props: Props) {
  const { locale } = useLanguage();
  const [open, setOpen] = useState(false);
  const t = dict[locale as keyof typeof dict] || dict.en;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!props.isAdmin}
        className="w-8 h-8 flex items-center justify-center rounded-[6px] bg-white border border-[#dddddd] shadow-sm hover:bg-slate-50 text-[#41454d] disabled:opacity-50"
        title={t.processSalary}
        aria-label={`${t.processSalary} · ${props.teacherName}`}
      >
        <Banknote size={16} strokeWidth={2} />
      </button>
      {open && (
        <SalaryPaymentDialog {...props} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function SalaryPaymentDialog({
  teacherId,
  teacherName,
  salary,
  hourlyRate,
  hoursPerMonth,
  isAdmin,
  monthName,
  paidMonths = [],
  payments = [],
  onSuccess,
  onMissedHoursUpdate,
  onClose,
}: Props & { onClose: () => void }) {
  const { locale, t: globalT } = useLanguage();
  const t = dict[locale as keyof typeof dict] || dict.en;
  const tx = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const paymentInFlight = useRef(false);
  const [localPayments, setLocalPayments] = useState(payments);
  const months = getTeacherPayableMonths(
    { salary, hourlyRate, hoursPerMonth, payments: localPayments },
    getSchoolYearMonths(),
    paidMonths,
  );
  const [selectedMonth, setSelectedMonth] = useState(
    monthName &&
      months.includes(monthName) &&
      !isMonthBefore(months[0], monthName)
      ? monthName
      : months[0] || "",
  );
  const [busy, setBusy] = useState(false);
  const [overtimePending, setOvertimePending] = useState(false);
  const [addHours, setAddHours] = useState("");
  const [advanceMode, setAdvanceMode] = useState(false);
  const [adjustment, setAdjustment] = useState<"overtime" | "absence" | null>(
    null,
  );
  const [advanceInput, setAdvanceInput] = useState("");
  const [error, setError] = useState("");
  const [adjustmentNotice, setAdjustmentNotice] = useState("");
  const [completed, setCompleted] = useState<{
    amount: number;
    month: string;
    remaining: number;
    paidAt: Date | string;
  } | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const parsed = selectedMonth ? parseMonthYear(selectedMonth) : null;
  const payroll = parsed
    ? computeTeacherPaymentStatus(
        { salary, hourlyRate, hoursPerMonth, payments: localPayments },
        parsed.month,
        parsed.year,
      )
    : null;
  const payment = payroll?.payment as PayrollPayment | null;
  const blocked = busy || overtimePending;
  const isSkipping = !!(
    selectedMonth &&
    payroll &&
    payroll.remaining > 0 &&
    months[0] &&
    isMonthBefore(months[0], selectedMonth)
  );
  const amountToPay = advanceMode
    ? Number(advanceInput)
    : payroll?.remaining || 0;
  const validAmount =
    Number.isFinite(amountToPay) &&
    amountToPay > 0 &&
    amountToPay <= (payroll?.remaining || 0) &&
    Math.abs(amountToPay * 1000 - Math.round(amountToPay * 1000)) < 0.00001;
  const monthLabel = (key: string) => {
    const { month, year } = parseMonthYear(key);
    return new Date(year, month - 1, 1).toLocaleDateString(
      locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-TN" : "en-GB",
      { month: "long", year: "numeric" },
    );
  };
  const money = (n: number) =>
    n.toLocaleString(
      locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-TN" : "en-GB",
      { maximumFractionDigits: 3 },
    );
  const saveLocal = (next: PayrollPayment) =>
    setLocalPayments((prev) => [
      next,
      ...prev.filter((p) => p.month !== next.month || p.year !== next.year),
    ]);

  async function saveMissedHours(nextHours: number) {
    if (
      !isAdmin ||
      blocked ||
      !payroll ||
      payroll.isPaid ||
      !Number.isFinite(nextHours) ||
      nextHours < 0 ||
      nextHours > 744
    )
      return;
    setBusy(true);
    setError("");
    try {
      let previousMeta: Record<string, unknown> = {};
      try {
        const value = JSON.parse(payment?.img || "{}");
        if (value && typeof value === "object" && !Array.isArray(value))
          previousMeta = value;
      } catch {}
      const meta = {
        ...previousMeta,
        trackedHours: nextHours,
        deductedHours: nextHours,
        deductionStatus: "APPLIED" as const,
      };
      const result = await updateMissedHours(
        teacherId,
        selectedMonth,
        nextHours,
        meta,
      );
      if (!result.success || !("payment" in result) || !result.payment) {
        setError(result.error || t.error);
        return;
      }
      saveLocal(result.payment);
      setAddHours("");
      onMissedHoursUpdate?.(selectedMonth, nextHours);
      router.refresh();
    } catch {
      setError(globalT.toasts.connectionError);
    } finally {
      setBusy(false);
    }
  }

  async function handlePay() {
    if (
      !isAdmin ||
      completed ||
      paymentInFlight.current ||
      blocked ||
      !payroll ||
      payroll.isPaid ||
      !parsed ||
      isSkipping ||
      !validAmount
    )
      return;
    paymentInFlight.current = true;
    let recorded = false;
    setBusy(true);
    setError("");
    try {
      // Send the displayed balance as a precondition; the server recalculates it.
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedMonth,
        undefined,
        undefined,
        advanceMode,
        undefined,
        undefined,
        undefined,
        {
          netDue: payroll.netDue,
          amountPaid: payroll.amountPaid,
          overtimeHours: payroll.overtimeHours,
          overtimeRate: payment?.overtimeRate ?? null,
          overtimeFixedAmount: payment?.overtimeFixedAmount || 0,
        },
      );
      if (!result.success) {
        setError(result.error || t.error);
        return;
      }
      recorded = true;
      const saved = result.payment;
      const remaining = saved
        ? computeTeacherPaymentStatus(
            { salary, hourlyRate, hoursPerMonth, payments: [saved] },
            parsed.month,
            parsed.year,
          ).remaining
        : Math.round(Math.max(0, payroll.remaining - amountToPay) * 1000) /
          1000;
      // End the payment flow before any list refresh or UI callback can fail.
      setCompleted({
        amount: amountToPay,
        month: selectedMonth,
        remaining,
        paidAt: saved?.paidAt || new Date().toISOString(),
      });
      setAdjustment(null);
      setError("");
      if (saved) saveLocal(saved);
      try {
        onSuccess?.(
          remaining > 0 ? "PARTIAL" : "PAID",
          selectedMonth,
          amountToPay,
          saved,
        );
      } catch (refreshError) {
        console.error("Salary recorded; list update failed", refreshError);
      }
      try {
        router.refresh();
      } catch (refreshError) {
        console.error("Salary recorded; page refresh failed", refreshError);
      }
    } catch {
      setError(globalT.toasts.connectionError);
    } finally {
      if (!recorded) paymentInFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby="salary-dialog-title"
      dir={locale === "ar" ? "rtl" : "ltr"}
      onCancel={(event) => {
        if (event.target !== event.currentTarget) return;
        if (busy) event.preventDefault();
        else onClose();
      }}
      onClose={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm"
    >
      <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white px-6 py-5">
        <div>
          <h2
            id="salary-dialog-title"
            className="text-lg font-semibold text-slate-900"
          >
            {completed
              ? tx("Versement confirmé", "Payment confirmed", "تم تأكيد الدفع")
              : t.processSalary}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{teacherName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={tx("Fermer", "Close", "إغلاق")}
          className="rounded-lg border p-2 disabled:opacity-40"
        >
          <X size={17} />
        </button>
      </header>
      {completed ? (
        <>
          <div className="px-6 py-6" role="status" aria-live="polite">
            <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
              <CheckCircle2
                size={40}
                className="mb-3 text-emerald-700"
                aria-hidden="true"
              />
              <p className="font-semibold text-emerald-900">
                {tx(
                  "Paiement enregistré",
                  "Payment recorded",
                  "تم تسجيل الدفع",
                )}
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
                {money(completed.amount)}{" "}
                <span className="text-base font-medium">TND</span>
              </p>
              <p className="mt-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800">
                {completed.remaining > 0
                  ? tx(
                      "Avance enregistrée",
                      "Advance recorded",
                      "تم تسجيل السلفة",
                    )
                  : tx("Mois soldé", "Month settled", "الشهر مسدّد")}
              </p>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">{t.targetMonth}</dt>
                <dd className="font-medium text-slate-900">
                  {monthLabel(completed.month)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">
                  {tx("Date du versement", "Payment date", "تاريخ الدفع")}
                </dt>
                <dd className="font-medium text-slate-900">
                  {new Date(completed.paidAt).toLocaleDateString(
                    locale === "ar"
                      ? "ar-TN"
                      : locale === "fr"
                        ? "fr-TN"
                        : "en-GB",
                    {
                      timeZone: "Africa/Tunis",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    },
                  )}
                </dd>
              </div>
              {completed.remaining > 0 && (
                <div className="flex justify-between gap-4 border-t pt-3">
                  <dt className="text-slate-500">{t.remainingToPay}</dt>
                  <dd className="font-semibold text-slate-900">
                    {money(completed.remaining)} TND
                  </dd>
                </div>
              )}
            </dl>
            <p className="mt-5 text-sm leading-6 text-slate-500">
              {tx(
                "Le versement figure dans les dépenses de l’école.",
                "The payment is recorded in the school’s expenses.",
                "تم تسجيل المبلغ ضمن مصاريف المدرسة.",
              )}
            </p>
          </div>
          <footer className="border-t bg-white px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              autoFocus
              className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
            >
              {tx("Terminer", "Done", "تم")}
            </button>
          </footer>
        </>
      ) : (
        <>
          <div className="space-y-5 px-6 py-5">
            {(months.length > 0 || payroll) && (
              <label className="block text-sm font-medium text-slate-700">
                {t.targetMonth}
                <select
                  aria-label={t.targetMonth}
                  value={selectedMonth}
                  disabled={busy || overtimePending || months.length === 0}
                  onChange={(event) => {
                    setSelectedMonth(event.target.value);
                    setAdjustment(null);
                    setOvertimePending(false);
                    setAddHours("");
                    setAdvanceInput("");
                    setError("");
                  }}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3"
                >
                  <option value="" disabled>
                    {t.selectMonth}
                  </option>
                  {selectedMonth && !months.includes(selectedMonth) && (
                    <option value={selectedMonth} disabled>
                      {monthLabel(selectedMonth)} ·{" "}
                      {tx("Soldé", "Settled", "مسدّد")}
                    </option>
                  )}
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!payroll && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900"
              >
                <p className="font-semibold">
                  {tx(
                    "Aucun salaire à régler",
                    "No salary balance to pay",
                    "لا يوجد راتب متبقٍ للدفع",
                  )}
                </p>
                <p className="mt-2 text-sm">
                  {tx(
                    "Les mois soldés ne figurent pas dans les choix de paiement.",
                    "Settled months are excluded from payment choices.",
                    "لا تظهر الأشهر المسدّدة ضمن خيارات الدفع.",
                  )}
                </p>
              </div>
            )}
            {payroll && (
              <>
                <dl className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt>{t.baseSalary}</dt>
                    <dd className="font-semibold">
                      {money(payroll.baseSalary)} TND
                    </dd>
                  </div>
                  {payroll.deduction > 0 && (
                    <div className="flex justify-between gap-3 text-rose-700">
                      <dt>
                        {t.deduction} · {payroll.deductedHours} h
                      </dt>
                      <dd>− {money(payroll.deduction)} TND</dd>
                    </div>
                  )}
                  <TeacherOvertimeSummary
                    hours={payroll.overtimeHours}
                    overtimeAmount={payroll.overtimeAmount}
                    fixedAmount={payroll.overtimeFixedAmount}
                  />
                  {payroll.amountPaid > 0 && (
                    <div className="flex justify-between gap-3 text-amber-700">
                      <dt>
                        {tx("Déjà versé", "Already paid", "تم دفعه سابقاً")}
                      </dt>
                      <dd>− {money(payroll.amountPaid)} TND</dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3 border-t pt-3 text-base font-semibold text-slate-900">
                    <dt>{t.remainingToPay}</dt>
                    <dd>{money(payroll.remaining)} TND</dd>
                  </div>
                </dl>
                {payroll.remaining <= 0 ? (
                  <div
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-900"
                  >
                    {tx(
                      "Ce mois est soldé. Aucun paiement supplémentaire n’est nécessaire.",
                      "This month is settled. No additional payment is needed.",
                      "هذا الشهر مسدّد. لا حاجة إلى دفع إضافي.",
                    )}
                  </div>
                ) : (
                  <>
                    <section
                      aria-label={tx(
                        "Ajustements du salaire",
                        "Salary adjustments",
                        "تعديلات الراتب",
                      )}
                    >
                      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {tx(
                          "Ajuster ce mois",
                          "Adjust this month",
                          "تعديل هذا الشهر",
                        )}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          aria-expanded={adjustment === "overtime"}
                          aria-controls="salary-overtime-panel"
                          disabled={busy}
                          onClick={() => {
                            if (!overtimePending)
                              setAdjustment(
                                adjustment === "overtime" ? null : "overtime",
                              );
                          }}
                          className={`rounded-lg border px-3 py-2 text-sm font-medium ${adjustment === "overtime" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                        >
                          +{" "}
                          {tx(
                            "Heures supplémentaires",
                            "Overtime",
                            "الساعات الإضافية",
                          )}
                        </button>
                        <button
                          type="button"
                          aria-expanded={adjustment === "absence"}
                          aria-controls="salary-absence-panel"
                          disabled={busy || overtimePending}
                          onClick={() =>
                            setAdjustment(
                              adjustment === "absence" ? null : "absence",
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40 ${adjustment === "absence" ? "border-rose-300 bg-rose-50 text-rose-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                        >
                          − {t.missedHours}
                        </button>
                      </div>
                      {adjustment === "overtime" && (
                        <div id="salary-overtime-panel" className="mt-3">
                          <TeacherOvertimeEditor
                            key={selectedMonth}
                            teacherId={teacherId}
                            teacherName={teacherName}
                            period={selectedMonth}
                            hours={payroll.overtimeHours}
                            recordedRate={payment?.overtimeRate}
                            fixedAmount={payment?.overtimeFixedAmount || 0}
                            rate={
                              hourlyRate && hourlyRate > 0
                                ? hourlyRate
                                : hoursPerMonth && hoursPerMonth > 0
                                  ? Math.round(
                                      (payroll.baseSalary / hoursPerMonth) *
                                        1000,
                                    ) / 1000
                                  : 0
                            }
                            baseSalary={payroll.baseSalary}
                            deduction={payroll.deduction}
                            paidAmount={payroll.amountPaid}
                            closed={busy || payroll.isPaid}
                            onPendingChange={setOvertimePending}
                            onSaved={(next) => {
                              saveLocal(next);
                              setAdjustment(null);
                              setAdjustmentNotice(
                                tx(
                                  "Heures supplémentaires mises à jour. Confirmez le paiement pour verser le salaire.",
                                  "Overtime updated. Confirm payment to pay the salary.",
                                  "تم تحديث الساعات الإضافية. أكّد الدفع لصرف الراتب.",
                                ),
                              );
                              toast.success(
                                tx(
                                  "Heures supplémentaires mises à jour.",
                                  "Overtime updated.",
                                  "تم تحديث الساعات الإضافية.",
                                ),
                              );
                              router.refresh();
                            }}
                          />
                        </div>
                      )}
                      {adjustment === "absence" && (
                        <div id="salary-absence-panel" className="mt-3">
                          <section className="rounded-xl border border-slate-200 p-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold">
                                {t.missedHours} · {payroll.missedHours} h
                              </h3>
                              {payroll.missedHours > 0 && (
                                <button
                                  type="button"
                                  onClick={() => saveMissedHours(0)}
                                  disabled={blocked || payroll.isPaid}
                                  className="text-xs font-medium text-rose-600 disabled:opacity-40"
                                >
                                  {t.reset}
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <label className="flex-1">
                                <span className="sr-only">{t.hoursToAdd}</span>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min="0"
                                  max="744"
                                  step="0.01"
                                  aria-label={t.hoursToAdd}
                                  disabled={blocked || payroll.isPaid}
                                  value={addHours}
                                  onChange={(event) =>
                                    setAddHours(event.target.value)
                                  }
                                  placeholder={t.hoursToAdd}
                                  className="w-full rounded-lg border px-3 py-2 text-sm"
                                />
                              </label>
                              <button
                                type="button"
                                disabled={
                                  blocked ||
                                  payroll.isPaid ||
                                  !Number.isFinite(Number(addHours)) ||
                                  Number(addHours) <= 0 ||
                                  Number(addHours) + payroll.missedHours > 744
                                }
                                onClick={() =>
                                  saveMissedHours(
                                    payroll.missedHours + Number(addHours),
                                  )
                                }
                                className="rounded-lg border px-3 py-2 text-sm font-medium disabled:opacity-40"
                              >
                                {t.add}
                              </button>
                            </div>
                          </section>
                        </div>
                      )}
                    </section>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium text-slate-700">
                        {tx(
                          "Que versez-vous aujourd’hui ?",
                          "What are you paying today?",
                          "ماذا ستدفع اليوم؟",
                        )}
                      </legend>
                      <div className="grid grid-cols-2 gap-2">
                        {[false, true].map((advance) => (
                          <label
                            key={String(advance)}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium ${advanceMode === advance ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600"}`}
                          >
                            <input
                              type="radio"
                              name="salary-payment-mode"
                              checked={advanceMode === advance}
                              disabled={busy}
                              onChange={() => setAdvanceMode(advance)}
                              className="h-4 w-4 accent-blue-600"
                            />
                            {advance ? t.advance : t.remainingToPay}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {advanceMode && (
                      <label className="block text-sm font-medium">
                        {t.advanceAmount} · Max {money(payroll.remaining)} TND
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.001"
                          max={payroll.remaining}
                          step="0.001"
                          value={advanceInput}
                          disabled={busy}
                          onChange={(event) =>
                            setAdvanceInput(event.target.value)
                          }
                          className="mt-2 w-full rounded-lg border px-3 py-3"
                        />
                      </label>
                    )}
                  </>
                )}
              </>
            )}
            {adjustmentNotice && (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
              >
                {adjustmentNotice}
              </p>
            )}
            {overtimePending && (
              <p role="status" className="text-sm text-amber-800">
                {tx(
                  "Confirmez ou annulez les modifications des heures supplémentaires avant de payer.",
                  "Confirm or discard the overtime changes before paying.",
                  "أكّد تعديلات الساعات الإضافية أو ألغها قبل الدفع.",
                )}
              </p>
            )}
            {isSkipping && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t.skipWarning.replace(
                  "{earliestUnpaid}",
                  monthLabel(months[0]),
                )}
              </p>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"
              >
                {error}
              </p>
            )}
          </div>
          <footer className="sticky bottom-0 border-t bg-white px-6 py-4">
            {!payroll || payroll.remaining <= 0 ? (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                {tx("Terminer", "Done", "تم")}
              </button>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-600">
                    {t.finalAmount}
                  </span>
                  <strong className="text-xl text-slate-900">
                    {money(amountToPay || 0)} TND
                  </strong>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={busy}
                    className="rounded-lg border px-4 py-3 text-sm"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handlePay}
                    disabled={
                      blocked ||
                      !selectedMonth ||
                      isSkipping ||
                      !validAmount ||
                      payroll?.isPaid
                    }
                    className="flex-1 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    {busy ? t.confirming : t.confirmPayment}
                  </button>
                </div>
              </>
            )}
          </footer>
        </>
      )}
    </dialog>
  );
}
