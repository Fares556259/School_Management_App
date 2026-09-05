"use client";

import { useState, useTransition, useMemo } from "react";
import { 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Calendar, 
  Banknote, 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  ShieldCheck,
  TrendingUp,
  Sparkles,
  Layers,
  Coins,
  ArrowRight,
  X,
  Plus
} from "lucide-react";
import { receiveStudentPayment, receiveMultipleStudentPayments } from "@/app/(dashboard)/list/students/actions";
import { MONTHS } from "@/lib/dateUtils";

interface PaymentRecord {
  id: number;
  month: number;
  year: number;
  amount: number;
  status: string;
  paidAt?: Date | string | null;
  deferredAmount?: number | null;
}

interface StudentTuitionTabProps {
  studentId: string;
  studentName: string;
  gradeLevel: number;
  customTuition?: number | null;
  levelTuitionFee: number;
  payments: PaymentRecord[];
  isAdmin: boolean;
}

const ACADEMIC_MONTHS = [
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

export default function StudentTuitionTab({
  studentId,
  studentName,
  gradeLevel,
  customTuition,
  levelTuitionFee,
  payments: initialPayments,
  isAdmin,
}: StudentTuitionTabProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const currentCalMonth = now.getMonth() + 1; // 1-12
  const currentCalYear = now.getFullYear();

  // Academic year start: if month >= 9, current year, else previous year
  const academicStartYear = currentCalMonth >= 9 ? currentCalYear : currentCalYear - 1;
  const academicEndYear = academicStartYear + 1;

  // Selected Month Index in 10-month array
  const defaultIdx = ACADEMIC_MONTHS.findIndex((m) => m.month === currentCalMonth);
  const [selectedIdx, setSelectedIdx] = useState<number>(defaultIdx !== -1 ? defaultIdx : 0);

  const selectedMonthCfg = ACADEMIC_MONTHS[selectedIdx];
  const selectedMonth = selectedMonthCfg.month;
  const selectedYear = academicStartYear + selectedMonthCfg.offsetYear;
  const frMonthName = selectedMonthCfg.fullFr;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";
  const formatDate = (d?: Date | string | null) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return String(d);
    }
  };

  const monthlyRate = customTuition ?? levelTuitionFee;
  const currentPayment = payments.find(
    (p) => p.month === selectedMonth && p.year === selectedYear
  );

  const isPaid = currentPayment?.status === "PAID";
  const isPartial = currentPayment?.status === "PARTIAL";
  const currentAmountPaid = currentPayment?.amount || 0;
  const currentRemainingDue = Math.max(0, monthlyRate - currentAmountPaid);

  // Single month partial payment input state
  const [singleAmountInput, setSingleAmountInput] = useState<string>("");
  const [singlePaymentType, setSinglePaymentType] = useState<"FULL" | "PARTIAL">("FULL");

  // Multi-Month / Lump Sum Modal state
  const [isMultiMonthModalOpen, setIsMultiMonthModalOpen] = useState(false);
  const [lumpSumAmount, setLumpSumAmount] = useState<string>("1000");

  // First unpaid or partial month for multi-month starting point
  const firstUnpaidIdx = useMemo(() => {
    const idx = ACADEMIC_MONTHS.findIndex((m) => {
      const y = academicStartYear + m.offsetYear;
      const p = payments.find((rec) => rec.month === m.month && rec.year === y);
      return !p || p.status !== "PAID";
    });
    return idx !== -1 ? idx : 0;
  }, [payments, academicStartYear]);

  const [multiMonthStartIdx, setMultiMonthStartIdx] = useState<number>(firstUnpaidIdx);

  // Check if month is overdue
  const isPastOrCurrentMonth =
    selectedYear < currentCalYear ||
    (selectedYear === currentCalYear && selectedMonth <= currentCalMonth);
  const isOverdue = !isPaid && !isPartial && isPastOrCurrentMonth;

  // Academic totals
  const totalPaidThisYear = payments
    .filter((p) => {
      const isAcademic =
        (p.year === academicStartYear && p.month >= 9) ||
        (p.year === academicEndYear && p.month <= 6);
      return isAcademic;
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const fullYearTuition = monthlyRate * 10;
  const remainingTuition = Math.max(0, fullYearTuition - totalPaidThisYear);
  const paidMonthsCount = ACADEMIC_MONTHS.filter((m) => {
    const y = academicStartYear + m.offsetYear;
    return payments.some((p) => p.month === m.month && p.year === y && p.status === "PAID");
  }).length;

  // 1. SINGLE MONTH PAYMENT HANDLER (Full or Partial, e.g. 40 DT on 450 DT)
  const handleCollectSingleMonth = (amountToCollect?: number) => {
    if (!isAdmin || isPending || isPaid) return;

    const amount = amountToCollect !== undefined ? amountToCollect : (
      singlePaymentType === "FULL" ? currentRemainingDue : parseFloat(singleAmountInput) || 0
    );

    if (amount <= 0) {
      alert("Veuillez saisir un montant supérieur à 0 DT.");
      return;
    }

    const newCumulative = currentAmountPaid + amount;
    if (newCumulative > monthlyRate) {
      alert(`Le montant cumulé (${newCumulative} DT) dépasse le tarif mensuel (${monthlyRate} DT).`);
      return;
    }

    const monthStr = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
    const willBeComplete = newCumulative >= monthlyRate;

    startTransition(async () => {
      const res = await receiveStudentPayment(
        studentId,
        studentName,
        monthlyRate,
        monthStr,
        newCumulative
      );

      if (res.success) {
        const newRecord: PaymentRecord = {
          id: (res.data as any)?.id || Date.now(),
          month: selectedMonth,
          year: selectedYear,
          amount: newCumulative,
          status: willBeComplete ? "PAID" : "PARTIAL",
          paidAt: new Date(),
          deferredAmount: willBeComplete ? 0 : monthlyRate - newCumulative,
        };

        setPayments((prev) => {
          const filtered = prev.filter(
            (p) => !(p.month === selectedMonth && p.year === selectedYear)
          );
          return [newRecord, ...filtered];
        });

        setSingleAmountInput("");
        setSinglePaymentType("FULL");
      } else {
        alert(res.error || "Une erreur est survenue lors de l'enregistrement du paiement.");
      }
    });
  };

  // 2. MULTI-MONTH WATERFALL ALLOCATION PREVIEW (e.g. 1000 DT -> 450 Oct, 450 Nov, 100 Dec)
  const multiMonthPreview = useMemo(() => {
    const totalCash = parseFloat(lumpSumAmount) || 0;
    if (totalCash <= 0) return { allocations: [], unallocated: 0, totalAllocated: 0 };

    let remainingCash = totalCash;
    const allocations: {
      monthIdx: number;
      monthCfg: (typeof ACADEMIC_MONTHS)[0];
      year: number;
      label: string;
      previousPaid: number;
      neededToComplete: number;
      allocatedAmount: number;
      newTotalPaid: number;
      newStatus: "PAID" | "PARTIAL";
      gap: number;
    }[] = [];

    // Loop through academic months starting from multiMonthStartIdx
    for (let i = multiMonthStartIdx; i < ACADEMIC_MONTHS.length; i++) {
      if (remainingCash <= 0) break;

      const mCfg = ACADEMIC_MONTHS[i];
      const y = academicStartYear + mCfg.offsetYear;
      const existing = payments.find((p) => p.month === mCfg.month && p.year === y);

      const prevPaid = existing?.amount || 0;
      if (existing?.status === "PAID" && prevPaid >= monthlyRate) {
        // Month already fully paid, proceed to next
        continue;
      }

      const needed = Math.max(0, monthlyRate - prevPaid);
      if (needed <= 0) continue;

      const canGive = Math.min(remainingCash, needed);
      const newTotal = prevPaid + canGive;
      const isComplete = newTotal >= monthlyRate;
      const gap = Math.max(0, monthlyRate - newTotal);

      allocations.push({
        monthIdx: i,
        monthCfg: mCfg,
        year: y,
        label: `${mCfg.fullFr} ${y}`,
        previousPaid: prevPaid,
        neededToComplete: needed,
        allocatedAmount: canGive,
        newTotalPaid: newTotal,
        newStatus: isComplete ? "PAID" : "PARTIAL",
        gap,
      });

      remainingCash -= canGive;
    }

    const totalAllocated = totalCash - remainingCash;

    return {
      allocations,
      unallocated: remainingCash,
      totalAllocated,
    };
  }, [lumpSumAmount, multiMonthStartIdx, payments, academicStartYear, monthlyRate]);

  // 3. SUBMIT MULTI-MONTH PAYMENT
  const handleConfirmMultiMonth = () => {
    if (!isAdmin || isPending) return;
    if (multiMonthPreview.allocations.length === 0) {
      alert("Aucun mois éligible n'a pu être imputé avec ce montant.");
      return;
    }

    const paymentsToProcess = multiMonthPreview.allocations.map((a) => ({
      monthYear: `${MONTHS[a.monthCfg.month - 1]} ${a.year}`,
      amount: a.newTotalPaid,
      isPartial: a.newStatus === "PARTIAL",
      gap: a.gap,
      isRecovery: a.previousPaid > 0,
    }));

    startTransition(async () => {
      const res = await receiveMultipleStudentPayments(
        studentId,
        studentName,
        paymentsToProcess
      );

      if (res.success) {
        // Optimistically update local payments state
        setPayments((prev) => {
          const updated = [...prev];
          multiMonthPreview.allocations.forEach((a) => {
            const existingIdx = updated.findIndex(
              (p) => p.month === a.monthCfg.month && p.year === a.year
            );
            const newRecord: PaymentRecord = {
              id: existingIdx !== -1 ? updated[existingIdx].id : Date.now() + a.monthCfg.month,
              month: a.monthCfg.month,
              year: a.year,
              amount: a.newTotalPaid,
              status: a.newStatus,
              paidAt: new Date(),
              deferredAmount: a.gap,
            };
            if (existingIdx !== -1) {
              updated[existingIdx] = newRecord;
            } else {
              updated.unshift(newRecord);
            }
          });
          return updated;
        });

        setIsMultiMonthModalOpen(false);
      } else {
        alert((res as any)?.error || "Une erreur est survenue lors de l'enregistrement multi-mois.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 1. TOP SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tarif mensuel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Tarif Mensuel
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-slate-800">
                {fmt(monthlyRate)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {customTuition ? "Tarif personnalisé (Bourse)" : "Tarif standard niveau"}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <CreditCard size={22} />
          </div>
        </div>

        {/* Total réglé */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Total Versé
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-emerald-600">
                {fmt(totalPaidThisYear)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {paidMonthsCount}/10 mois réglés
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Reste à régler */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Reste de l&apos;Année
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-2xl font-black ${remainingTuition > 0 ? "text-slate-800" : "text-emerald-600"}`}>
                {fmt(remainingTuition)}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              Sur {fmt(fullYearTuition)} total annuel
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
            <TrendingUp size={22} />
          </div>
        </div>

        {/* Statut actuel */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Statut du Mois
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-lg font-black ${
                isPaid ? "text-emerald-600" : isPartial ? "text-amber-600" : isOverdue ? "text-rose-600" : "text-slate-700"
              }`}>
                {isPaid ? "À jour" : isPartial ? "Partiel" : isOverdue ? "En retard" : "À venir"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {frMonthName} {selectedYear}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
            isPaid 
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : isPartial
              ? "bg-amber-50 border-amber-100 text-amber-600"
              : isOverdue 
              ? "bg-rose-50 border-rose-100 text-rose-600"
              : "bg-slate-50 border-slate-100 text-slate-400"
          }`}>
            {isPaid ? <CheckCircle2 size={22} /> : isPartial ? <Coins size={22} /> : <AlertCircle size={22} />}
          </div>
        </div>
      </div>

      {/* 2. DUAL WORKSTATION: TIMELINE & ACTIONS (7 cols) + HISTORY (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: 10-MONTH TIMELINE & ACTION (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" />
                  <span>Suivi Annuel de Scolarité</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Année académique {academicStartYear}/{academicEndYear} · {paidMonthsCount}/10 mois réglés
                </p>
              </div>

              {/* ACTION: MULTI-MONTH LUMPSUM BUTTON */}
              {isAdmin && remainingTuition > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMultiMonthStartIdx(firstUnpaidIdx);
                    setIsMultiMonthModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer self-start sm:self-auto shrink-0"
                  title="Encaisser un montant libre ventilé sur plusieurs mois"
                >
                  <Coins size={15} />
                  <span>Versement Libre / Multi-Mois</span>
                </button>
              )}
            </div>

            {/* 10-Month Timeline Pills */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-4">
              {ACADEMIC_MONTHS.map((m, idx) => {
                const mYear = academicStartYear + m.offsetYear;
                const pRec = payments.find((p) => p.month === m.month && p.year === mYear);
                const isPRecPaid = pRec?.status === "PAID";
                const isPRecPartial = pRec?.status === "PARTIAL";

                const isPastOrCur =
                  mYear < currentCalYear ||
                  (mYear === currentCalYear && m.month <= currentCalMonth);
                const isOverdueRec = !isPRecPaid && !isPRecPartial && isPastOrCur;

                const isSelected = idx === selectedIdx;

                let pillColor = "bg-slate-50 border-slate-200/80 text-slate-400";
                if (isPRecPaid) {
                  pillColor = "bg-emerald-500 border-emerald-600 text-white font-black shadow-xs";
                } else if (isPRecPartial) {
                  pillColor = "bg-amber-400 border-amber-500 text-amber-950 font-black shadow-xs";
                } else if (isOverdueRec) {
                  pillColor = "bg-rose-50 border-rose-200 text-rose-600 font-bold";
                }

                return (
                  <button
                    key={m.labelFr}
                    type="button"
                    onClick={() => {
                      setSelectedIdx(idx);
                      setSinglePaymentType("FULL");
                      setSingleAmountInput("");
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl border transition-all cursor-pointer relative ${pillColor} ${
                      isSelected ? "ring-2 ring-blue-600 ring-offset-2 scale-105" : "hover:scale-102"
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wider font-extrabold leading-none">
                      {m.labelFr}
                    </span>
                    <span className="text-[9px] mt-1 opacity-90 leading-none">
                      {isPRecPaid ? "✓" : isPRecPartial ? `${pRec.amount} DT` : "·"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Payé (Soldé)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Partiel (Avance)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span>En retard</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span>À venir</span>
              </span>
            </div>
          </div>

          {/* DETAIL & ACTION CARD FOR SELECTED MONTH */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col gap-5">
            {/* Stepper Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedIdx((prev) => Math.max(0, prev - 1));
                  setSinglePaymentType("FULL");
                  setSingleAmountInput("");
                }}
                disabled={selectedIdx === 0}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronLeft size={16} />
              </button>

              <div className="text-center">
                <h4 className="text-base font-bold text-slate-800 flex items-center justify-center gap-2">
                  <span>{frMonthName} {selectedYear}</span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isPaid
                      ? "bg-emerald-100 text-emerald-800"
                      : isPartial
                      ? "bg-amber-100 text-amber-800"
                      : isOverdue
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {isPaid ? "RÉGLÉ" : isPartial ? "PARTIEL" : isOverdue ? "EN RETARD" : "À VENIR"}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Frais de scolarité : {fmt(monthlyRate)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedIdx((prev) => Math.min(ACADEMIC_MONTHS.length - 1, prev + 1));
                  setSinglePaymentType("FULL");
                  setSingleAmountInput("");
                }}
                disabled={selectedIdx === ACADEMIC_MONTHS.length - 1}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Status Body: PAID */}
            {isPaid ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Frais de scolarité intégralement réglés pour {frMonthName}
                    </span>
                    <span className="text-[11px] text-emerald-700 block mt-0.5">
                      Montant total perçu : {fmt(currentPayment?.amount || monthlyRate)}
                      {currentPayment?.paidAt ? ` le ${formatDate(currentPayment.paidAt)}` : ""}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block text-xs sm:text-sm font-extrabold px-3 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-700 shadow-2xs">
                    {fmt(currentPayment?.amount || monthlyRate)}
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-600 mt-1">
                    Soldé
                  </span>
                </div>
              </div>
            ) : isPartial ? (
              /* Status Body: PARTIAL (e.g. 40 DT already paid, 410 DT remaining) */
              <div className="flex flex-col gap-4">
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                        <Coins size={20} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-amber-950 block">
                          Paiement partiel enregistré pour {frMonthName}
                        </span>
                        <span className="text-[11px] text-amber-800 block mt-0.5">
                          Déjà réglé : <strong>{fmt(currentAmountPaid)}</strong> sur <strong>{fmt(monthlyRate)}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold text-amber-900 block">Reste dû</span>
                      <span className="text-sm font-black text-amber-700 block">
                        {fmt(currentRemainingDue)}
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-amber-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, Math.round((currentAmountPaid / monthlyRate) * 100))}%` }}
                    />
                  </div>
                </div>

                {/* Completing the partial payment */}
                {isAdmin && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-3">
                    <span className="text-xs font-bold text-slate-700 block">
                      Régulariser ou compléter le solde de ce mois
                    </span>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative flex-1 min-w-[140px]">
                        <input
                          type="number"
                          value={singleAmountInput !== "" ? singleAmountInput : String(currentRemainingDue)}
                          onChange={(e) => setSingleAmountInput(e.target.value)}
                          placeholder={`Montant (max ${currentRemainingDue})`}
                          max={currentRemainingDue}
                          min={1}
                          className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                          DT
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const val = singleAmountInput !== "" ? parseFloat(singleAmountInput) : currentRemainingDue;
                          handleCollectSingleMonth(val);
                        }}
                        disabled={isPending}
                        className="py-2 px-4 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Banknote size={14} />
                        <span>
                          {isPending
                            ? "En cours..."
                            : singleAmountInput !== "" && parseFloat(singleAmountInput) < currentRemainingDue
                            ? `Verser ${parseFloat(singleAmountInput) || 0} DT (Complément)`
                            : `Régulariser & Solder (${fmt(currentRemainingDue)})`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Status Body: UNPAID (Option to pay full month OR partial e.g. 40 DT) */
              <div className="flex flex-col gap-4">
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                  isOverdue 
                    ? "bg-rose-50/70 border-rose-200 text-rose-950" 
                    : "bg-slate-50 border-slate-200 text-slate-800"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isOverdue 
                        ? "bg-rose-100 border-rose-200 text-rose-600" 
                        : "bg-slate-200 border-slate-300 text-slate-500"
                    }`}>
                      {isOverdue ? <AlertCircle size={20} /> : <Clock size={20} />}
                    </div>
                    <div>
                      <span className="text-xs font-bold block">
                        Paiement en attente pour {frMonthName}
                      </span>
                      <span className="text-[11px] text-slate-500 block mt-0.5">
                        Tarif complet du mois : {fmt(monthlyRate)}
                      </span>
                    </div>
                  </div>

                  <span className="text-sm font-black">
                    {fmt(monthlyRate)}
                  </span>
                </div>

                {isAdmin && (
                  <div className="flex flex-col gap-3 p-4 bg-slate-50 border border-slate-200/80 rounded-2xl">
                    {/* Payment Mode Selector */}
                    <div className="flex items-center gap-2" role="tablist">
                      <button
                        type="button"
                        onClick={() => {
                          setSinglePaymentType("FULL");
                          setSingleAmountInput("");
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          singlePaymentType === "FULL"
                            ? "bg-emerald-600 text-white shadow-2xs"
                            : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                        }`}
                      >
                        Mois complet ({fmt(monthlyRate)})
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setSinglePaymentType("PARTIAL");
                          setSingleAmountInput("40");
                        }}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          singlePaymentType === "PARTIAL"
                            ? "bg-amber-500 text-slate-900 shadow-2xs font-extrabold"
                            : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100"
                        }`}
                      >
                        Paiement Partiel (Avance)
                      </button>
                    </div>

                    {/* Mode: PARTIAL PAYMENT INPUT */}
                    {singlePaymentType === "PARTIAL" ? (
                      <div className="flex flex-col gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 block mb-1">
                            Montant versé par le parent (ex: 40 DT sur les {monthlyRate} DT) :
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              value={singleAmountInput}
                              onChange={(e) => setSingleAmountInput(e.target.value)}
                              placeholder="Montant en DT (ex: 40)"
                              max={monthlyRate - 1}
                              min={1}
                              className="w-full bg-white border border-slate-300 rounded-xl pl-3 pr-10 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                              DT
                            </span>
                          </div>
                        </div>

                        {/* Quick preset chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-semibold">Suggestions :</span>
                          {[40, 50, 100, 200].map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => setSingleAmountInput(String(preset))}
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 transition-colors cursor-pointer"
                            >
                              {preset} DT
                            </button>
                          ))}
                        </div>

                        {/* Live calculation notice */}
                        {parseFloat(singleAmountInput) > 0 && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                            <span>
                              Versé : <strong>{parseFloat(singleAmountInput)} DT</strong> · Reste dû :{" "}
                              <strong>{Math.max(0, monthlyRate - parseFloat(singleAmountInput))} DT</strong>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 text-amber-800">
                              Partiel
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCollectSingleMonth(parseFloat(singleAmountInput) || 0)}
                          disabled={isPending || !parseFloat(singleAmountInput)}
                          className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-900 font-extrabold text-xs rounded-xl transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-1"
                        >
                          <Coins size={15} />
                          <span>
                            {isPending
                              ? "Enregistrement..."
                              : `Encaisser ${parseFloat(singleAmountInput) || 0} DT (Paiement Partiel)`}
                          </span>
                        </button>
                      </div>
                    ) : (
                      /* Mode: FULL PAYMENT */
                      <button
                        type="button"
                        onClick={() => handleCollectSingleMonth(monthlyRate)}
                        disabled={isPending}
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer mt-1"
                      >
                        <Banknote size={16} />
                        <span>
                          {isPending
                            ? "Traitement en cours..."
                            : `Encaisser la scolarité complète (${fmt(monthlyRate)})`}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: PAYMENT HISTORY (5 COLS) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-slate-600" />
                <h3 className="text-base font-bold text-slate-800">
                  Historique des Règlements
                </h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {payments.length} versement{payments.length > 1 ? "s" : ""}
              </span>
            </div>

            <div className="flex flex-col gap-2.5 max-h-[440px] overflow-y-auto pr-1 custom-scrollbar">
              {payments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs italic">
                  Aucun règlement enregistré pour cette année scolaire.
                </div>
              ) : (
                [...payments]
                  .sort((a, b) => b.year - a.year || b.month - a.month)
                  .map((p) => {
                    const monthCfg = ACADEMIC_MONTHS.find((c) => c.month === p.month);
                    const pMonthLabel = monthCfg
                      ? `${monthCfg.fullFr} ${p.year}`
                      : `${MONTHS[p.month - 1] || `Mois ${p.month}`} ${p.year}`;

                    const isPPart = p.status === "PARTIAL";

                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-800 block">
                              {pMonthLabel}
                            </span>
                            {isPPart && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                Partiel ({p.amount}/{monthlyRate} DT)
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Reçu le {formatDate(p.paidAt)}
                          </span>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span className={`text-xs font-black ${isPPart ? "text-amber-700" : "text-emerald-700"}`}>
                            {fmt(p.amount)}
                          </span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                            p.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {p.status === "PAID" ? "PAYÉ" : "PARTIEL"}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MULTI-MONTH LUMPSUM ALLOCATION MODAL */}
      {isMultiMonthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-5 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Versement Libre & Répartition Multi-Mois
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ventilation automatique sur les mois impayés de l&apos;année
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMultiMonthModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1 custom-scrollbar">
              {/* Input Amount */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Montant total versé par le parent :
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={lumpSumAmount}
                    onChange={(e) => setLumpSumAmount(e.target.value)}
                    placeholder="Ex: 1000"
                    min={1}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-12 py-3 text-lg font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-slate-400 pointer-events-none">
                    DT
                  </span>
                </div>

                {/* Quick amount suggestions */}
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  <span className="text-[11px] text-slate-400 font-semibold">Montants rapides :</span>
                  {[
                    monthlyRate,
                    monthlyRate * 2,
                    1000,
                    monthlyRate * 3,
                    remainingTuition,
                  ].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setLumpSumAmount(String(amt))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                        lumpSumAmount === String(amt)
                          ? "bg-emerald-600 text-white shadow-2xs"
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      }`}
                    >
                      {amt === remainingTuition ? `Solder l'année (${fmt(amt)})` : fmt(amt)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Starting Month Selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Commencer l&apos;imputation à partir du mois :
                </label>
                <select
                  value={multiMonthStartIdx}
                  onChange={(e) => setMultiMonthStartIdx(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {ACADEMIC_MONTHS.map((m, idx) => {
                    const y = academicStartYear + m.offsetYear;
                    const p = payments.find((rec) => rec.month === m.month && rec.year === y);
                    const statusText = p?.status === "PAID" ? " (Déjà payé)" : p?.status === "PARTIAL" ? ` (Partiel ${p.amount} DT)` : "";
                    return (
                      <option key={m.labelFr} value={idx}>
                        {m.fullFr} {y}{statusText}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Live Allocation Breakdown */}
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-600" />
                    <span>Répartition automatique calculée :</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-700">
                    Total alloué : {fmt(multiMonthPreview.totalAllocated)}
                  </span>
                </div>

                {multiMonthPreview.allocations.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                    Saisissez un montant pour voir la répartition sur les mois
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 divide-y divide-slate-100 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3">
                    {multiMonthPreview.allocations.map((alloc, aIdx) => (
                      <div key={alloc.monthCfg.labelFr} className={`flex items-center justify-between py-2 text-xs ${aIdx > 0 ? "pt-2" : ""}`}>
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                            alloc.newStatus === "PAID"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}>
                            {alloc.newStatus === "PAID" ? "✓" : "½"}
                          </div>
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {alloc.label}
                            </span>
                            {alloc.previousPaid > 0 && (
                              <span className="text-[10px] text-slate-400 block">
                                (Déjà versé : {alloc.previousPaid} DT + {alloc.allocatedAmount} DT)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="font-black text-slate-800">
                              {fmt(alloc.allocatedAmount)}
                            </span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                              alloc.newStatus === "PAID"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}>
                              {alloc.newStatus === "PAID" ? "SOLDÉ" : "PARTIEL"}
                            </span>
                          </div>
                          {alloc.newStatus === "PARTIAL" && (
                            <span className="text-[10px] text-amber-700 font-bold block mt-0.5">
                              Reste dû : {fmt(alloc.gap)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Unallocated Surplus */}
                    {multiMonthPreview.unallocated > 0 && (
                      <div className="pt-2 text-xs text-blue-700 bg-blue-50/50 p-2 rounded-xl flex items-center justify-between mt-1">
                        <span>Surplus non alloué (année complète soldée) :</span>
                        <span className="font-black">{fmt(multiMonthPreview.unallocated)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsMultiMonthModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Annuler
              </button>

              <button
                type="button"
                onClick={handleConfirmMultiMonth}
                disabled={isPending || multiMonthPreview.allocations.length === 0}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 size={16} />
                <span>
                  {isPending
                    ? "Enregistrement..."
                    : `Valider l'encaissement (${fmt(multiMonthPreview.totalAllocated)})`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
