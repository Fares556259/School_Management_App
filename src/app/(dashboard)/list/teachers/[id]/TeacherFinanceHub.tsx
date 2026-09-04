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
  Scissors,
  FileText
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

  const formatDate = (dateStr?: Date | string | null) => {
    if (!dateStr) return "Date non renseignée";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Date non renseignée";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* 1. TOP FINANCIAL KPIS (4 BALANCED CARDS FULL WIDTH) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Versé */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">
              Total Versé
            </span>
            <span className="text-2xl font-black text-emerald-950 block mt-1">
              {fmt(totalPaid)}
            </span>
            <span className="text-xs text-emerald-600 font-medium block mt-0.5">
              {paidMonthsCount} {paidMonthsCount > 1 ? "mois réglés" : "mois réglé"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={24} />
          </div>
        </div>

        {/* Avances Versées */}
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 block">
              Avances
            </span>
            <span className="text-2xl font-black text-purple-950 block mt-1">
              {fmt(totalAdvances)}
            </span>
            <span className="text-xs text-purple-600 font-medium block mt-0.5">
              {totalAdvances > 0 ? "Avances en cours" : "Aucune avance"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Déductions / Retenues */}
        <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Déductions
            </span>
            <span className="text-2xl font-black text-amber-950 block mt-1">
              {fmt(totalDeductions)}
            </span>
            <span className="text-xs text-amber-600 font-medium block mt-0.5">
              {totalDeductions > 0 ? "Retenues d'absence" : "Aucune retenue"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <Scissors size={24} />
          </div>
        </div>

        {/* Reste Dû */}
        <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between hover:shadow-md transition-shadow ${
          outstandingBalance > 0 
            ? "bg-rose-50/50 border-rose-200" 
            : "bg-white border-slate-100"
        }`}>
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${
              outstandingBalance > 0 ? "text-rose-700" : "text-slate-500"
            }`}>
              Reste Dû
            </span>
            <span className={`text-2xl font-black block mt-1 ${
              outstandingBalance > 0 ? "text-rose-950" : "text-slate-800"
            }`}>
              {outstandingBalance > 0 ? fmt(outstandingBalance) : "0 DT"}
            </span>
            <span className={`text-xs font-semibold block mt-0.5 ${
              outstandingBalance > 0 ? "text-rose-600" : "text-emerald-600"
            }`}>
              {outstandingBalance > 0 ? "Paiement en attente" : "✓ Tout est réglé"}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            outstandingBalance > 0 
              ? "bg-rose-100/60 border-rose-300 text-rose-600" 
              : "bg-slate-50 border-slate-200 text-slate-400"
          }`}>
            <AlertCircle size={24} />
          </div>
        </div>
      </div>

      {/* 2. DUAL BALANCED WORKSTATION: TIMELINE & ACTION (7 cols) + HISTORY & BREAKDOWN (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT WORKSTATION (7 OF 12 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {/* ANNUAL 10-MONTH TIMELINE */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-indigo-600" />
                  <span>Suivi Annuel des Salaires</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Année académique {academicStartYear}/{academicEndYear} · {paidMonthsCount}/10 mois réglés
                </p>
              </div>
              <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Salaire Mensuel</span>
                <span className="text-xs font-black text-slate-800">{fmt(salary)}</span>
              </div>
            </div>

            {/* 10 Month Interactive Pills */}
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {academicMonths.map((m) => {
                const isSelected = m.month === selectedMonth && m.year === selectedYear;
                
                let bgClass = "bg-slate-100 text-slate-600 hover:bg-slate-200";
                let badgeText = "";

                if (m.status === "PAID") {
                  bgClass = "bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs";
                  badgeText = "✓";
                } else if (m.status === "PARTIAL") {
                  bgClass = "bg-purple-500 text-white hover:bg-purple-600";
                  badgeText = "½";
                } else if (m.status === "OVERDUE") {
                  bgClass = "bg-rose-500 text-white hover:bg-rose-600";
                  badgeText = "!";
                } else {
                  bgClass = "bg-slate-50 text-slate-400 border border-slate-200/60 hover:bg-slate-100";
                }

                return (
                  <button
                    key={`${m.month}-${m.year}`}
                    onClick={() => {
                      setSelectedMonth(m.month);
                      setSelectedYear(m.year);
                    }}
                    className={`py-2 px-1 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-1 relative ${
                      isSelected ? "ring-2 ring-indigo-500 ring-offset-2 scale-105 z-10" : ""
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
                    <span className="text-xs font-bold leading-none block">
                      {m.label}
                    </span>
                    {badgeText && (
                      <span className="text-[9px] font-black leading-none block opacity-95">
                        {badgeText}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-between flex-wrap gap-3 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-medium">Payé</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <span className="font-medium">Avance</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="font-medium">En retard</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-200 border border-slate-300" />
                <span className="font-medium">À venir</span>
              </div>
            </div>
          </div>

          {/* INTERACTIVE MONTH CONTROLLER */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/60">
              <button
                onClick={handlePrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                title="Mois précédent"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="text-center">
                <span className="text-sm font-black text-slate-800 block">
                  {selectedFullLabel}
                </span>
                <span className="text-[11px] text-slate-400 block font-medium">
                  Créneau de paie sélectionné
                </span>
              </div>
              <button
                onClick={handleNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors border border-transparent hover:border-slate-200 shadow-2xs"
                title="Mois suivant"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* Status info strip */}
            <div className="flex items-center justify-between px-2 text-xs">
              <span className="text-slate-500 font-medium">Statut pour {selectedMonthName} :</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                isSelectedPaid 
                  ? "bg-emerald-100 text-emerald-800" 
                  : isSelectedPartial 
                  ? "bg-purple-100 text-purple-800" 
                  : "bg-rose-100 text-rose-800"
              }`}>
                {isSelectedPaid ? "PAYÉ" : isSelectedPartial ? "AVANCE VERSÉE" : "NON RÉGLÉ"}
              </span>
            </div>

            {/* Action Box */}
            {isSelectedPaid ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-800">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold block">
                      Salaire réglé pour {selectedMonthName}
                    </span>
                    <span className="text-[11px] text-emerald-600 block">
                      Montant versé : {fmt(currentSelectedPayment?.amount || salary)}
                      {currentSelectedPayment?.paidAt ? ` le ${formatDate(currentSelectedPayment.paidAt)}` : ""}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-extrabold px-2.5 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-700">
                  {fmt(currentSelectedPayment?.amount || salary)}
                </span>
              </div>
            ) : isAdmin ? (
              <button
                onClick={handlePaySalary}
                disabled={isPending}
                className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Banknote size={16} />
                <span>
                  {isPending
                    ? "Traitement en cours..."
                    : isSelectedPartial
                    ? `Compléter le salaire (${fmt(Math.max(0, salary - (currentSelectedPayment?.amount || 0)))}) pour ${selectedMonthName}`
                    : `Régler le salaire de ${fmt(salary)} pour ${selectedMonthName}`}
                </span>
              </button>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center text-xs text-slate-400 italic">
                En attente d&apos;exécution par l&apos;administrateur.
              </div>
            )}
          </div>
        </div>

        {/* RIGHT WORKSTATION (5 OF 12 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* PAYMENT HISTORY */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-slate-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Historique des Versements
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {payments.length} versement{payments.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[320px] overflow-y-auto pr-1">
              {payments.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs italic">
                  Aucun versement enregistré pour cette année scolaire.
                </div>
              ) : (
                [...payments]
                  .sort((a, b) => b.year - a.year || b.month - a.month)
                  .map((p) => {
                    const pMonthName = MONTHS[p.month - 1] || `Mois ${p.month}`;
                    const hasDeduction = p.missedHours && p.missedHours > 0;
                    return (
                      <div 
                        key={p.id}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {pMonthName} {p.year}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {formatDate(p.paidAt)}
                            {hasDeduction && (
                              <span className="text-amber-600 font-semibold ml-1.5">
                                (-{p.missedHours}h absence)
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
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.status === "PAID" ? "bg-emerald-100 text-emerald-800" :
                            p.status === "PARTIAL" ? "bg-purple-100 text-purple-800" : "bg-rose-100 text-rose-800"
                          }`}>
                            {p.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* CONTRACTUAL META CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
              <FileText size={16} className="text-slate-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Paramètres de Paie
              </h4>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Salaire mensuel de base :</span>
                <span className="font-bold text-slate-800">{fmt(salary)}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Taux de retenue horaire :</span>
                <span className="font-bold text-slate-800">{hourlyRate ? `${hourlyRate} DT / h` : "15 DT / h"}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Volume mensuel théorique :</span>
                <span className="font-bold text-slate-800">{hoursPerMonth ? `${hoursPerMonth}h / mois` : "40h / mois"}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Période académique :</span>
                <span className="font-semibold text-slate-700">{academicStartYear} - {academicEndYear}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
