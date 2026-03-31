"use client";
import { getSchoolYearMonths, isMonthBefore, MONTHS } from "@/lib/dateUtils";

/**
 * Shows the last 6 months as colored dots indicating paid/unpaid status.
 * Green = paid, Red = unpaid, for each month.
 */
export default function PaymentTimeline({
  payments,
}: {
  payments: { title: string; date: Date }[];
}) {
  const now = new Date();
  // Build a set of paid months from payment titles like "(March 2026)"
  const paidMonths = new Set<string>();
  payments.forEach((p) => {
    const match = p.title.match(/\((.+?)\)$/);
    if (match) paidMonths.add(match[1]);
  });

  const schoolMonths = getSchoolYearMonths(now);
  const currentMonthKey = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  // Generate only unpaid past/current months and paid future months
  const months: { key: string; short: string; status: "paid" | "unpaid" }[] = [];
  
  schoolMonths.forEach((monthKey: string) => {
    const isPastOrCurrent = monthKey === currentMonthKey || isMonthBefore(monthKey, currentMonthKey);
    const isPaid = paidMonths.has(monthKey);

    if (isPastOrCurrent && !isPaid) {
      // Show unpaid past/current in Red
      const [mName] = monthKey.split(" ");
      months.push({ 
        key: monthKey, 
        short: mName.substring(0, 3),
        status: "unpaid"
      });
    } else if (!isPastOrCurrent && isPaid) {
      // Show paid future in Green
      const [mName] = monthKey.split(" ");
      months.push({ 
        key: monthKey, 
        short: mName.substring(0, 3),
        status: "paid"
      });
    }
  });

  return (
    <div className="flex items-center gap-1">
      {months.map((m) => {
        const isPaid = m.status === "paid";
        return (
          <div
            key={m.key}
            title={`${m.key}: ${isPaid ? "Paid" : "Unpaid"}`}
            className="relative group"
          >
            <div
              className={`w-5 h-5 rounded-full text-[8px] font-bold flex items-center justify-center transition-transform hover:scale-125 cursor-default ${
                isPaid
                  ? "bg-emerald-400 text-white"
                  : "bg-rose-300 text-white"
              }`}
            >
              {m.short.charAt(0)}
            </div>
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-50">
              <div className="bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                {m.key}: {isPaid ? "✅ Paid" : "❌ Unpaid"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
