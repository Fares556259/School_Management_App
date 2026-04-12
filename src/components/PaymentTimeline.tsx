"use client";
import { getSchoolYearMonths, isMonthBefore, MONTHS } from "@/lib/dateUtils";

import { Payment } from "@prisma/client";

/**
 * Shows the last 6 months as colored dots indicating paid/unpaid status.
 * Green = paid, Red = unpaid, for each month.
 */
export default function PaymentTimeline({
  payments,
}: {
  payments: Payment[];
}) {
  const now = new Date();
  // Build a set of paid months dynamically from structured Payment records
  const paidMonths = new Map<string, "PAID" | "PARTIAL">();
  payments.forEach((p) => {
    if ((p.status === "PAID" || p.status === "PARTIAL") && p.month > 0 && p.month <= 12) {
      paidMonths.set(`${MONTHS[p.month - 1] || "Unknown"} ${p.year}`, p.status as any);
    }
  });

  const schoolMonths = getSchoolYearMonths(now);
  const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Generate status for all school months
  const months: { key: string; short: string; status: "paid" | "partial" | "unpaid" }[] = [];
  
  schoolMonths.forEach((monthKey: string) => {
    const isPastOrCurrent = monthKey === currentMonthKey || isMonthBefore(monthKey, currentMonthKey);
    const paymentStatus = paidMonths.get(monthKey);

    const [mName] = monthKey.split(" ");
    const short = mName.substring(0, 3);

    if (paymentStatus === "PARTIAL") {
      months.push({ key: monthKey, short, status: "partial" });
    } else if (!paymentStatus) {
      months.push({ key: monthKey, short, status: "unpaid" });
    }
  });

  return (
    <div className="flex items-center gap-1">
      {months.map((m) => {
        const isPaid = m.status === "paid";
        return (
          <div
            key={m.key}
            title={`${m.key}: ${m.status.charAt(0).toUpperCase() + m.status.slice(1)}`}
            className="relative group"
          >
            <div
              className={`w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center transition-transform hover:scale-125 cursor-default ${
                m.status === "paid"
                  ? "bg-emerald-400 text-white"
                  : m.status === "partial"
                    ? "bg-orange-400 text-white"
                    : "bg-rose-300 text-white"
              }`}
            >
              {m.short.charAt(0)}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
              <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                {m.key}: {m.status === "paid" ? "✅ Paid" : m.status === "partial" ? "⚠️ Partial" : "❌ Unpaid"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
