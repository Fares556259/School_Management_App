import { TrendingUp, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun",
  "Jul","Aug","Sep","Oct","Nov","Dec",
];

/** Returns the school-year start month index (0-based). Sept = 8. */
function getSchoolYearStart(now: Date): { startMonth: number; startYear: number } {
  const m = now.getMonth(); // 0-based
  // School year: Sept (8) → Aug (7) of next year
  if (m >= 8) return { startMonth: 8, startYear: now.getFullYear() };
  return { startMonth: 8, startYear: now.getFullYear() - 1 };
}

interface SalarySummaryCardProps {
  salary: number;
  payments: {
    id: number;
    month: number;   // 1-based (January = 1)
    year: number;
    amount: number;
    status: string;
    deferredAmount?: number | null;
    paidAt?: Date | null;
  }[];
}

export default function SalarySummaryCard({ salary, payments }: SalarySummaryCardProps) {
  const now = new Date();
  const { startMonth, startYear } = getSchoolYearStart(now);

  // Build the list of school-year months up to and including current month
  const schoolYearMonths: { month: number; year: number; label: string }[] = [];
  let m = startMonth; // 0-based
  let y = startYear;
  while (true) {
    const isAfterNow = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth());
    schoolYearMonths.push({ month: m + 1, year: y, label: `${MONTH_NAMES[m]} ${y}` });
    if (isAfterNow) break; // include one month ahead so current month shows
    m++;
    if (m > 11) { m = 0; y++; }
    if (y > now.getFullYear() + 1) break; // safety
  }

  // Only months already elapsed (not future) are "owed"
  const elapsedMonths = schoolYearMonths.filter(({ month, year }) => {
    return year < now.getFullYear() || (year === now.getFullYear() && month <= now.getMonth() + 1);
  });

  const totalOwed = elapsedMonths.length * salary;

  // Map payments for quick lookup
  const paymentMap = new Map<string, typeof payments[0]>();
  payments.forEach((p) => paymentMap.set(`${p.month}-${p.year}`, p));

  let totalFullyPaid = 0;
  let totalAdvanced = 0;

  elapsedMonths.forEach(({ month, year }) => {
    const p = paymentMap.get(`${month}-${year}`);
    if (!p) return;
    if (p.status === "PAID") {
      totalFullyPaid += p.amount;
    } else if (p.status === "PARTIAL") {
      // amount actually paid = amount - deferredAmount
      const actualPaid = p.amount - (p.deferredAmount ?? 0);
      totalAdvanced += Math.max(0, actualPaid);
    }
  });

  const totalPaidAll = totalFullyPaid + totalAdvanced;
  const outstanding = Math.max(0, totalOwed - totalPaidAll);
  const progressPct = totalOwed > 0 ? Math.min(100, Math.round((totalPaidAll / totalOwed) * 100)) : 0;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
          <Wallet className="w-4 h-4 text-emerald-600" />
        </div>
        <h2 className="text-base font-bold text-slate-800">Salary Summary</h2>
        <span className="ml-auto text-xs text-slate-400 font-medium">
          {startYear}/{startYear + 1} School Year
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-slate-500 mb-1.5">
          <span>{fmt(totalPaidAll)} paid</span>
          <span className="font-semibold">{progressPct}%</span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-right text-xs text-slate-400 mt-1">{fmt(totalOwed)} owed</div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">Fully Paid</span>
          </div>
          <p className="text-lg font-bold text-emerald-800">{fmt(totalFullyPaid)}</p>
        </div>

        <div className="bg-purple-50 rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 text-purple-600" />
            <span className="text-[11px] font-semibold text-purple-700 uppercase tracking-wide">Advanced</span>
          </div>
          <p className="text-lg font-bold text-purple-800">{fmt(totalAdvanced)}</p>
        </div>

        <div className={`col-span-2 rounded-lg p-3 ${outstanding > 0 ? "bg-rose-50" : "bg-slate-50"}`}>
          <div className="flex items-center gap-1.5 mb-1">
            <AlertCircle className={`w-3.5 h-3.5 ${outstanding > 0 ? "text-rose-500" : "text-slate-400"}`} />
            <span className={`text-[11px] font-semibold uppercase tracking-wide ${outstanding > 0 ? "text-rose-600" : "text-slate-500"}`}>
              Outstanding Balance
            </span>
          </div>
          <p className={`text-lg font-bold ${outstanding > 0 ? "text-rose-700" : "text-slate-500"}`}>
            {outstanding > 0 ? fmt(outstanding) : "All settled ✓"}
          </p>
        </div>
      </div>

      {/* Month-by-month status dots */}
      <div>
        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide mb-2">Monthly Status</p>
        <div className="flex flex-wrap gap-1.5">
          {schoolYearMonths.map(({ month, year, label }) => {
            const p = paymentMap.get(`${month}-${year}`);
            const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
            let dotClass = "bg-slate-200";
            let title = `${label}: Pending`;
            if (isFuture) { dotClass = "bg-slate-100"; title = `${label}: Future`; }
            else if (p?.status === "PAID") { dotClass = "bg-emerald-500"; title = `${label}: Paid`; }
            else if (p?.status === "PARTIAL") { dotClass = "bg-purple-400"; title = `${label}: Advance`; }
            else if (p?.status === "OVERDUE") { dotClass = "bg-rose-500"; title = `${label}: Overdue`; }

            return (
              <div key={`${month}-${year}`} className="flex flex-col items-center gap-0.5" title={title}>
                <div className={`w-4 h-4 rounded-full ${dotClass} transition-colors`} />
                <span className="text-[9px] text-slate-400">{MONTH_NAMES[month - 1]}</span>
              </div>
            );
          })}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-3">
          {[
            { color: "bg-emerald-500", label: "Paid" },
            { color: "bg-purple-400", label: "Advance" },
            { color: "bg-rose-500", label: "Overdue" },
            { color: "bg-slate-200", label: "Pending" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-[10px] text-slate-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
