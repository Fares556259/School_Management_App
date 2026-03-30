"use client";

/**
 * Shows the last 6 months as colored dots indicating paid/unpaid status.
 * Green = paid, Red = unpaid, for each month.
 */
export default function PaymentTimeline({
  payments,
}: {
  payments: { title: string; date: Date }[];
}) {
  // Build a set of paid months from payment titles like "(March 2026)"
  const paidMonths = new Set<string>();
  payments.forEach((p) => {
    const match = p.title.match(/\((.+?)\)$/);
    if (match) paidMonths.add(match[1]);
  });

  // Generate the last 6 months
  const months: { key: string; short: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    const short = d.toLocaleString("en-US", { month: "short" });
    months.push({ key, short });
  }

  return (
    <div className="flex items-center gap-1">
      {months.map((m) => {
        const isPaid = paidMonths.has(m.key);
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
