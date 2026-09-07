"use client";

import { TrendingUp, Wallet, AlertCircle, CheckCircle2, Calendar } from "lucide-react";

const MONTH_NAMES = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
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
    id?: number;
    month: number;   // 1-based (January = 1)
    year: number;
    amount: number;
    status: string;
    deferredAmount?: number | null;
    paidAt?: Date | string | null;
  }[];
  selectedMonth?: { month: number; year: number };
  onSelectMonth?: (month: number, year: number) => void;
}

export default function SalarySummaryCard({
  salary,
  payments,
  selectedMonth,
  onSelectMonth,
}: SalarySummaryCardProps) {
  const now = new Date();
  const { startMonth, startYear } = getSchoolYearStart(now);

  // Build the complete 12 months of the school year cycle (September -> August)
  const schoolYearMonths: { month: number; year: number; label: string; fullLabel: string }[] = [];
  let m = startMonth; // 0-based: 8 (Septembre)
  let y = startYear;
  for (let i = 0; i < 12; i++) {
    schoolYearMonths.push({
      month: m + 1,
      year: y,
      label: `${MONTH_NAMES[m]} ${y}`,
      fullLabel: `${MONTH_NAMES_FR[m]} ${y}`,
    });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }

  // Also include any extra months from payments that fall outside the standard 12 months
  payments.forEach((p) => {
    const exists = schoolYearMonths.some((item) => item.month === p.month && item.year === p.year);
    if (!exists && p.month >= 1 && p.month <= 12) {
      const monthIdx = p.month - 1;
      schoolYearMonths.push({
        month: p.month,
        year: p.year,
        label: `${MONTH_NAMES[monthIdx]} ${p.year}`,
        fullLabel: `${MONTH_NAMES_FR[monthIdx]} ${p.year}`,
      });
    }
  });

  // Sort chronologically
  schoolYearMonths.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

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

  // Calculate all payments matching school year months
  payments.forEach((p) => {
    const matchesSchoolYear = schoolYearMonths.some((item) => item.month === p.month && item.year === p.year);
    if (!matchesSchoolYear) return;

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
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Synthèse des Rémunérations</h2>
            <p className="text-xs text-slate-400">Année scolaire {startYear} - {startYear + 1}</p>
          </div>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
          Base : {fmt(salary)} / mois
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
        <div className="flex justify-between items-center text-xs text-slate-600 mb-2 font-medium">
          <span className="flex items-center gap-1.5 font-bold text-slate-800">
            <span>Payé cumulé :</span>
            <span className="text-emerald-600 font-black">{fmt(totalPaidAll)}</span>
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
            {progressPct}% réglé
          </span>
        </div>
        <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2 font-medium">
          <span>{elapsedMonths.length} mois échus</span>
          <span>Total dû (échus) : {fmt(totalOwed)}</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-emerald-50/80 border border-emerald-100 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
              Salaires Soldés
            </span>
          </div>
          <p className="text-xl font-black text-emerald-900">{fmt(totalFullyPaid)}</p>
          <span className="text-[10px] text-emerald-700 font-medium">Mois entièrement payés</span>
        </div>

        <div className="bg-purple-50/80 border border-purple-100 rounded-xl p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <TrendingUp className="w-4 h-4 text-purple-600 shrink-0" />
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wide">
              Acomptes Versés
            </span>
          </div>
          <p className="text-xl font-black text-purple-900">{fmt(totalAdvanced)}</p>
          <span className="text-[10px] text-purple-700 font-medium">Avances sur salaire</span>
        </div>

        <div className={`rounded-xl p-3.5 border ${outstanding > 0 ? "bg-rose-50/80 border-rose-100" : "bg-slate-50 border-slate-200/70"}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <AlertCircle className={`w-4 h-4 shrink-0 ${outstanding > 0 ? "text-rose-600" : "text-slate-500"}`} />
            <span className={`text-[11px] font-bold uppercase tracking-wide ${outstanding > 0 ? "text-rose-800" : "text-slate-600"}`}>
              Reste à Payer
            </span>
          </div>
          <p className={`text-xl font-black ${outstanding > 0 ? "text-rose-900" : "text-slate-700"}`}>
            {outstanding > 0 ? fmt(outstanding) : "Tout est réglé ✓"}
          </p>
          <span className={`text-[10px] font-medium ${outstanding > 0 ? "text-rose-700" : "text-slate-500"}`}>
            {outstanding > 0 ? "Arriérés et mois courant" : "Aucun impayé"}
          </span>
        </div>
      </div>

      {/* Month-by-month status dots */}
      <div className="border-t border-slate-100 pt-4">
        <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mb-2.5">
          Chronologie des Mois
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
          {schoolYearMonths.map(({ month, year, label }) => {
            const p = paymentMap.get(`${month}-${year}`);
            const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
            const isSelected = selectedMonth?.month === month && selectedMonth?.year === year;

            let dotColor = "bg-slate-200 border-slate-300 text-slate-600";
            let statusText = "En attente";

            if (p?.status === "PAID") {
              dotColor = "bg-emerald-500 border-emerald-600 text-white";
              statusText = "Soldé ✓";
            } else if (p?.status === "PARTIAL") {
              dotColor = "bg-purple-500 border-purple-600 text-white";
              statusText = `Avance (${p.amount} DT)`;
            } else if (isFuture) {
              dotColor = "bg-slate-100 border-slate-200 text-slate-400";
              statusText = "Futur";
            } else {
              dotColor = "bg-rose-100 border-rose-300 text-rose-700";
              statusText = "À régler";
            }

            return (
              <button
                key={`${month}-${year}`}
                type="button"
                onClick={() => {
                  if (onSelectMonth) onSelectMonth(month, year);
                }}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-indigo-500 bg-indigo-50/60 shadow-xs"
                    : "hover:bg-slate-100/80"
                }`}
                title={`${label} : ${statusText}`}
              >
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold border ${dotColor}`}>
                  {p?.status === "PAID" ? "✓" : p?.status === "PARTIAL" ? "½" : "•"}
                </div>
                <span className="text-[10px] font-bold text-slate-600">{MONTH_NAMES[month - 1]}</span>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 mt-3.5 pt-3 border-t border-slate-100 text-[11px] text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Soldé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Avance versée</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>À régler</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span>Futur</span>
          </div>
        </div>
      </div>
    </div>
  );
}
