"use client";

import { useLanguage } from "@/lib/translations/LanguageContext";

/** Display hourly work and flat additions as separate lines in a salary breakdown. */
export default function TeacherOvertimeSummary({
  hours,
  overtimeAmount,
  fixedAmount = 0,
}: {
  hours: number;
  overtimeAmount: number;
  fixedAmount?: number;
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
      {hours > 0 && (
        <div className="flex justify-between gap-3 text-emerald-700">
          <dt>
            {tx("Heures supplémentaires", "Overtime", "الساعات الإضافية")} ·{" "}
            {money(hours)} h
          </dt>
          <dd className="shrink-0 whitespace-nowrap">
            + {money(hourlyAmount)} TND
          </dd>
        </div>
      )}
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
