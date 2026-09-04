"use client";

import { useState, useTransition } from "react";
import { 
  Wallet, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  CreditCard,
  Banknote,
  Calendar,
  Sparkles,
  Scissors
} from "lucide-react";
import { payTeacherSalary } from "../actions";
import { MONTHS } from "@/lib/dateUtils";

interface PaymentRecord {
  id: number;
  month: number; // 1-based (Jan=1, Dec=12)
  year: number;
  amount: number;
  status: string; // "PAID" | "PARTIAL" | "OVERDUE" | "PENDING"
  paidAt?: Date | string | null;
  deferredAmount?: number | null;
  missedHours?: number | null;
}

interface TeacherFinanceHubProps {
  teacherId: string;
  teacherName: string;
  salary: number;
  hourlyRate?: number | null;
  hoursPerMonth?: number | null;
  payments: PaymentRecord[];
  isAdmin: boolean;
}

const ACADEMIC_MONTHS_CONFIG = [
  { month: 9, labelFr: "Sep", fullFr: "Septembre", offsetYear: 0 },
  { month: 10, labelFr: "Oct", fullFr: "Octobre", offsetYear: 0 },
  { month: 11, labelFr: "Nov", fullFr: "Novembre", offsetYear: 0 },
  { month: 12, labelFr: "Déc", fullFr: "Décembre", offsetYear: 0 },
  { month: 1, labelFr: "Jan", fullFr: "Janvier", offsetYear: 1 },
  { month: 2, labelFr: "Fév", fullFr: "Février", offsetYear: 1 },
  { month: 3, labelFr: "Mar", fullFr: "Mars", offsetYear: 1 },
  { month: 4, labelFr: "Avr", fullFr: "Avril", offsetYear: 1 },
  { month: 5, labelFr: "Mai", fullFr: "Mai", offsetYear: 1 },
  { month: 6, labelFr: "Juin", fullFr: "Juin", offsetYear: 1 },
];

export default function TeacherFinanceHub({
  teacherId,
  teacherName,
  salary,
  hourlyRate,
  hoursPerMonth,
  payments: initialPayments,
  isAdmin,
}: TeacherFinanceHubProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const currentMonthIdx = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  // Academic year start year: If Sep-Dec (>=9), start is this year. If Jan-Aug (<9), start was last year.
  const academicStartYear = currentMonthIdx >= 9 ? currentYear : currentYear - 1;
  const academicEndYear = academicStartYear + 1;

  // Selected month for interactive controller (default to current month)
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonthIdx);
  const [selectedYear, setSelectedYear] = useState<number>(
    currentMonthIdx >= 9 ? academicStartYear : academicEndYear
  );

  // Quick lookup map: key is `${month}-${year}`
  const paymentMap = new Map<string, PaymentRecord>();
  payments.forEach((p) => {
    paymentMap.set(`${p.month}-${p.year}`, p);
  });

  // Calculate 10 Academic Months with live status
  const academicMonths = ACADEMIC_MONTHS_CONFIG.map((cfg) => {
    const y = academicStartYear + cfg.offsetYear;
    const m = cfg.month;
    const p = paymentMap.get(`${m}-${y}`);

    const isElapsed = y < currentYear || (y === currentYear && m <= currentMonthIdx);
    const isCurrent = y === currentYear && m === currentMonthIdx;

    let status: "PAID" | "PARTIAL" | "OVERDUE" | "PENDING" = "PENDING";
    if (p?.status === "PAID") {
      status = "PAID";
    } else if (p?.status === "PARTIAL") {
      status = "PARTIAL";
    } else if (p?.status === "OVERDUE" || (isElapsed && !p)) {
      status = isCurrent ? "PENDING" : "OVERDUE";
    }

    return {
      month: m,
      year: y,
      label: cfg.labelFr,
      fullLabel: `${cfg.fullFr} ${y}`,
      payment: p,
      status,
      isElapsed,
      isCurrent,
    };
  });

  // EXACT CALCULATIONS
  // 1. Total Paid: Sum of ALL payments recorded for this academic year
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // 2. Total Advances: Sum of active partial amounts
  const totalAdvances = payments
    .filter((p) => p.status === "PARTIAL")
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // 3. Deductions: Missed hours deductions applied
  const totalDeductions = payments.reduce((sum, p) => {
    if (p.missedHours && p.missedHours > 0) {
      const rate = hourlyRate || 15;
      return sum + p.missedHours * rate;
    }
    // Also check if salary > amount on a PAID record
    if (p.status === "PAID" && salary > p.amount) {
      return sum + (salary - p.amount);
    }
    return sum;
  }, 0);

  // 4. Outstanding Balance: Sum of unpaid amounts for elapsed months only
  const outstandingBalance = academicMonths
    .filter((m) => m.isElapsed)
    .reduce((sum, m) => {
      if (m.status === "PAID") return sum;
      if (m.status === "PARTIAL" && m.payment) {
        return sum + (m.payment.deferredAmount ?? Math.max(0, salary - m.payment.amount));
      }
      return sum + salary;
    }, 0);

  const paidMonthsCount = academicMonths.filter((m) => m.status === "PAID").length;

  // Selected Month status in controller
  const selectedKey = `${selectedMonth}-${selectedYear}`;
  const currentSelectedPayment = paymentMap.get(selectedKey);
  const selectedMonthName = MONTHS[selectedMonth - 1] || "Mois";
  const selectedFullLabel = `${selectedMonthName} ${selectedYear}`;

  const isSelectedPaid = currentSelectedPayment?.status === "PAID";
  const isSelectedPartial = currentSelectedPayment?.status === "PARTIAL";

  // Navigation handlers
  const handlePrevMonth = () => {
    const currentIndex = ACADEMIC_MONTHS_CONFIG.findIndex((m) => m.month === selectedMonth);
    if (currentIndex > 0) {
      const prev = ACADEMIC_MONTHS_CONFIG[currentIndex - 1];
      setSelectedMonth(prev.month);
      setSelectedYear(academicStartYear + prev.offsetYear);
    }
  };

  const handleNextMonth = () => {
    const currentIndex = ACADEMIC_MONTHS_CONFIG.findIndex((m) => m.month === selectedMonth);
    if (currentIndex < ACADEMIC_MONTHS_CONFIG.length - 1) {
      const next = ACADEMIC_MONTHS_CONFIG[currentIndex + 1];
      setSelectedMonth(next.month);
      setSelectedYear(academicStartYear + next.offsetYear);
    }
  };

  // Payment trigger
  const handlePaySalary = () => {
    if (!isAdmin || isPending || isSelectedPaid) return;
    startTransition(async () => {
      const result = await payTeacherSalary(teacherId, teacherName, salary, selectedFullLabel);
      if (result.success) {
        const newRecord: PaymentRecord = {
          id: currentSelectedPayment?.id || Date.now(),
          month: selectedMonth,
          year: selectedYear,
          amount: salary,
          status: "PAID",
          paidAt: new Date(),
          missedHours: 0,
        };
        setPayments((prev) => {
          const filtered = prev.filter((p) => !(p.month === selectedMonth && p.year === selectedYear));
          return [newRecord, ...filtered];
        });
      } else {
        alert(result.error || "Une erreur est survenue lors de l'enregistrement du paiement.");
      }
    });
  };

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm flex flex-col gap-5">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Wallet size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 leading-tight">
              Rémunération & Salaires
            </h2>
            <p className="text-[11px] text-slate-400 font-medium">
              Année scolaire {academicStartYear}/{academicEndYear}
            </p>
          </div>
        </div>

        {/* Base salary badge */}
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Salaire de base
          </span>
          <span className="text-sm font-black text-slate-800">
            {fmt(salary)}
          </span>
        </div>
      </div>

      {/* 2. EXACT KPI STATS GRID */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Total Versé */}
        <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              Total Versé
            </span>
            <CheckCircle2 size={13} className="text-emerald-600" />
          </div>
          <p className="text-lg font-black text-emerald-900 leading-tight">
            {fmt(totalPaid)}
          </p>
          <span className="text-[10px] text-emerald-600 font-medium mt-1">
            {paidMonthsCount} {paidMonthsCount > 1 ? "mois réglés" : "mois réglé"}
          </span>
        </div>

        {/* Avances Versées */}
        <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">
              Avances
            </span>
            <TrendingUp size={13} className="text-purple-600" />
          </div>
          <p className="text-lg font-black text-purple-900 leading-tight">
            {fmt(totalAdvances)}
          </p>
          <span className="text-[10px] text-purple-600 font-medium mt-1">
            {totalAdvances > 0 ? "Avances en cours" : "Aucune avance"}
          </span>
        </div>

        {/* Déductions / Absences */}
        <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
              Déductions
            </span>
            <Scissors size={13} className="text-amber-600" />
          </div>
          <p className="text-lg font-black text-amber-900 leading-tight">
            {fmt(totalDeductions)}
          </p>
          <span className="text-[10px] text-amber-600 font-medium mt-1">
            {totalDeductions > 0 ? "Absences déduites" : "Aucune retenue"}
          </span>
        </div>

        {/* Solde Restant Dû */}
        <div className={`p-3 rounded-xl border flex flex-col justify-between ${
          outstandingBalance > 0 
            ? "bg-rose-50 border-rose-200" 
            : "bg-slate-50 border-slate-100"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${
              outstandingBalance > 0 ? "text-rose-700" : "text-slate-500"
            }`}>
              Reste Dû
            </span>
            <AlertCircle size={13} className={outstandingBalance > 0 ? "text-rose-600" : "text-slate-400"} />
          </div>
          <p className={`text-lg font-black leading-tight ${
            outstandingBalance > 0 ? "text-rose-900" : "text-slate-700"
          }`}>
            {outstandingBalance > 0 ? fmt(outstandingBalance) : "0 DT"}
          </p>
          <span className={`text-[10px] font-semibold mt-1 ${
            outstandingBalance > 0 ? "text-rose-600" : "text-emerald-600"
          }`}>
            {outstandingBalance > 0 ? "Paiement en attente" : "✓ Tout est réglé"}
          </span>
        </div>
      </div>

      {/* 3. ANNUAL 10-MONTH TIMELINE (Sep -> Juin) */}
      <div className="bg-slate-50/60 p-3.5 rounded-xl border border-slate-100">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            Suivi Annuel (10 Mois)
          </span>
          <span className="text-[10px] font-semibold text-slate-400">
            {paidMonthsCount}/10 Réglés
          </span>
        </div>

        {/* Month Pills Strip */}
        <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
          {academicMonths.map((m) => {
            const isSelected = m.month === selectedMonth && m.year === selectedYear;
            
            let bgClass = "bg-slate-200 text-slate-600 hover:bg-slate-300";
            let iconText = "";

            if (m.status === "PAID") {
              bgClass = "bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs";
              iconText = "✓";
            } else if (m.status === "PARTIAL") {
              bgClass = "bg-purple-500 text-white hover:bg-purple-600";
              iconText = "½";
            } else if (m.status === "OVERDUE") {
              bgClass = "bg-rose-500 text-white hover:bg-rose-600";
              iconText = "!";
            } else {
              bgClass = "bg-slate-100 text-slate-400 hover:bg-slate-200";
            }

            return (
              <button
                key={`${m.month}-${m.year}`}
                onClick={() => {
                  setSelectedMonth(m.month);
                  setSelectedYear(m.year);
                }}
                className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center gap-0.5 relative ${
                  isSelected ? "ring-2 ring-indigo-500 ring-offset-1 scale-105 z-10" : ""
                } ${bgClass}`}
                title={`${m.fullLabel}: ${
                  m.status === "PAID" 
                    ? `Payé (${fmt(m.payment?.amount || salary)})` 
                    : m.status === "PARTIAL" 
                    ? `Avance (${fmt(m.payment?.amount || 0)})` 
                    : m.status === "OVERDUE" 
                    ? "En retard" 
                    : "À venir"
                }`}
              >
                <span className="text-[10px] font-bold leading-none block">
                  {m.label}
                </span>
                {iconText && (
                  <span className="text-[8px] font-black leading-none block opacity-90">
                    {iconText}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Status Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 mt-3 pt-2.5 border-t border-slate-200/60 text-[10px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Payé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Avance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>En retard</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-200" />
            <span>À venir</span>
          </div>
        </div>
      </div>

      {/* 4. INTERACTIVE MONTH ACTION BAR */}
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-3">
        {/* Month selector switcher */}
        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-200/60">
          <button
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
            title="Mois précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <span className="text-xs font-bold text-slate-800 block">
              {selectedFullLabel}
            </span>
            <span className="text-[10px] text-slate-400 block font-medium">
              Créneau de paie sélectionné
            </span>
          </div>
          <button
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
            title="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Selected Month Status Details */}
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-slate-500 font-medium">Statut du mois :</span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
            isSelectedPaid 
              ? "bg-emerald-100 text-emerald-700" 
              : isSelectedPartial 
              ? "bg-purple-100 text-purple-700" 
              : "bg-rose-100 text-rose-700"
          }`}>
            {isSelectedPaid ? "PAYÉ" : isSelectedPartial ? "AVANCE" : "NON RÉGLÉ"}
          </span>
        </div>

        {/* Action Button: Pay or Settled */}
        {isSelectedPaid ? (
          <div className="w-full py-2.5 px-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700">
            <CheckCircle2 size={14} />
            <span>
              Salaire réglé ({fmt(currentSelectedPayment?.amount || salary)})
              {currentSelectedPayment?.paidAt ? ` le ${new Date(currentSelectedPayment.paidAt).toLocaleDateString("fr-FR")}` : ""}
            </span>
          </div>
        ) : isAdmin ? (
          <button
            onClick={handlePaySalary}
            disabled={isPending}
            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Banknote size={15} />
            <span>
              {isPending
                ? "Traitement en cours..."
                : isSelectedPartial
                ? `Compléter le salaire pour ${selectedMonthName}`
                : `Régler ${fmt(salary)} pour ${selectedMonthName}`}
            </span>
          </button>
        ) : (
          <div className="w-full py-2 text-center text-xs text-slate-400 italic">
            Paiement en attente de validation par l&apos;administration.
          </div>
        )}
      </div>

      {/* 5. PAYMENT HISTORY */}
      {payments.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 flex items-center justify-between">
            <span>Historique des paiements</span>
            <span className="text-[10px] text-slate-400 font-medium lowercase">
              {payments.length} versement{payments.length > 1 ? "s" : ""}
            </span>
          </h3>

          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {[...payments]
              .sort((a, b) => b.year - a.year || b.month - a.month)
              .map((p) => {
                const pMonthName = MONTHS[p.month - 1] || `Mois ${p.month}`;
                const hasDeduction = p.missedHours && p.missedHours > 0;
                return (
                  <div 
                    key={p.id}
                    className="p-2.5 rounded-lg bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        {pMonthName} {p.year}
                      </span>
                      <span className="text-[10px] text-slate-400 block">
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString("fr-FR") : "Date non renseignée"}
                        {hasDeduction && (
                          <span className="text-amber-600 font-semibold ml-1.5">
                            (-{p.missedHours}h retenue)
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className={`text-xs font-black ${
                        p.status === "PAID" ? "text-emerald-700" :
                        p.status === "PARTIAL" ? "text-purple-700" : "text-rose-600"
                      }`}>
                        {fmt(p.amount)}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        p.status === "PAID" ? "bg-emerald-100 text-emerald-700" :
                        p.status === "PARTIAL" ? "bg-purple-100 text-purple-700" : "bg-rose-100 text-rose-700"
                      }`}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
