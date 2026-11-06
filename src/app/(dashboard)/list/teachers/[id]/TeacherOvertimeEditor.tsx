"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { overtimeValues } from "@/lib/overtimeAmount";
import { updateOvertimeHours } from "../actions";
import { useLanguage } from "@/lib/translations/LanguageContext";
export default function TeacherOvertimeEditor({
  teacherId,
  teacherName,
  period,
  hours,
  rate,
  recordedRate,
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
  const [value, setValue] = useState(String(hours));
  const initialRate = hours > 0 ? (recordedRate ?? rate) : rate;
  const initialAmount = Math.round(hours * initialRate * 1000) / 1000;
  const [amountInput, setAmountInput] = useState(String(initialAmount));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    setValue(String(hours));
    setAmountInput(String(initialAmount));
    setReview(false);
    setError("");
  }, [hours, initialAmount, period]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current?.close();
  }, [review]);
  const amount = Number(amountInput);
  let valid = value.trim() !== "" && amountInput.trim() !== "";
  try {
    overtimeValues(Number(value), initialRate, amount);
  } catch {
    valid = false;
  }
  const dirty = Number(value) !== hours || amount !== initialAmount;
  useEffect(() => {
    onPendingChange?.(busy || dirty || review);
  }, [busy, dirty, review, onPendingChange]);
  useEffect(() => () => onPendingChange?.(false), [onPendingChange]);
  const reset = () => {
    setValue(String(hours));
    setAmountInput(String(initialAmount));
    setReview(false);
    setError("");
  };
  const confirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await updateOvertimeHours(
        teacherId,
        period,
        Number(value),
        rate,
        {
          amount,
          expectedOvertime: { hours, rate: recordedRate ?? null },
          expectedSalary: { baseSalary, deduction },
        },
      );
      if (result.success && "payment" in result && result.payment) {
        onSaved(result.payment);
        setReview(false);
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
      setBusy(false);
    }
  };
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
      <div className="flex items-center gap-2 font-semibold text-emerald-900">
        <Plus size={17} />
        {tx("Heures supplémentaires", "Overtime", "الساعات الإضافية")}
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {tx(
          "Ajoutées au salaire, indépendamment des heures manquées.",
          "Added to salary, independently of missed hours.",
          "تُضاف إلى الراتب بصورة مستقلة عن ساعات الغياب.",
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-slate-600">
          {tx("Nombre d’heures", "Hours", "عدد الساعات")}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="744"
            step="0.01"
            disabled={closed || busy}
            value={value}
            onChange={(event) => {
              const next = event.target.value;
              const draftRate =
                Number(value) > 0 && Number.isFinite(amount)
                  ? amount / Number(value)
                  : initialRate;
              setValue(next);
              setAmountInput(
                String(
                  Math.round((Number(next) || 0) * draftRate * 1000) / 1000,
                ),
              );
            }}
            className="mt-1 block w-28 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          {tx(
            "Montant total · TND",
            "Total amount · TND",
            "المبلغ الإجمالي · د.ت",
          )}
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="1000000"
            step="0.001"
            disabled={closed || busy}
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            className="mt-1 block w-36 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        {!closed && (
          <button
            type="button"
            disabled={busy || !valid || !dirty}
            onClick={() => {
              setError("");
              setReview(true);
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {tx("Vérifier", "Review", "مراجعة")}
          </button>
        )}
        {!closed && dirty && (
          <button
            type="button"
            disabled={busy}
            onClick={reset}
            className="px-2 py-2 text-xs font-medium text-slate-600"
          >
            {tx(
              "Annuler les changements",
              "Discard changes",
              "إلغاء التغييرات",
            )}
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {tx(
          "Montant proposé selon le taux horaire, modifiable pour ce mois. Le taux de retenue reste inchangé.",
          "Suggested from the hourly rate; editable for this month. The deduction rate stays unchanged.",
          "مبلغ مقترح حسب أجر الساعة ويمكن تعديله لهذا الشهر. لا يتغيّر معدل الخصم.",
        )}
      </p>
      {!valid && dirty && (
        <p role="alert" className="mt-2 text-xs text-rose-700">
          {tx(
            "Vérifiez les heures (2 décimales maximum) et le montant (3 décimales maximum).",
            "Check the hours (up to 2 decimals) and amount (up to 3 decimals).",
            "تحقّق من الساعات (منزلتان عشريتان) والمبلغ (ثلاث منازل عشرية).",
          )}
        </p>
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
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setReview(false);
        }}
        onClose={() => {
          if (!busy) setReview(false);
        }}
        className="w-[calc(100%-2rem)] max-w-md rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/40"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-semibold">
            {tx(
              "Confirmer les heures supplémentaires",
              "Confirm overtime",
              "تأكيد الساعات الإضافية",
            )}
          </h2>
          <button
            disabled={busy}
            onClick={() => setReview(false)}
            aria-label={tx("Fermer", "Close", "إغلاق")}
          >
            <X size={18} />
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          {teacherName} · {period}
        </p>
        <dl className="mt-4 space-y-3 rounded-xl bg-emerald-50 p-4 text-sm">
          <div className="flex justify-between">
            <dt>
              {Number(value)} h ·{" "}
              {tx("Montant ajouté", "Amount added", "المبلغ المضاف")}
            </dt>
            <dd className="font-semibold">+ {amount} TND</dd>
          </div>
          <div className="flex justify-between border-t border-emerald-100 pt-3">
            <dt>
              {tx(
                "Salaire net calculé",
                "Calculated net salary",
                "صافي الراتب المحتسب",
              )}
            </dt>
            <dd className="font-semibold">
              {Math.max(
                0,
                Math.round((baseSalary - deduction + amount) * 1000) / 1000,
              )}{" "}
              TND
            </dd>
          </div>
          {paidAmount > 0 && (
            <>
              <div className="flex justify-between gap-3">
                <dt>{tx("Déjà versé", "Already paid", "تم دفعه سابقاً")}</dt>
                <dd>− {paidAmount} TND</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-emerald-100 pt-3 font-semibold">
                <dt>
                  {tx("Reste à verser", "Remaining to pay", "المتبقي للدفع")}
                </dt>
                <dd>
                  {Math.round(
                    Math.max(0, baseSalary - deduction + amount - paidAmount) *
                      1000,
                  ) / 1000}{" "}
                  TND
                </dd>
              </div>
            </>
          )}
        </dl>
        <p className="mt-3 text-xs text-slate-500">
          {tx(
            "Cet ajustement ne verse aucun salaire.",
            "This adjustment does not pay any salary.",
            "لا يؤدي هذا التعديل إلى صرف أي راتب.",
          )}
        </p>
        {error && (
          <p role="alert" className="mt-3 text-sm text-rose-600">
            {error}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-3">
          <button
            disabled={busy}
            onClick={() => setReview(false)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            {tx("Retour", "Back", "رجوع")}
          </button>
          <button
            disabled={busy || !valid}
            onClick={confirm}
            className="flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
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
