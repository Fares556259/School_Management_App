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
  FileText,
  X,
  Plus,
  RotateCcw
} from "lucide-react";
import { payTeacherSalary, updateMissedHours } from "../actions";
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

interface ExpenseRecord {
  id: number;
  title: string;
  amount: number;
  date: Date | string;
  category: string;
  referenceType?: string | null;
  referenceId?: string | null;
}

interface TeacherFinanceHubProps {
  teacherId: string;
  teacherName: string;
  salary: number;
  hourlyRate?: number | null;
  hoursPerMonth?: number | null;
  payments: PaymentRecord[];
  expenses?: ExpenseRecord[];
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
  expenses: initialExpenses = [],
  isAdmin,
}: TeacherFinanceHubProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [expensesList, setExpensesList] = useState<ExpenseRecord[]>(initialExpenses);
  const [isPending, startTransition] = useTransition();

  // Admin Modals
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [absenceHoursInput, setAbsenceHoursInput] = useState<string>("");

  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [advanceAmountInput, setAdvanceAmountInput] = useState<string>("");

  const now = new Date();
  const currentMonthIdx = now.getMonth() + 1; // 1-based
  const currentYear = now.getFullYear();

  // Academic year start year: If Sep-Dec (>=9), start is this year. If Jan-Aug (<9), start was last year.
  const academicStartYear = currentMonthIdx >= 9 ? currentYear : currentYear - 1;
  const academicEndYear = academicStartYear + 1;

  // Selected month for interactive controller (default to current month or Sep)
  const [selectedMonth, setSelectedMonth] = useState<number>(
    currentMonthIdx >= 9 || currentMonthIdx <= 6 ? currentMonthIdx : 9
  );
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

  // Rates & Base Salary
  const effectiveHourlyRate = hourlyRate && hourlyRate > 0 ? hourlyRate : 15;
  const baseMonthlySalary = salary;

  // Selected Month details
  const selectedKey = `${selectedMonth}-${selectedYear}`;
  const currentSelectedPayment = paymentMap.get(selectedKey);
  const selectedMonthName = MONTHS[selectedMonth - 1] || "Mois";
  const selectedFullLabel = `${selectedMonthName} ${selectedYear}`;
  const frMonthConfig = ACADEMIC_MONTHS_CONFIG.find((c) => c.month === selectedMonth);
  const frMonthName = frMonthConfig?.fullFr || selectedMonthName;
  const selectedDisplayLabel = `${frMonthName} ${selectedYear}`;

  const isSelectedPaid = currentSelectedPayment?.status === "PAID";
  const isSelectedPartial = currentSelectedPayment?.status === "PARTIAL";

  // Deduction & Missed Hours for Selected Month
  let selectedMissedHours = 0;
  if (currentSelectedPayment?.missedHours && currentSelectedPayment.missedHours > 0) {
    selectedMissedHours = currentSelectedPayment.missedHours;
  } else if (isSelectedPaid && baseMonthlySalary > currentSelectedPayment.amount) {
    selectedMissedHours = Math.round((baseMonthlySalary - currentSelectedPayment.amount) / effectiveHourlyRate);
  }
  const selectedDeductionAmount = selectedMissedHours * effectiveHourlyRate;

  // Advance for Selected Month (from linked expenses or partial payment)
  const linkedAdvanceExpenses = expensesList.filter(
    (e) =>
      currentSelectedPayment?.id &&
      String(e.referenceId) === String(currentSelectedPayment.id) &&
      (e.category === "Advance" ||
        e.title?.toLowerCase().includes("advance") ||
        e.title?.toLowerCase().includes("avance"))
  );
  const expenseAdvanceTotal = linkedAdvanceExpenses.reduce(
    (sum, e) => sum + (e.amount || 0),
    0
  );
  const selectedAdvanceAmount = isSelectedPartial
    ? currentSelectedPayment.amount
    : expenseAdvanceTotal > 0
    ? expenseAdvanceTotal
    : 0;

  const advanceDate =
    linkedAdvanceExpenses[0]?.date ||
    (isSelectedPartial ? currentSelectedPayment?.paidAt : null);

  // Net amounts for Selected Month
  const selectedRemainingToPay = Math.max(
    0,
    baseMonthlySalary - selectedDeductionAmount - selectedAdvanceAmount
  );

  // EXACT CALCULATIONS
  // 1. Total Paid: Sum of ALL payments recorded for this academic year
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  // 2. Total Advances: Sum of active partial amounts + linked advance expenses
  const advanceExpenseRefIds = new Set<string>();
  let totalAdvancesFromExpenses = 0;
  expensesList.forEach((e) => {
    if (
      e.category === "Advance" ||
      e.title?.toLowerCase().includes("advance") ||
      e.title?.toLowerCase().includes("avance")
    ) {
      totalAdvancesFromExpenses += e.amount || 0;
      if (e.referenceId) advanceExpenseRefIds.add(String(e.referenceId));
    }
  });
  const totalAdvancesFromPayments = payments
    .filter((p) => p.status === "PARTIAL" && !advanceExpenseRefIds.has(String(p.id)))
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalAdvances = totalAdvancesFromExpenses + totalAdvancesFromPayments;

  // 3. Deductions: Missed hours deductions applied
  const totalDeductions = payments.reduce((sum, p) => {
    if (p.missedHours && p.missedHours > 0) {
      return sum + p.missedHours * effectiveHourlyRate;
    }
    if (p.status === "PAID" && baseMonthlySalary > p.amount) {
      return sum + (baseMonthlySalary - p.amount);
    }
    return sum;
  }, 0);

  // 4. Outstanding Balance: Sum of unpaid amounts for elapsed months only
  const outstandingBalance = academicMonths
    .filter((m) => m.isElapsed)
    .reduce((sum, m) => {
      if (m.status === "PAID") return sum;
      if (m.status === "PARTIAL" && m.payment) {
        return sum + (m.payment.deferredAmount ?? Math.max(0, baseMonthlySalary - m.payment.amount));
      }
      return sum + baseMonthlySalary;
    }, 0);

  const paidMonthsCount = academicMonths.filter((m) => m.status === "PAID").length;

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

  // Payment triggers
  const handlePayNetSalary = (amountToPay: number, missedHrs: number, dedAmount: number) => {
    if (!isAdmin || isPending || isSelectedPaid) return;
    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedFullLabel,
        missedHrs,
        dedAmount,
        false
      );
      if (result.success) {
        const newRecord: PaymentRecord = {
          id: currentSelectedPayment?.id || Date.now(),
          month: selectedMonth,
          year: selectedYear,
          amount: amountToPay,
          status: "PAID",
          paidAt: new Date(),
          missedHours: missedHrs,
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

  const handleSettleRemaining = (remainingAmount: number, missedHrs: number, dedAmount: number) => {
    if (!isAdmin || isPending || isSelectedPaid) return;
    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        remainingAmount,
        selectedFullLabel,
        missedHrs,
        dedAmount,
        false
      );
      if (result.success) {
        const newRecord: PaymentRecord = {
          id: currentSelectedPayment?.id || Date.now(),
          month: selectedMonth,
          year: selectedYear,
          amount: (currentSelectedPayment?.amount || 0) + remainingAmount,
          status: "PAID",
          paidAt: new Date(),
          missedHours: missedHrs,
        };
        setPayments((prev) => {
          const filtered = prev.filter((p) => !(p.month === selectedMonth && p.year === selectedYear));
          return [newRecord, ...filtered];
        });
      } else {
        alert(result.error || "Une erreur est survenue lors du règlement du solde.");
      }
    });
  };

  const handleGiveAdvance = () => {
    const advAmount = Number(advanceAmountInput);
    if (!isAdmin || isPending || isSelectedPaid || advAmount <= 0) return;
    if (advAmount > selectedRemainingToPay) {
      alert(`Le montant de l'avance ne peut pas dépasser le reste à payer (${fmt(selectedRemainingToPay)}).`);
      return;
    }

    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        advAmount,
        selectedFullLabel,
        undefined,
        undefined,
        true
      );
      if (result.success) {
        const targetId = currentSelectedPayment?.id || Date.now();
        const newRecord: PaymentRecord = {
          id: targetId,
          month: selectedMonth,
          year: selectedYear,
          amount: (currentSelectedPayment?.amount || 0) + advAmount,
          status: "PARTIAL",
          paidAt: new Date(),
          missedHours: selectedMissedHours,
        };
        setPayments((prev) => {
          const filtered = prev.filter((p) => !(p.month === selectedMonth && p.year === selectedYear));
          return [newRecord, ...filtered];
        });
        setExpensesList((prev) => [
          {
            id: Date.now(),
            title: `Advance: ${teacherName} (${selectedFullLabel})`,
            amount: advAmount,
            date: new Date(),
            category: "Advance",
            referenceType: "TeacherSalary",
            referenceId: String(targetId),
          },
          ...prev,
        ]);
        setIsAdvanceModalOpen(false);
        setAdvanceAmountInput("");
      } else {
        alert(result.error || "Une erreur est survenue lors du versement de l'avance.");
      }
    });
  };

  const handleSaveMissedHours = (hours: number) => {
    if (!isAdmin || isPending || hours < 0) return;
    startTransition(async () => {
      const result = await updateMissedHours(teacherId, selectedFullLabel, hours);
      if (result.success) {
        setPayments((prev) => {
          const existing = prev.find((p) => p.month === selectedMonth && p.year === selectedYear);
          if (existing) {
            return prev.map((p) =>
              p.month === selectedMonth && p.year === selectedYear
                ? { ...p, missedHours: hours }
                : p
            );
          } else {
            const newRecord: PaymentRecord = {
              id: Date.now(),
              month: selectedMonth,
              year: selectedYear,
              amount: 0,
              status: "PENDING",
              missedHours: hours,
              paidAt: null,
            };
            return [newRecord, ...prev];
          }
        });
        setIsAbsenceModalOpen(false);
        setAbsenceHoursInput("");
      } else {
        alert(result.error || "Une erreur est survenue lors de l'enregistrement des heures manquées.");
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

        {/* Avances Versées (YELLOW / AMBER THEME) */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
              Avances
            </span>
            <span className="text-2xl font-black text-amber-950 block mt-1">
              {fmt(totalAdvances)}
            </span>
            <span className="text-xs text-amber-600 font-medium block mt-0.5">
              {totalAdvances > 0 ? "Avances sur salaires" : "Aucune avance"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <TrendingUp size={24} />
          </div>
        </div>

        {/* Déductions / Retenues (ROSE / RED THEME) */}
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-xs flex items-center justify-between hover:shadow-md transition-shadow">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 block">
              Déductions
            </span>
            <span className="text-2xl font-black text-rose-950 block mt-1">
              {fmt(totalDeductions)}
            </span>
            <span className="text-xs text-rose-600 font-medium block mt-0.5">
              {totalDeductions > 0 ? "Retenues d'absence" : "Aucune retenue"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
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

      {/* 2. DUAL BALANCED WORKSTATION: TIMELINE & ACTION (7 cols) + HISTORY & METRIC (5 cols) */}
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
                  bgClass = "bg-amber-500 text-white hover:bg-amber-600 shadow-xs";
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

            {/* Legend (Avance in Yellow/Amber) */}
            <div className="flex items-center justify-between flex-wrap gap-3 mt-5 pt-4 border-t border-slate-100 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-medium">Payé</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
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

          {/* INTERACTIVE MONTH CONTROLLER & DETAILED FINANCIAL BREAKDOWN CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
            {/* Month Carousel Selector */}
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
                  {selectedDisplayLabel}
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

            {/* Status info strip & Admin quick actions */}
            <div className="flex items-center justify-between px-1 text-xs gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Statut pour {frMonthName} :</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isSelectedPaid 
                    ? "bg-emerald-100 text-emerald-800 border-emerald-200" 
                    : isSelectedPartial 
                    ? "bg-amber-100 text-amber-800 border-amber-200" 
                    : "bg-rose-100 text-rose-800 border-rose-200"
                }`}>
                  {isSelectedPaid ? "PAYÉ" : isSelectedPartial ? "AVANCE VERSÉE" : "NON RÉGLÉ"}
                </span>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setAbsenceHoursInput(selectedMissedHours > 0 ? String(selectedMissedHours) : "");
                      setIsAbsenceModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-indigo-300 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                    title="Ajuster les heures d'absence ou séances non dispensées"
                  >
                    <Scissors size={13} className="text-rose-500" />
                    <span>Ajuster absence</span>
                  </button>
                  {!isSelectedPaid && (
                    <button
                      onClick={() => {
                        setAdvanceAmountInput("");
                        setIsAdvanceModalOpen(true);
                      }}
                      className="px-2.5 py-1 rounded-lg border border-amber-200 hover:border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Verser une avance sur salaire"
                    >
                      <TrendingUp size={13} className="text-amber-600" />
                      <span>Avance</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Contractual Base Salary Row */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-200/70 rounded-xl text-xs">
              <span className="font-semibold text-slate-600">Salaire mensuel de base contractuel :</span>
              <span className="font-black text-slate-900 text-sm">{fmt(baseMonthlySalary)}</span>
            </div>

            {/* RED BLOCK: MISSED SESSIONS / ABSENCE DEDUCTION */}
            {selectedMissedHours > 0 && (
              <div className="p-4 bg-rose-50 border border-rose-200/90 rounded-xl flex items-center justify-between gap-3 text-rose-900 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-rose-950 block">
                      Séances manquées / Retenue sur salaire
                    </span>
                    <span className="text-[11px] text-rose-700 font-medium block mt-0.5">
                      En raison d&apos;absence : {selectedMissedHours}h de cours non dispensées ({effectiveHourlyRate} DT/h)
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs sm:text-sm font-black px-2.5 py-1 bg-white rounded-lg border border-rose-300 text-rose-600 shadow-2xs">
                    -{fmt(selectedDeductionAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* YELLOW BLOCK: ADVANCE ON SALARY (AVANCE) */}
            {selectedAdvanceAmount > 0 && (
              <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-xl flex items-center justify-between gap-3 text-amber-950 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                    <Banknote size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-950 block">
                      Avance sur salaire versée
                    </span>
                    <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                      Acompte déduit du solde mensuel{advanceDate ? ` (le ${formatDate(advanceDate)})` : ""}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs sm:text-sm font-black px-2.5 py-1 bg-white rounded-lg border border-amber-300 text-amber-800 shadow-2xs">
                    -{fmt(selectedAdvanceAmount)}
                  </span>
                </div>
              </div>
            )}

            {/* SETTLEMENT / NET PAYMENT SUMMARY BLOCK */}
            {isSelectedPaid ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Salaire net réglé pour {frMonthName}
                    </span>
                    <span className="text-[11px] text-emerald-700 block mt-0.5">
                      Montant versé : {fmt(currentSelectedPayment?.amount || (baseMonthlySalary - selectedDeductionAmount - selectedAdvanceAmount))}
                      {currentSelectedPayment?.paidAt ? ` le ${formatDate(currentSelectedPayment.paidAt)}` : ""}
                    </span>
                    {(selectedDeductionAmount > 0 || selectedAdvanceAmount > 0) && (
                      <span className="text-[10px] text-emerald-800/80 block mt-1 font-semibold">
                        Décomposition : {fmt(baseMonthlySalary)} (base)
                        {selectedDeductionAmount > 0 ? ` − ${fmt(selectedDeductionAmount)} (absence)` : ""}
                        {selectedAdvanceAmount > 0 ? ` − ${fmt(selectedAdvanceAmount)} (avance)` : ""}
                        {" = "}{fmt(currentSelectedPayment?.amount || (baseMonthlySalary - selectedDeductionAmount - selectedAdvanceAmount))} net versé
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block text-xs sm:text-sm font-extrabold px-3 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-700 shadow-2xs">
                    {fmt(currentSelectedPayment?.amount || (baseMonthlySalary - selectedDeductionAmount - selectedAdvanceAmount))}
                  </span>
                </div>
              </div>
            ) : isSelectedPartial ? (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <div>
                    <span className="font-bold block">Solde restant à régler pour {frMonthName} :</span>
                    <span className="text-[11px] text-amber-700 block mt-0.5">
                      {fmt(baseMonthlySalary)} (base) {selectedAdvanceAmount > 0 ? `− ${fmt(selectedAdvanceAmount)} (avance)` : ""} {selectedDeductionAmount > 0 ? `− ${fmt(selectedDeductionAmount)} (absence)` : ""}
                    </span>
                  </div>
                  <span className="text-sm font-black text-amber-800 px-3 py-1 bg-white rounded-lg border border-amber-200 shadow-2xs">
                    {fmt(selectedRemainingToPay)}
                  </span>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleSettleRemaining(selectedRemainingToPay, selectedMissedHours, selectedDeductionAmount)}
                    disabled={isPending}
                    className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Banknote size={16} />
                    <span>
                      {isPending ? "Règlement en cours..." : `Régler le solde restant (${fmt(selectedRemainingToPay)})`}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 block">Solde net calculé à verser :</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      {fmt(baseMonthlySalary)} (base) {selectedDeductionAmount > 0 ? `− ${fmt(selectedDeductionAmount)} (retenue absence)` : ""}
                    </span>
                  </div>
                  <span className="text-sm font-black text-slate-900 px-3 py-1 bg-white rounded-lg border border-slate-200 shadow-2xs">
                    {fmt(selectedRemainingToPay)}
                  </span>
                </div>

                {isAdmin ? (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => handlePayNetSalary(selectedRemainingToPay, selectedMissedHours, selectedDeductionAmount)}
                      disabled={isPending}
                      className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Banknote size={16} />
                      <span>
                        {isPending ? "Traitement..." : `Régler le salaire (${fmt(selectedRemainingToPay)})`}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setAdvanceAmountInput("");
                        setIsAdvanceModalOpen(true);
                      }}
                      disabled={isPending}
                      className="py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <TrendingUp size={15} className="text-amber-600" />
                      <span>Verser avance</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center text-xs text-slate-400 italic">
                    En attente d&apos;exécution par l&apos;administrateur.
                  </div>
                )}
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
                    const monthCfg = ACADEMIC_MONTHS_CONFIG.find((c) => c.month === p.month);
                    const pMonthLabel = monthCfg ? `${monthCfg.fullFr} ${p.year}` : `${MONTHS[p.month - 1] || `Mois ${p.month}`} ${p.year}`;
                    const hasDeduction = p.missedHours && p.missedHours > 0;
                    return (
                      <div 
                        key={p.id}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <span className="text-xs font-bold text-slate-800 block">
                            {pMonthLabel}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {formatDate(p.paidAt)}
                            {hasDeduction && (
                              <span className="text-rose-600 font-semibold ml-1.5">
                                (-{p.missedHours}h absence)
                              </span>
                            )}
                          </span>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span className={`text-xs font-black ${
                            p.status === "PAID" ? "text-emerald-700" :
                            p.status === "PARTIAL" ? "text-amber-700" : "text-rose-600"
                          }`}>
                            {fmt(p.amount)}
                          </span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.status === "PAID" 
                              ? "bg-emerald-100 text-emerald-800" 
                              : p.status === "PARTIAL" 
                              ? "bg-amber-100 text-amber-800 border border-amber-200" 
                              : "bg-rose-100 text-rose-800"
                          }`}>
                            {p.status === "PARTIAL" ? "AVANCE" : p.status}
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
                <span className="font-bold text-slate-800">{effectiveHourlyRate} DT / h</span>
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

      {/* ADMIN MODAL: AJUSTER LES ABSENCES (MISSED HOURS) */}
      {isAbsenceModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setIsAbsenceModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Scissors size={18} className="text-rose-600" />
                  <span>Ajuster les heures d&apos;absence</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {teacherName} · {selectedDisplayLabel}
                </p>
              </div>
              <button 
                onClick={() => setIsAbsenceModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nombre d&apos;heures non dispensées (absence) :
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="ex: 2"
                    value={absenceHoursInput}
                    onChange={(e) => setAbsenceHoursInput(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    heures
                  </span>
                </div>
              </div>

              {/* Real-time deduction preview */}
              {Number(absenceHoursInput) > 0 && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-900">
                  <div>
                    <span className="font-bold block">Impact sur le salaire :</span>
                    <span className="text-[11px] text-rose-700 block mt-0.5">
                      En raison d&apos;absence : {absenceHoursInput}h × {effectiveHourlyRate} DT/h
                    </span>
                  </div>
                  <span className="text-sm font-black text-rose-600 px-2.5 py-1 bg-white rounded-lg border border-rose-300">
                    -{fmt(Number(absenceHoursInput) * effectiveHourlyRate)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                {selectedMissedHours > 0 && (
                  <button
                    type="button"
                    onClick={() => handleSaveMissedHours(0)}
                    disabled={isPending}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={14} />
                    <span>Réinitialiser (0h)</span>
                  </button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsAbsenceModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveMissedHours(Number(absenceHoursInput || 0))}
                    disabled={isPending || absenceHoursInput === ""}
                    className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isPending ? "Enregistrement..." : "Enregistrer la retenue"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN MODAL: VERSER UNE AVANCE SUR SALAIRE */}
      {isAdvanceModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setIsAdvanceModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full relative overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={18} className="text-amber-600" />
                  <span>Verser une avance sur salaire</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {teacherName} · {selectedDisplayLabel}
                </p>
              </div>
              <button 
                onClick={() => setIsAdvanceModalOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                <span>Reste payable maximum pour ce mois :</span>
                <span className="font-bold text-amber-950">{fmt(selectedRemainingToPay)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Montant de l&apos;avance (DT) :
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max={selectedRemainingToPay}
                    step="1"
                    placeholder={`Max: ${selectedRemainingToPay}`}
                    value={advanceAmountInput}
                    onChange={(e) => setAdvanceAmountInput(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all pr-12"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                    DT
                  </span>
                </div>
              </div>

              {Number(advanceAmountInput) > 0 && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span>Avance versée :</span>
                    <span className="font-bold text-amber-700">-{fmt(Number(advanceAmountInput))}</span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-semibold text-slate-800">
                    <span>Solde restant après avance :</span>
                    <span>{fmt(Math.max(0, selectedRemainingToPay - Number(advanceAmountInput)))}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleGiveAdvance}
                  disabled={
                    isPending ||
                    !advanceAmountInput ||
                    Number(advanceAmountInput) <= 0 ||
                    Number(advanceAmountInput) > selectedRemainingToPay
                  }
                  className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
                >
                  {isPending ? "Enregistrement..." : "Confirmer l'avance"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
