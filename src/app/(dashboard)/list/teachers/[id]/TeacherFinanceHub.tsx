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
  Minus,
  RotateCcw,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { payTeacherSalary, updateMissedHours, carryOverMissedHours } from "../actions";
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
  img?: string | null;
}

export interface PaymentMeta {
  trackedHours: number;
  deductedHours: number;
  deductionStatus: "PENDING" | "APPLIED" | "EXCUSED";
  notes?: string;
}

const parsePaymentMeta = (p?: PaymentRecord | null): PaymentMeta => {
  if (!p) {
    return { trackedHours: 0, deductedHours: 0, deductionStatus: "PENDING" };
  }
  if (p.img) {
    try {
      const parsed = JSON.parse(p.img);
      if (typeof parsed === "object" && parsed !== null) {
        const tracked = Number(parsed.trackedHours ?? p.missedHours ?? 0);
        const status = (parsed.deductionStatus as "PENDING" | "APPLIED" | "EXCUSED") || "PENDING";
        const deducted = Number(parsed.deductedHours ?? (status === "APPLIED" ? tracked : 0));
        return {
          trackedHours: tracked,
          deductedHours: deducted,
          deductionStatus: status,
          notes: parsed.notes || "",
        };
      }
    } catch {
      // ignore json parse error
    }
  }
  // Legacy records without metadata: if missedHours > 0, it was an applied deduction
  const hrs = p.missedHours || 0;
  return {
    trackedHours: hrs,
    deductedHours: hrs,
    deductionStatus: hrs > 0 ? "APPLIED" : "PENDING",
  };
};

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
  const [modalTrackedHours, setModalTrackedHours] = useState<number>(0);
  const [modalDeductionMode, setModalDeductionMode] = useState<"PENDING" | "APPLIED" | "EXCUSED">("PENDING");

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

  // Next academic month helper (for carrying over hours)
  const currentMonthConfigIndex = ACADEMIC_MONTHS_CONFIG.findIndex((c) => c.month === selectedMonth);
  const nextMonthConfig =
    currentMonthConfigIndex >= 0 && currentMonthConfigIndex < ACADEMIC_MONTHS_CONFIG.length - 1
      ? ACADEMIC_MONTHS_CONFIG[currentMonthConfigIndex + 1]
      : null;
  const nextMonthYear = nextMonthConfig
    ? academicStartYear + nextMonthConfig.offsetYear
    : null;
  const nextMonthFullLabel = nextMonthConfig
    ? `${nextMonthConfig.fullFr} ${nextMonthYear}`
    : null;

  const isSelectedPaid = currentSelectedPayment?.status === "PAID";
  const isSelectedPartial = currentSelectedPayment?.status === "PARTIAL";

  // Deduction & Missed Hours Counter for Selected Month
  const selectedMeta = parsePaymentMeta(currentSelectedPayment);
  const selectedTrackedHours = selectedMeta.trackedHours;
  const selectedDeductedHours =
    selectedMeta.deductionStatus === "APPLIED"
      ? (selectedMeta.deductedHours || selectedTrackedHours)
      : 0;
  const selectedDeductionAmount = selectedDeductedHours * effectiveHourlyRate;

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
    const meta = parsePaymentMeta(p);
    if (meta.deductionStatus === "APPLIED") {
      const hours = meta.deductedHours > 0 ? meta.deductedHours : (p.missedHours || 0);
      return sum + hours * effectiveHourlyRate;
    }
    if (p.status === "PAID" && baseMonthlySalary > p.amount && !p.img && (!p.missedHours || p.missedHours === 0)) {
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
      const meta = parsePaymentMeta(m.payment);
      const ded =
        meta.deductionStatus === "APPLIED"
          ? (meta.deductedHours || m.payment?.missedHours || 0) * effectiveHourlyRate
          : 0;
      return sum + Math.max(0, baseMonthlySalary - ded);
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

  const openAbsenceModal = () => {
    const meta = parsePaymentMeta(currentSelectedPayment);
    setModalTrackedHours(meta.trackedHours);
    setModalDeductionMode(meta.deductionStatus);
    setIsAbsenceModalOpen(true);
  };

  // Payment triggers
  const handlePayNetSalary = (amountToPay: number, missedHrs: number, dedAmount: number) => {
    if (!isAdmin || isPending || isSelectedPaid) return;
    const meta: PaymentMeta = {
      trackedHours: selectedMeta.trackedHours,
      deductedHours: selectedMeta.deductedHours,
      deductionStatus: selectedMeta.deductionStatus,
      notes: selectedMeta.notes,
    };
    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        amountToPay,
        selectedFullLabel,
        missedHrs,
        dedAmount,
        false,
        undefined,
        undefined,
        meta
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
          img: JSON.stringify(meta),
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
    const meta: PaymentMeta = {
      trackedHours: selectedMeta.trackedHours,
      deductedHours: selectedMeta.deductedHours,
      deductionStatus: selectedMeta.deductionStatus,
      notes: selectedMeta.notes,
    };
    startTransition(async () => {
      const result = await payTeacherSalary(
        teacherId,
        teacherName,
        remainingAmount,
        selectedFullLabel,
        missedHrs,
        dedAmount,
        false,
        undefined,
        undefined,
        meta
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
          img: JSON.stringify(meta),
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
        true,
        undefined,
        undefined,
        selectedMeta
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
          missedHours: selectedMeta.trackedHours,
          img: JSON.stringify(selectedMeta),
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

  const handleSaveMissedHours = () => {
    if (!isAdmin || isPending) return;
    const tracked = Math.max(0, modalTrackedHours);
    const deducted = modalDeductionMode === "APPLIED" ? tracked : 0;

    const meta: PaymentMeta = {
      trackedHours: tracked,
      deductedHours: deducted,
      deductionStatus: tracked === 0 ? "PENDING" : modalDeductionMode,
    };

    startTransition(async () => {
      const result = await updateMissedHours(
        teacherId,
        selectedFullLabel,
        tracked,
        meta
      );
      if (result.success) {
        const imgStr = JSON.stringify(meta);
        setPayments((prev) => {
          const existing = prev.find((p) => p.month === selectedMonth && p.year === selectedYear);
          if (existing) {
            return prev.map((p) =>
              p.month === selectedMonth && p.year === selectedYear
                ? { ...p, missedHours: tracked, img: imgStr }
                : p
            );
          } else {
            const newRecord: PaymentRecord = {
              id: Date.now(),
              month: selectedMonth,
              year: selectedYear,
              amount: 0,
              status: "PENDING",
              missedHours: tracked,
              paidAt: null,
              img: imgStr,
            };
            return [newRecord, ...prev];
          }
        });
        setIsAbsenceModalOpen(false);
      } else {
        alert(result.error || "Une erreur est survenue lors de l'enregistrement du compteur.");
      }
    });
  };

  const handleResetCounter = () => {
    if (!isAdmin || isPending) return;
    const meta: PaymentMeta = {
      trackedHours: 0,
      deductedHours: 0,
      deductionStatus: "PENDING",
    };
    startTransition(async () => {
      const result = await updateMissedHours(teacherId, selectedFullLabel, 0, meta);
      if (result.success) {
        const imgStr = JSON.stringify(meta);
        setPayments((prev) => {
          return prev.map((p) =>
            p.month === selectedMonth && p.year === selectedYear
              ? { ...p, missedHours: 0, img: imgStr }
              : p
          );
        });
        setIsAbsenceModalOpen(false);
      } else {
        alert(result.error || "Une erreur est survenue lors de la réinitialisation du compteur.");
      }
    });
  };

  const handleCarryOver = (hours: number, targetMonthLabel: string) => {
    if (!isAdmin || isPending || hours <= 0 || !targetMonthLabel) return;
    startTransition(async () => {
      const result = await carryOverMissedHours(
        teacherId,
        selectedFullLabel,
        targetMonthLabel,
        hours
      );
      if (result.success) {
        const [targetMName, targetYStr] = targetMonthLabel.split(" ");
        const targetMonthIdx = MONTHS.indexOf(targetMName) + 1;
        const targetYearVal = parseInt(targetYStr);

        setPayments((prev) => {
          let foundTarget = false;
          const updated = prev.map((p) => {
            if (p.month === selectedMonth && p.year === selectedYear) {
              const meta: PaymentMeta = {
                trackedHours: 0,
                deductedHours: 0,
                deductionStatus: "EXCUSED",
                notes: `Reporté (${hours}h) sur ${targetMonthLabel}`,
              };
              return { ...p, missedHours: 0, img: JSON.stringify(meta) };
            }
            if (p.month === targetMonthIdx && p.year === targetYearVal) {
              foundTarget = true;
              const targetMeta = parsePaymentMeta(p);
              const updatedMeta: PaymentMeta = {
                trackedHours: targetMeta.trackedHours + hours,
                deductedHours: targetMeta.deductedHours,
                deductionStatus: "PENDING",
                notes: `Inclus report de ${hours}h depuis ${selectedFullLabel}`,
              };
              return {
                ...p,
                missedHours: targetMeta.trackedHours + hours,
                img: JSON.stringify(updatedMeta),
              };
            }
            return p;
          });

          if (!foundTarget) {
            const newMeta: PaymentMeta = {
              trackedHours: hours,
              deductedHours: 0,
              deductionStatus: "PENDING",
              notes: `Inclus report de ${hours}h depuis ${selectedFullLabel}`,
            };
            const newRecord: PaymentRecord = {
              id: Date.now(),
              month: targetMonthIdx,
              year: targetYearVal,
              amount: 0,
              status: "PENDING",
              missedHours: hours,
              paidAt: null,
              img: JSON.stringify(newMeta),
            };
            return [newRecord, ...updated];
          }

          return updated;
        });
        setIsAbsenceModalOpen(false);
      } else {
        alert(result.error || "Une erreur est survenue lors du report des heures.");
      }
    });
  };

  const handleExcusePendingOnPaid = () => {
    if (!isAdmin || isPending) return;
    const meta: PaymentMeta = {
      trackedHours: selectedTrackedHours,
      deductedHours: 0,
      deductionStatus: "EXCUSED",
      notes: "Absence justifiée",
    };
    startTransition(async () => {
      const result = await updateMissedHours(teacherId, selectedFullLabel, selectedTrackedHours, meta);
      if (result.success) {
        setPayments((prev) =>
          prev.map((p) =>
            p.month === selectedMonth && p.year === selectedYear
              ? { ...p, img: JSON.stringify(meta) }
              : p
          )
        );
        setIsAbsenceModalOpen(false);
      } else {
        alert(result.error || "Une erreur est survenue lors de l'enregistrement.");
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

  // Absence Modal Live Financial Preview Calculations
  const modalDeductedHoursCalc = modalDeductionMode === "APPLIED" ? modalTrackedHours : 0;
  const modalDeductionAmountCalc = modalDeductedHoursCalc * effectiveHourlyRate;
  const modalProjectedNetToPay = Math.max(
    0,
    baseMonthlySalary - (modalDeductionMode === "APPLIED" ? modalDeductionAmountCalc : 0) - selectedAdvanceAmount
  );

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
            <span className="text-[11px] text-emerald-500 font-medium block mt-0.5">
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
            <span className="text-[11px] text-amber-500 font-medium block mt-0.5">
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
            <span className="text-[11px] text-rose-500 font-medium block mt-0.5">
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
            <span className={`text-[11px] font-medium block mt-0.5 ${
              outstandingBalance > 0 ? "text-rose-500" : "text-emerald-500"
            }`}>
              {outstandingBalance > 0 ? "Paiement en attente" : "✓ Tout est réglé"}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
            outstandingBalance > 0 
              ? "bg-rose-100/60 border-rose-300 text-rose-600" 
              : "bg-emerald-50 border-emerald-200 text-emerald-500"
          }`}>
            {outstandingBalance > 0 ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
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
                    type="button"
                    onClick={() => {
                      setSelectedMonth(m.month);
                      setSelectedYear(m.year);
                    }}
                    className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer select-none flex flex-col items-center justify-center gap-1 relative ${
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
            <div className="flex items-center justify-between flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="font-medium">Payé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span className="font-medium">Avance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                <span className="font-medium">En retard</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-200 border border-slate-300 shrink-0" />
                <span className="font-medium">À venir</span>
              </div>
            </div>
          </div>

          {/* INTERACTIVE MONTH CONTROLLER & DETAILED FINANCIAL BREAKDOWN CARD */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
            {/* Unified Month Nav + Status Strip */}
            <div className={`flex items-center justify-between rounded-2xl border px-4 py-3 gap-3 transition-colors ${
              isSelectedPaid
                ? "bg-emerald-50/60 border-emerald-200"
                : isSelectedPartial
                ? "bg-amber-50/60 border-amber-200"
                : "bg-slate-50 border-slate-200/70"
            }`}>
              {/* ← Prev */}
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors border border-transparent hover:border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                title="Mois précédent"
              >
                <ChevronLeft size={18} />
              </button>

              {/* Centre: Month + Status badge + Amount */}
              <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900">{selectedDisplayLabel}</span>
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${
                    isSelectedPaid
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : isSelectedPartial
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : "bg-rose-100 text-rose-800 border-rose-200"
                  }`}>
                    {isSelectedPaid ? "PAYÉ" : isSelectedPartial ? "AVANCE" : "NON RÉGLÉ"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {isSelectedPaid
                      ? "Versé :"
                      : isSelectedPartial
                      ? "Solde restant :"
                      : "Net à régler :"}
                  </span>
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg border shadow-2xs ${
                    isSelectedPaid
                      ? "bg-white text-emerald-800 border-emerald-200"
                      : isSelectedPartial
                      ? "bg-white text-amber-900 border-amber-300"
                      : "bg-white text-slate-800 border-slate-200"
                  }`}>
                    {fmt(isSelectedPaid ? (currentSelectedPayment?.amount || baseMonthlySalary) : selectedRemainingToPay)}
                  </span>
                </div>
              </div>

              {/* → Next */}
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors border border-transparent hover:border-slate-200 shadow-2xs shrink-0 cursor-pointer"
                title="Mois suivant"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {/* 1. APPLIED DEDUCTION: RED BLOCK */}
            {selectedMeta.deductionStatus === "APPLIED" && selectedDeductedHours > 0 && (
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
                      En raison d&apos;absence : {selectedDeductedHours}h de cours non dispensées ({effectiveHourlyRate} DT/h)
                      {selectedTrackedHours > selectedDeductedHours ? ` (sur ${selectedTrackedHours}h au compteur)` : ""}
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

            {/* 2. PENDING TRACKING: BLUE/INDIGO IF UNPAID, AMBER TRANSFER ALERT IF PAID */}
            {selectedMeta.deductionStatus === "PENDING" && selectedTrackedHours > 0 && (
              isSelectedPaid ? (
                <div className="p-4 bg-amber-50/80 border border-amber-200/90 rounded-xl flex items-center justify-between gap-3 text-amber-950 shadow-2xs animate-in fade-in duration-200 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700 shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-950 block">
                          {selectedTrackedHours}h d&apos;absence non déduites (Mois clôturé)
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                          À reporter
                        </span>
                      </div>
                      <span className="text-[11px] text-amber-700 font-medium block mt-0.5">
                        Le salaire de ce mois a déjà été payé. Vous pouvez reporter ces heures sur le mois suivant ou les considérer comme justifiées.
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-2 shrink-0">
                      {nextMonthFullLabel && (
                        <button
                          onClick={() => handleCarryOver(selectedTrackedHours, nextMonthFullLabel)}
                          disabled={isPending}
                          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                          title={`Reporter les ${selectedTrackedHours}h sur ${nextMonthFullLabel}`}
                        >
                          <ArrowRight size={13} />
                          <span>Reporter sur {nextMonthConfig?.labelFr}</span>
                        </button>
                      )}
                      <button
                        onClick={handleExcusePendingOnPaid}
                        disabled={isPending}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs shadow-2xs transition-colors"
                      >
                        Justifier (0h)
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-xl flex items-center justify-between gap-3 text-indigo-950 shadow-2xs animate-in fade-in duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-indigo-950 block">
                          Compteur d&apos;absence : {selectedTrackedHours}h enregistrées
                        </span>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-200/70 text-indigo-800">
                          En suivi
                        </span>
                      </div>
                      <span className="text-[11px] text-indigo-700 font-medium block mt-0.5">
                        Heures comptabilisées · Aucune retenue déduite aujourd&apos;hui (0 DT)
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={openAbsenceModal}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-bold text-xs shadow-2xs transition-colors flex items-center gap-1.5"
                    >
                      <Scissors size={13} className="text-rose-500" />
                      <span>Décider de la retenue</span>
                    </button>
                  )}
                </div>
              )
            )}

            {/* 3. EXCUSED: EMERALD BLOCK */}
            {selectedMeta.deductionStatus === "EXCUSED" && selectedTrackedHours > 0 && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between gap-3 text-emerald-950 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Absence justifiée / Séances rattrapées ({selectedTrackedHours}h)
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                      Justificatif validé ou cours rattrapés · Plein salaire maintenu (0 DT déduit)
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-emerald-800 px-2.5 py-1 bg-white rounded-md border border-emerald-200">
                    0 DT déduit
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

            {/* DIVIDER before action block */}
            <div className="border-t border-slate-100 pt-1" />

            {/* SETTLEMENT / NET PAYMENT SUMMARY BLOCK */}
            {isSelectedPaid ? (
              <div className="flex flex-col gap-2">
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
                        <div className="text-[10px] text-emerald-800/80 mt-1 font-semibold flex flex-col gap-0.5">
                          <span>
                            Détail : {fmt(baseMonthlySalary)} (base)
                            {selectedDeductionAmount > 0 ? ` − ${fmt(selectedDeductionAmount)} (retenue absence)` : ""}
                            {selectedDeductionAmount > 0 ? ` = ${fmt(baseMonthlySalary - selectedDeductionAmount)} net dû` : ""}
                          </span>
                          {selectedAdvanceAmount > 0 && (
                            <span className="text-amber-800/80">
                              (dont {fmt(selectedAdvanceAmount)} versé en avance · solde final : {fmt(Math.max(0, (currentSelectedPayment?.amount || (baseMonthlySalary - selectedDeductionAmount)) - selectedAdvanceAmount))})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-block text-xs sm:text-sm font-extrabold px-3 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-700 shadow-2xs">
                      {fmt(currentSelectedPayment?.amount || (baseMonthlySalary - selectedDeductionAmount - selectedAdvanceAmount))}
                    </span>
                  </div>
                </div>
                {/* Absence link row — visible below settlement, not buried inside it */}
                {isAdmin && (
                  <button
                    onClick={openAbsenceModal}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-500 hover:text-indigo-600 text-xs font-medium transition-colors group w-fit"
                    title="Consulter ou ajuster les heures d'absence"
                  >
                    <Clock size={13} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                    <span>
                      {selectedTrackedHours > 0
                        ? `Gérer les heures d'absence (${selectedTrackedHours}h enregistrées)`
                        : "Enregistrer une absence"}
                    </span>
                    <ChevronRight size={12} className="text-slate-300 group-hover:text-indigo-400 transition-colors" />
                  </button>
                )}
              </div>
            ) : isSelectedPartial ? (
              <div className="flex flex-col gap-3">
                {isAdmin ? (
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    {/* 1. REGLEMENT (SOLDE RESTANT) */}
                    <button
                      onClick={() => handleSettleRemaining(selectedRemainingToPay, selectedTrackedHours, selectedDeductionAmount)}
                      disabled={isPending}
                      className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Banknote size={16} />
                      <span>
                        {isPending ? "Règlement en cours..." : `Régler le solde (${fmt(selectedRemainingToPay)})`}
                      </span>
                    </button>

                    {/* 2. VERSEMENT AVANCE */}
                    <button
                      onClick={() => {
                        setAdvanceAmountInput("");
                        setIsAdvanceModalOpen(true);
                      }}
                      disabled={isPending || selectedRemainingToPay <= 0}
                      className="py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs"
                      title="Verser une autre avance"
                    >
                      <TrendingUp size={15} className="text-amber-600" />
                      <span>Verser avance</span>
                    </button>

                    {/* 3. ABSENCE */}
                    <button
                      onClick={openAbsenceModal}
                      disabled={isPending}
                      className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs disabled:opacity-50 ${
                        selectedTrackedHours > 0
                          ? selectedMeta.deductionStatus === "APPLIED"
                            ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                            : selectedMeta.deductionStatus === "EXCUSED"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                      title="Gérer le compteur d'absence et les retenues"
                    >
                      <Clock
                        size={15}
                        className={
                          selectedTrackedHours > 0
                            ? selectedMeta.deductionStatus === "APPLIED"
                              ? "text-rose-600"
                              : selectedMeta.deductionStatus === "EXCUSED"
                              ? "text-emerald-600"
                              : "text-indigo-600"
                            : "text-slate-500"
                        }
                      />
                      <span>
                        {selectedTrackedHours > 0
                          ? `Absence (${selectedTrackedHours}h)`
                          : "Ajuster absence"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl text-center text-xs text-slate-400 italic">
                    En attente d&apos;exécution par l&apos;administrateur.
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {isAdmin ? (
                  <div className="flex flex-col sm:flex-row items-stretch gap-2">
                    {/* 1. REGLEMENT DU SALAIRE */}
                    <button
                      onClick={() => handlePayNetSalary(selectedRemainingToPay, selectedTrackedHours, selectedDeductionAmount)}
                      disabled={isPending}
                      className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Banknote size={16} />
                      <span>
                        {isPending ? "Traitement..." : `Régler le salaire (${fmt(selectedRemainingToPay)})`}
                      </span>
                    </button>

                    {/* 2. VERSEMENT AVANCE */}
                    <button
                      onClick={() => {
                        setAdvanceAmountInput("");
                        setIsAdvanceModalOpen(true);
                      }}
                      disabled={isPending || selectedRemainingToPay <= 0}
                      className="py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-2xs"
                      title="Verser une avance sur salaire"
                    >
                      <TrendingUp size={15} className="text-amber-600" />
                      <span>Verser avance</span>
                    </button>

                    {/* 3. ABSENCE */}
                    <button
                      onClick={openAbsenceModal}
                      disabled={isPending}
                      className={`py-3 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-2xs disabled:opacity-50 ${
                        selectedTrackedHours > 0
                          ? selectedMeta.deductionStatus === "APPLIED"
                            ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                            : selectedMeta.deductionStatus === "EXCUSED"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                            : "border-indigo-300 bg-indigo-50 text-indigo-800 hover:bg-indigo-100"
                          : "border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
                      }`}
                      title="Gérer le compteur d'absence et les retenues"
                    >
                      <Clock
                        size={15}
                        className={
                          selectedTrackedHours > 0
                            ? selectedMeta.deductionStatus === "APPLIED"
                              ? "text-rose-600"
                              : selectedMeta.deductionStatus === "EXCUSED"
                              ? "text-emerald-600"
                              : "text-indigo-600"
                            : "text-slate-500"
                        }
                      />
                      <span>
                        {selectedTrackedHours > 0
                          ? `Absence (${selectedTrackedHours}h)`
                          : "Ajuster absence"}
                      </span>
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
                    const pMeta = parsePaymentMeta(p);
                    const hasAppliedDeduction = pMeta.deductionStatus === "APPLIED" && pMeta.deductedHours > 0;
                    const hasPendingTracking = pMeta.deductionStatus === "PENDING" && pMeta.trackedHours > 0;
                    const isExcused = pMeta.deductionStatus === "EXCUSED" && pMeta.trackedHours > 0;
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
                            {hasAppliedDeduction && (
                              <span className="text-rose-600 font-semibold ml-1.5">
                                (-{pMeta.deductedHours}h absence)
                              </span>
                            )}
                            {hasPendingTracking && (
                              <span className="text-indigo-600 font-semibold ml-1.5">
                                ({pMeta.trackedHours}h en suivi)
                              </span>
                            )}
                            {isExcused && (
                              <span className="text-emerald-600 font-semibold ml-1.5">
                                ({pMeta.trackedHours}h justifiée)
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

            <div className="flex flex-col gap-0 text-xs">
              {/* Base salary — visually prominent */}
              <div className={`flex items-center justify-between py-2.5 px-3 rounded-xl mb-1 ${
                salary === 0 ? "bg-amber-50 border border-amber-200/60" : "bg-slate-50"
              }`}>
                <span className="text-slate-600 font-semibold">Salaire mensuel de base</span>
                <div className="flex items-center gap-2">
                  <span className={`font-black text-sm ${salary === 0 ? "text-amber-700" : "text-slate-900"}`}>
                    {fmt(salary)}
                  </span>
                  {salary === 0 && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      Non défini
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between py-2 px-1 border-b border-slate-50">
                <span className="text-slate-500">Taux de retenue horaire :</span>
                <span className="font-bold text-slate-800">{effectiveHourlyRate} DT / h</span>
              </div>
              <div className="flex items-center justify-between py-2 px-1 border-b border-slate-50">
                <span className="text-slate-500">Volume mensuel théorique :</span>
                <span className="font-bold text-slate-800">{hoursPerMonth ? `${hoursPerMonth}h / mois` : "40h / mois"}</span>
              </div>
              <div className="flex items-center justify-between py-2 px-1">
                <span className="text-slate-500">Période académique :</span>
                <span className="font-semibold text-slate-700">{academicStartYear} - {academicEndYear}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ADMIN MODAL: COMPTEUR & DÉCISION D'ABSENCE */}
      {isAbsenceModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={() => setIsAbsenceModalOpen(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full relative overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100 flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <Clock size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Compteur d&apos;heures d&apos;absence</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {teacherName} · {selectedDisplayLabel}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsAbsenceModalOpen(false)}
                className="w-8 h-8 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 flex flex-col gap-5 overflow-y-auto">
              {/* Section 1: Compteur d'heures (Interactive Stepper & Quick Add) */}
              <div className="p-4 sm:p-5 bg-slate-50/80 border border-slate-200/80 rounded-2xl flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Compteur d&apos;heures non dispensées :
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded-md border border-slate-200/60">
                    Taux : {effectiveHourlyRate} DT / h
                  </span>
                </div>

                {/* Stepper Display */}
                <div className="flex items-center justify-center gap-3 py-1">
                  <button
                    type="button"
                    onClick={() => setModalTrackedHours((h) => Math.max(0, h - 1))}
                    className="w-11 h-11 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-transform active:scale-95 shadow-2xs text-lg disabled:opacity-40"
                    disabled={modalTrackedHours <= 0}
                  >
                    <Minus size={18} />
                  </button>

                  <div className="flex items-baseline justify-center gap-2 px-6 py-2.5 bg-white rounded-2xl border-2 border-indigo-200/80 min-w-[150px] shadow-2xs">
                    <span className="text-3xl font-black text-slate-900 tracking-tight">
                      {modalTrackedHours}
                    </span>
                    <span className="text-sm font-bold text-slate-500">
                      {modalTrackedHours > 1 ? "heures" : "heure"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalTrackedHours((h) => h + 1)}
                    className="w-11 h-11 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold flex items-center justify-center transition-transform active:scale-95 shadow-2xs text-lg"
                  >
                    <Plus size={18} />
                  </button>
                </div>

                {/* Quick-add buttons */}
                <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-200/60 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-400">Ajouter aujourd&apos;hui :</span>
                  {[1, 2, 3, 4].map((hrs) => (
                    <button
                      key={hrs}
                      type="button"
                      onClick={() => setModalTrackedHours((h) => h + hrs)}
                      className="px-3 py-1 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 font-bold text-xs transition-colors shadow-2xs"
                    >
                      +{hrs}h
                    </button>
                  ))}
                </div>
              </div>

              {/* Section 2: Décision de retenue sur le salaire */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Décision sur la paie de {frMonthName} :
                  </label>
                  <span className="text-[11px] font-medium text-slate-400">
                    {isSelectedPaid ? "Mois clôturé" : "Choisissez l'action"}
                  </span>
                </div>

                {isSelectedPaid ? (
                  <div className="flex flex-col gap-2.5">
                    {/* NOTICE: Month is paid */}
                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-xs text-amber-900 flex items-start gap-2.5">
                      <Clock size={16} className="text-amber-700 shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        Ce mois est déjà <strong>clôturé et payé</strong> ({fmt(currentSelectedPayment?.amount || baseMonthlySalary)}). 
                        Une retenue ne peut pas être prélevée rétroactivement sur ce mois, mais elle peut être <strong>reportée sur le mois suivant</strong>.
                      </div>
                    </div>

                    {/* Option A: PENDING (Historique seul) */}
                    <button
                      type="button"
                      onClick={() => setModalDeductionMode("PENDING")}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                        modalDeductionMode === "PENDING"
                          ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        modalDeductionMode === "PENDING"
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}>
                        <Clock size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Historique d&apos;assiduité seul
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 shrink-0">
                            Sans retenue
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Conserver ces {modalTrackedHours}h au dossier sans modifier le paiement déjà effectué.
                        </p>
                      </div>
                    </button>

                    {/* Option B: CARRY OVER TO NEXT MONTH */}
                    {nextMonthFullLabel && (
                      <button
                        type="button"
                        onClick={() => setModalDeductionMode("APPLIED")}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                          modalDeductionMode === "APPLIED"
                            ? "bg-amber-50/70 border-amber-400 ring-2 ring-amber-500/20 shadow-xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                          modalDeductionMode === "APPLIED"
                            ? "bg-amber-600 text-white border-amber-600"
                            : "bg-amber-50 text-amber-600 border-amber-200"
                        }`}>
                          <ArrowRight size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              Reporter sur {nextMonthConfig?.labelFr} ({nextMonthFullLabel})
                            </span>
                            {modalTrackedHours > 0 && (
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-white border border-amber-300 text-amber-800 shrink-0">
                                -{fmt(modalTrackedHours * effectiveHourlyRate)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Transférer la retenue de {modalTrackedHours}h pour qu&apos;elle soit déduite du salaire de {nextMonthConfig?.labelFr}.
                          </p>
                        </div>
                      </button>
                    )}

                    {/* Option C: EXCUSED */}
                    <button
                      type="button"
                      onClick={() => setModalDeductionMode("EXCUSED")}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                        modalDeductionMode === "EXCUSED"
                          ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        modalDeductionMode === "EXCUSED"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-emerald-50 text-emerald-600 border-emerald-200"
                      }`}>
                        <ShieldCheck size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Absence justifiée / Rattrapée
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                            Validé
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Cours rattrapé ou absence justifiée. Aucun report ni retenue financière.
                        </p>
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {/* Option 1: PENDING (Mettre en attente dans le compteur) */}
                    <button
                      type="button"
                      onClick={() => setModalDeductionMode("PENDING")}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                        modalDeductionMode === "PENDING"
                          ? "bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        modalDeductionMode === "PENDING"
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-indigo-50 text-indigo-600 border-indigo-200"
                      }`}>
                        <Clock size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Mettre en attente (Compteur seul)
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 shrink-0">
                            0 DT déduit
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Conserver {modalTrackedHours}h en réserve. Le salaire reste intact aujourd&apos;hui, vous trancherez lors du règlement final.
                        </p>
                      </div>
                    </button>

                    {/* Option 2: APPLIED (Déduire du salaire) */}
                    <button
                      type="button"
                      onClick={() => setModalDeductionMode("APPLIED")}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                        modalDeductionMode === "APPLIED"
                          ? "bg-rose-50/60 border-rose-400 ring-2 ring-rose-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        modalDeductionMode === "APPLIED"
                          ? "bg-rose-600 text-white border-rose-600"
                          : "bg-rose-50 text-rose-600 border-rose-200"
                      }`}>
                        <Scissors size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Déduire du salaire
                          </span>
                          {modalTrackedHours > 0 && (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-white border border-rose-200 text-rose-600 shrink-0 shadow-2xs">
                              -{fmt(modalTrackedHours * effectiveHourlyRate)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Retenir immédiatement les {modalTrackedHours}h d&apos;absence sur la paie nette de {frMonthName}.
                        </p>
                      </div>
                    </button>

                    {/* Option 3: EXCUSED (Absence justifiée / Rattrapée) */}
                    <button
                      type="button"
                      onClick={() => setModalDeductionMode("EXCUSED")}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3.5 ${
                        modalDeductionMode === "EXCUSED"
                          ? "bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60"
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                        modalDeductionMode === "EXCUSED"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-emerald-50 text-emerald-600 border-emerald-200"
                      }`}>
                        <ShieldCheck size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-900">
                            Absence justifiée / Rattrapée
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                            Plein salaire
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Cours déjà rattrapé ou absence autorisée. Aucune retenue sur le salaire (0 DT déduit).
                        </p>
                      </div>
                    </button>
                  </div>
                )}

                {/* Live Financial Impact Summary Box */}
                <div className={`p-4 rounded-2xl border transition-all ${
                  modalDeductionMode === "APPLIED"
                    ? isSelectedPaid
                      ? "bg-amber-50/80 border-amber-300/80 text-amber-950"
                      : "bg-rose-50/70 border-rose-300/80 text-rose-950"
                    : modalDeductionMode === "EXCUSED"
                    ? "bg-emerald-50/70 border-emerald-300/80 text-emerald-950"
                    : "bg-indigo-50/70 border-indigo-300/80 text-indigo-950"
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                      {isSelectedPaid ? "Conséquence financière :" : `Aperçu de la paie (${frMonthName}) :`}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                      modalDeductionMode === "APPLIED"
                        ? isSelectedPaid ? "bg-amber-200 text-amber-900" : "bg-rose-200 text-rose-900"
                        : modalDeductionMode === "EXCUSED"
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-indigo-200 text-indigo-900"
                    }`}>
                      {modalDeductionMode === "APPLIED"
                        ? isSelectedPaid ? "Report futur" : "Retenue active"
                        : modalDeductionMode === "EXCUSED"
                        ? "Plein salaire"
                        : "En réserve"}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                      {isSelectedPaid ? (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-black text-slate-900">
                              {modalDeductionMode === "APPLIED" && nextMonthConfig
                                ? `-${fmt(modalTrackedHours * effectiveHourlyRate)}`
                                : "0 DT"}
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {modalDeductionMode === "APPLIED" && nextMonthConfig
                                ? `déduit sur ${nextMonthConfig.labelFr}`
                                : "aucun prélèvement"}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-600 mt-1">
                            {modalDeductionMode === "APPLIED" && nextMonthConfig
                              ? `Ce mois reste payé (${fmt(currentSelectedPayment?.amount || baseMonthlySalary)}). La retenue s'appliquera sur ${nextMonthFullLabel}.`
                              : "Le salaire déjà versé pour ce mois n'est pas modifié."}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                              {fmt(modalProjectedNetToPay)}
                            </span>
                            <span className="text-xs font-bold text-slate-500">net à verser</span>
                          </div>
                          <span className="text-[11px] text-slate-600 mt-0.5">
                            {modalDeductionMode === "APPLIED"
                              ? `Base (${fmt(baseMonthlySalary)}) - Retenue (-${fmt(modalDeductionAmountCalc)})${selectedAdvanceAmount > 0 ? ` - Avance (-${fmt(selectedAdvanceAmount)})` : ""}`
                              : modalDeductionMode === "EXCUSED"
                              ? `Salaire maintenu à 100%${selectedAdvanceAmount > 0 ? ` (Avance versée : -${fmt(selectedAdvanceAmount)})` : ""}`
                              : `Salaire normal non impacté (${modalTrackedHours}h conservée(s) au compteur)`}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Pill summary tag */}
                    <div className="shrink-0 text-right">
                      {modalDeductionMode === "APPLIED" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-rose-700 bg-white px-2.5 py-1 rounded-xl border border-rose-200 shadow-2xs">
                          <Scissors size={12} />
                          -{fmt(isSelectedPaid ? modalTrackedHours * effectiveHourlyRate : modalDeductionAmountCalc)}
                        </span>
                      ) : modalDeductionMode === "EXCUSED" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700 bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
                          <ShieldCheck size={12} />
                          100% Validé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 shadow-2xs">
                          <Clock size={12} />
                          {modalTrackedHours}h en réserve
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <div>
                {modalTrackedHours > 0 && (
                  <button
                    type="button"
                    onClick={handleResetCounter}
                    disabled={isPending}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw size={13} />
                    <span>Réinitialiser (0h)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAbsenceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isSelectedPaid && modalDeductionMode === "APPLIED" && nextMonthFullLabel) {
                      handleCarryOver(modalTrackedHours, nextMonthFullLabel);
                    } else if (isSelectedPaid && modalDeductionMode === "EXCUSED") {
                      handleExcusePendingOnPaid();
                    } else {
                      handleSaveMissedHours();
                    }
                  }}
                  disabled={isPending}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 ${
                    isSelectedPaid && modalDeductionMode === "APPLIED"
                      ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200"
                      : modalDeductionMode === "APPLIED"
                      ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200"
                      : modalDeductionMode === "EXCUSED"
                      ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                  }`}
                >
                  {isPending ? (
                    <span>Enregistrement...</span>
                  ) : isSelectedPaid && modalDeductionMode === "APPLIED" ? (
                    <span>Reporter sur {nextMonthConfig?.labelFr} ({modalTrackedHours}h)</span>
                  ) : modalDeductionMode === "APPLIED" ? (
                    <span>
                      Appliquer la retenue (-{fmt(modalDeductionAmountCalc)})
                    </span>
                  ) : modalDeductionMode === "EXCUSED" ? (
                    <span>Valider l&apos;absence justifiée</span>
                  ) : (
                    <span>
                      {modalTrackedHours > 0
                        ? `Mettre en attente (${modalTrackedHours}h)`
                        : "Enregistrer (0h)"}
                    </span>
                  )}
                </button>
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
