"use client";
import { useEffect, useRef, useState } from "react";
import { Clock, Plus, Check, X } from "lucide-react";
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
  closed,
  onSaved,
}: {
  teacherId: string;
  teacherName: string;
  period: string;
  hours: number;
  rate: number;
  recordedRate?: number | null;
  baseSalary: number;
  deduction: number;
  closed: boolean;
  onSaved: (payment: any) => void;
}) {
  const { locale } = useLanguage();
  const tx = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const [value, setValue] = useState(String(hours));
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    setValue(String(hours));
    setError("");
  }, [hours, period]);
  useEffect(() => {
    if (review && !dialog.current?.open) dialog.current?.showModal();
    if (!review && dialog.current?.open) dialog.current?.close();
  }, [review]);
  const shownRate = Number(value) === hours ? (recordedRate ?? rate) : rate;
  const amount = Math.round((Number(value) || 0) * shownRate * 1000) / 1000;
  const valid =
    Number.isFinite(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= 744 &&
    (Number(value) === 0 || rate > 0);
  const confirm = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    const result = await updateOvertimeHours(
      teacherId,
      period,
      Number(value),
      rate,
    );
    setBusy(false);
    if (result.success && "payment" in result && result.payment) {
      onSaved(result.payment);
      setReview(false);
    } else
      setError(
        result.error ||
          tx("Échec de l’enregistrement.", "Could not save.", "تعذّر الحفظ."),
      );
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
            onChange={(event) => setValue(event.target.value)}
            className="mt-1 block w-28 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
        <div className="pb-2 text-sm font-semibold text-emerald-800">
          + {amount.toLocaleString()} TND{" "}
          <span className="text-xs font-normal text-slate-500">
            ({shownRate} TND/h)
          </span>
        </div>
        {!closed && (
          <button
            type="button"
            disabled={busy || !valid || Number(value) === hours}
            onClick={() => {
              setError("");
              setReview(true);
            }}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {tx("Vérifier", "Review", "مراجعة")}
          </button>
        )}
      </div>
      {rate <= 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {tx(
            "Définissez le taux horaire dans le profil enseignant avant d’ajouter des heures.",
            "Set the teacher’s hourly rate before adding overtime.",
            "حدّد أجر الساعة في ملف الأستاذ قبل إضافة الساعات.",
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
          <h2 className="font-semibold">
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
              {Number(value)} h × {rate} TND/h
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
