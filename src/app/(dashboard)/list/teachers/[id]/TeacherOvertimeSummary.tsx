"use client";

import type { OvertimeLine } from "@/lib/overtimeBreakdown";
import { useLanguage } from "@/lib/translations/LanguageContext";

/** Display hourly work and flat additions as separate lines in a salary breakdown. */
export default function TeacherOvertimeSummary({
  hours,
  overtimeAmount,
  fixedAmount = 0,
  lines,
}: {
  hours: number;
  overtimeAmount: number;
  fixedAmount?: number;
  lines?: OvertimeLine[];
}) {
  const { locale } = useLanguage();
  const tx = (fr: string, en: string, ar: string) =>
    locale === "ar" ? ar : locale === "en" ? en : fr;
  const money = (n: number) =>
    n.toLocaleString(
      locale === "ar" ? "ar-TN" : locale === "fr" ? "fr-TN" : "en-GB",
      { maximumFractionDigits: 3 },
    );
  const hourlyAmount = Math.round((overtimeAmount - fixedAmount) * 1000) / 1000;
  return (
    <>
      {(lines?.length ? lines : hours > 0 ? [{ hours, rate: null, amount: hourlyAmount, legacy: true }] : []).map((line, i) => (
        <div key={`${line.rate ?? 'legacy'}-${i}`} className="flex justify-between gap-3 text-emerald-700">
          <dt className="min-w-0">
            {tx("Heures supplémentaires", "Overtime", "الساعات الإضافية")} · {money(line.hours)} h
            {line.rate !== null && !line.legacy ? <> × {money(line.rate)} TND/h</> : <span className="block text-xs font-normal text-slate-500">{tx("Historique : détail des taux indisponible", "Historical total: rate detail unavailable", "إجمالي سابق: تفاصيل الأجر غير متوفرة")}</span>}
          </dt>
          <dd className="shrink-0 whitespace-nowrap">+ {money(line.amount)} TND</dd>
        </div>
      ))}
      {fixedAmount > 0 && (
        <div className="flex justify-between gap-3 text-emerald-700">
          <dt>
            {tx("Complément forfaitaire", "Fixed addition", "إضافة بمبلغ ثابت")}
          </dt>
          <dd className="shrink-0 whitespace-nowrap">
            + {money(fixedAmount)} TND
          </dd>
        </div>
      )}
    </>
  );
}
