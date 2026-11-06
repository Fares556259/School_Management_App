"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import {
  appendOvertime,
  totalOvertime,
  type OvertimeEntry,
} from "@/lib/overtimeAmount";
import { updateOvertimeHours } from "../actions";
import { useLanguage } from "@/lib/translations/LanguageContext";

export default function TeacherOvertimeEditor({
  teacherId,
  teacherName,
  period,
  hours,
  rate,
  recordedRate,
  fixedAmount = 0,
  baseSalary,
  deduction,
  paidAmount = 0,
  closed,
  onSaved,
  onPendingChange,
}: {
  teacherId: string;
  teacherName: string;
  period: string;
  hours: number;
  rate: number;
  recordedRate?: number | null;
  fixedAmount?: number;
  baseSalary: number;
  deduction: number;
  paidAmount?: number;
  closed: boolean;
  onSaved: (payment: any) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { locale } = useLanguage();
  const tx = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const money = (n: number) =>
    new Intl.NumberFormat(
      locale === "ar" ? "ar-TN" : locale === "en" ? "en-GB" : "fr-TN",
      { maximumFractionDigits: 3 },
    ).format(n);
  const [mode, setMode] = useState<"hourly" | "fixed">("hourly");
  const [hoursInput, setHoursInput] = useState("");
  const [rateInput, setRateInput] = useState(rate > 0 ? String(rate) : "");
  const [amountInput, setAmountInput] = useState("");
  const [review, setReview] = useState<OvertimeEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const current = {
    overtimeHours: hours,
    overtimeRate: recordedRate ?? rate,
    overtimeFixedAmount: fixedAmount,
  };
  const currentAmount = totalOvertime(current, rate);
  const entry: OvertimeEntry =
    mode === "hourly"
      ? { mode, hours: Number(hoursInput), rate: Number(rateInput) }
      : { mode, amount: Number(amountInput) };
  const dirty =
    hoursInput !== "" ||
    amountInput !== "" ||
    rateInput !== (rate > 0 ? String(rate) : "");
  let valid =
    mode === "hourly"
      ? hoursInput.trim() !== "" && rateInput.trim() !== ""
      : amountInput.trim() !== "";
  let nextAmount = currentAmount;
  try {
    const next = appendOvertime(current, review ?? entry, rate);
    nextAmount = totalOvertime({
      overtimeHours: next.hours,
      overtimeRate: next.rate,
      overtimeFixedAmount: next.fixedAmount,
    });
  } catch {
    valid = false;
  }
  const nextNet =
    Math.round(Math.max(0, baseSalary - deduction + nextAmount) * 1000) / 1000;
  const resetDraft = () => {
    setHoursInput("");
    setAmountInput("");
    setRateInput(rate > 0 ? String(rate) : "");
    setReview(null);
    setError("");
  };
  useEffect(() => {
    setHoursInput("");
    setAmountInput("");
    setRateInput(rate > 0 ? String(rate) : "");
    setReview(null);
    setError("");
  }, [hours, recordedRate, fixedAmount, rate, period]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current?.close();
  }, [review]);
  useEffect(() => {
    onPendingChange?.(busy || dirty || Boolean(review));
  }, [busy, dirty, review, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const confirm = async () => {
    if (
      !review ||
      inFlight.current ||
      closed ||
      nextNet < paidAmount ||
      (!valid && review.mode !== "reset")
    )
      return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await updateOvertimeHours(
        teacherId,
        period,
        0,
        undefined,
        {
          entry: review,
          expectedOvertime: { hours, rate: recordedRate ?? null, fixedAmount },
          expectedSalary: { baseSalary, deduction, amountPaid: paidAmount },
        },
      );
      if (result.success && "payment" in result && result.payment) {
        resetDraft();
        onSaved(result.payment);
      } else
        setError(
          result.error ||
            tx("Échec de l’enregistrement.", "Could not save.", "تعذّر الحفظ."),
        );
    } catch {
      setError(
        tx(
          "Connexion interrompue. Actualisez avant de réessayer.",
          "Connection interrupted. Refresh before retrying.",
          "انقطع الاتصال. حدّث الصفحة قبل المحاولة مجدداً.",
        ),
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-emerald-900">
          <Plus size={17} />
          {tx("Heures supplémentaires", "Overtime", "الساعات الإضافية")}
        </div>
        {!closed && currentAmount > 0 && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setReview({ mode: "reset" });
            }}
            className="text-xs font-medium text-rose-700"
          >
            {tx(
              "Réinitialiser ce mois",
              "Reset this month",
              "إعادة ضبط هذا الشهر",
            )}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {tx(
          "Total enregistré ce mois",
          "Recorded this month",
          "المسجل لهذا الشهر",
        )}{" "}
        : <strong>{money(currentAmount)} TND</strong>
        {hours > 0 && ` · ${money(hours)} h`}
        {fixedAmount > 0 &&
          ` · ${tx("dont forfait", "including fixed", "منها مبلغ ثابت")} ${money(fixedAmount)} TND`}
      </p>
      {!closed && (
        <>
          <fieldset disabled={busy} className="mt-4 flex flex-wrap gap-2">
            <legend className="mb-2 text-xs font-medium text-slate-600">
              {tx(
                "Comment ajouter ?",
                "How would you like to add it?",
                "طريقة الإضافة",
              )}
            </legend>
            {(["hourly", "fixed"] as const).map((option) => (
              <label
                key={option}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${mode === option ? "border-emerald-600 bg-white font-semibold text-emerald-900" : "border-slate-200 text-slate-600"}`}
              >
                <input
                  type="radio"
                  name={`overtime-mode-${titleId}`}
                  checked={mode === option}
                  onChange={() => {
                    setMode(option);
                    setError("");
                  }}
                  className="accent-emerald-700"
                />
                {option === "hourly"
                  ? tx(
                      "Heures × taux horaire",
                      "Hours × hourly rate",
                      "الساعات × أجر الساعة",
                    )
                  : tx("Montant forfaitaire", "Fixed amount", "مبلغ ثابت")}
              </label>
            ))}
          </fieldset>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {mode === "hourly" ? (
              <>
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                  {tx("Heures à ajouter", "Hours to add", "الساعات المضافة")}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    max="744"
                    step="0.01"
                    placeholder="0"
                    disabled={busy}
                    value={hoursInput}
                    onChange={(e) => setHoursInput(e.target.value)}
                    className="mt-1 block w-full min-w-24 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
                <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                  {tx(
                    "Taux horaire · TND/h",
                    "Hourly rate · TND/h",
                    "أجر الساعة · د.ت/س",
                  )}
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0.001"
                    max="1000000"
                    step="0.001"
                    placeholder="0"
                    disabled={busy}
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="mt-1 block w-full min-w-24 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </label>
              </>
            ) : (
              <label className="min-w-0 flex-1 text-xs font-medium text-slate-600">
                {tx(
                  "Montant à ajouter · TND",
                  "Amount to add · TND",
                  "المبلغ المضاف · د.ت",
                )}
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.001"
                  max="1000000"
                  step="0.001"
                  placeholder="0"
                  disabled={busy}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </label>
            )}
            <button
              type="button"
              disabled={busy || !valid}
              onClick={() => {
                setError("");
                setReview(entry);
              }}
              className="flex items-center justify-center gap-1 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Plus size={15} />
              {tx("Ajouter", "Add", "إضافة")}
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-emerald-800" aria-live="polite">
              {valid
                ? `${mode === "hourly" ? `${money(Number(hoursInput))} h × ${money(Number(rateInput))} = ` : ""}+ ${money(Math.round((nextAmount - currentAmount) * 1000) / 1000)} TND`
                : tx(
                    "Choisissez un mode, puis saisissez l’ajout.",
                    "Choose a mode, then enter an addition.",
                    "اختر الطريقة ثم أدخل الإضافة.",
                  )}
            </span>
            {dirty && (
              <button
                type="button"
                disabled={busy}
                onClick={resetDraft}
                className="font-medium text-slate-600"
              >
                {tx("Effacer la saisie", "Clear entry", "مسح الإدخال")}
              </button>
            )}
          </div>
          {!valid &&
            (mode === "hourly" ? hoursInput !== "" : amountInput !== "") && (
              <p role="alert" className="mt-2 text-xs text-rose-700">
                {mode === "hourly"
                  ? tx(
                      "Vérifiez les heures (maximum 744, 2 décimales) et le taux positif (3 décimales).",
                      "Check hours (up to 744, 2 decimals) and a positive rate (3 decimals).",
                      "تحقق من الساعات (حتى 744 ومنزلتين عشريتين) وأجر الساعة الموجب (3 منازل).",
                    )
                  : tx(
                      "Indiquez un montant positif, avec 3 décimales au maximum.",
                      "Enter a positive amount with up to 3 decimals.",
                      "أدخل مبلغاً موجباً بثلاث منازل عشرية كحد أقصى.",
                    )}
              </p>
            )}
        </>
      )}
      {closed && (
        <p className="mt-2 text-xs text-slate-500">
          {tx(
            "Mois clôturé : les ajustements sont verrouillés.",
            "Closed month: adjustments are locked.",
            "الشهر مغلق: التعديلات مقفلة.",
          )}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        dir={locale === "ar" ? "rtl" : "ltr"}
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReview(null);
        }}
        onClose={() => {
          if (!busy) setReview(null);
        }}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-semibold">
            {review?.mode === "reset"
              ? tx(
                  "Réinitialiser les ajouts du mois ?",
                  "Reset this month’s overtime?",
                  "إعادة ضبط إضافات هذا الشهر؟",
                )
              : tx(
                  "Confirmer l’ajout au salaire",
                  "Confirm salary addition",
                  "تأكيد الإضافة إلى الراتب",
                )}
          </h2>
          <button
            type="button"
            disabled={busy}
            onClick={() => setReview(null)}
            aria-label={tx("Fermer", "Close", "إغلاق")}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {teacherName} · {period}
        </p>
        <dl className="mt-4 space-y-3 rounded-xl bg-emerald-50 p-4 text-sm">
          <div className="flex justify-between gap-3">
            <dt>
              {tx("Déjà enregistré", "Previously recorded", "المسجل سابقاً")}
            </dt>
            <dd>{money(currentAmount)} TND</dd>
          </div>
          {review?.mode !== "reset" && (
            <div className="flex justify-between gap-3">
              <dt>
                {review?.mode === "hourly"
                  ? `${money(review.hours)} h × ${money(review.rate)} TND/h`
                  : tx("Ajout forfaitaire", "Fixed addition", "إضافة ثابتة")}
              </dt>
              <dd className="font-semibold">
                +{" "}
                {money(Math.round((nextAmount - currentAmount) * 1000) / 1000)}{" "}
                TND
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-emerald-100 pt-3 font-semibold">
            <dt>
              {tx(
                "Nouveau total des ajouts",
                "New overtime total",
                "إجمالي الإضافات الجديد",
              )}
            </dt>
            <dd>{money(nextAmount)} TND</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>
              {tx(
                "Salaire net calculé",
                "Calculated net salary",
                "صافي الراتب المحتسب",
              )}
            </dt>
            <dd>{money(nextNet)} TND</dd>
          </div>
          {paidAmount > 0 && (
            <div className="flex justify-between gap-3">
              <dt>{tx("Déjà versé", "Already paid", "تم دفعه سابقاً")}</dt>
              <dd>− {money(paidAmount)} TND</dd>
            </div>
          )}
          <div className="flex justify-between gap-3 border-t border-emerald-100 pt-3 font-semibold">
            <dt>{tx("Reste à verser", "Remaining to pay", "المتبقي للدفع")}</dt>
            <dd>
              {money(
                Math.round(Math.max(0, nextNet - paidAmount) * 1000) / 1000,
              )}{" "}
              TND
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          {tx(
            "Cet ajustement ne verse aucun salaire. La retenue d’absence reste inchangée.",
            "This adjustment does not pay any salary. Absence deductions stay unchanged.",
            "هذا التعديل لا يصرف راتباً ولا يغير خصم الغياب.",
          )}
        </p>
        {(error || nextNet < paidAmount) && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {error ||
              tx(
                "Le salaire net ne peut pas être inférieur au montant déjà versé.",
                "Net salary cannot be below the amount already paid.",
                "لا يمكن أن يقل صافي الراتب عن المبلغ المدفوع سابقاً.",
              )}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => setReview(null)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            {tx("Retour", "Back", "رجوع")}
          </button>
          <button
            type="button"
            disabled={
              busy ||
              nextNet < paidAmount ||
              (!valid && review?.mode !== "reset")
            }
            onClick={confirm}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Check size={15} />
            {busy
              ? tx("Enregistrement…", "Saving…", "جاري الحفظ…")
              : tx("Confirmer", "Confirm", "تأكيد")}
          </button>
        </div>
      </dialog>
    </div>
  );
}
