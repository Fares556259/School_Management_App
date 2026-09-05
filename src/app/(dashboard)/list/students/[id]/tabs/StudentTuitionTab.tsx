"use client";

import { useState, useTransition } from "react";
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
  TrendingUp
} from "lucide-react";
import { receiveStudentPayment } from "../actions";
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

  // Selected Month Index in 10-month array (default to current academic month)
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

  // Payment Handler
  const handleCollectTuition = () => {
    if (!isAdmin || isPending || isPaid) return;

    const monthStr = `${MONTHS[selectedMonth - 1]} ${selectedYear}`;

    startTransition(async () => {
      const res = await receiveStudentPayment(
        studentId,
        studentName,
        monthlyRate,
        monthStr
      );

      if (res.success) {
        const newRecord: PaymentRecord = {
          id: (res.data as any)?.id || Date.now(),
          month: selectedMonth,
          year: selectedYear,
          amount: monthlyRate,
          status: "PAID",
          paidAt: new Date(),
        };

        setPayments((prev) => {
          const filtered = prev.filter(
            (p) => !(p.month === selectedMonth && p.year === selectedYear)
          );
          return [newRecord, ...filtered];
        });
      } else {
        alert(res.error || "Une erreur est survenue lors du paiement.");
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
                isPaid ? "text-emerald-600" : isOverdue ? "text-rose-600" : "text-slate-700"
              }`}>
                {isPaid ? "À jour" : isOverdue ? "En retard" : "À venir"}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium block mt-0.5">
              {frMonthName} {selectedYear}
            </span>
          </div>
          <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
            isPaid 
              ? "bg-emerald-50 border-emerald-100 text-emerald-600"
              : isOverdue 
              ? "bg-rose-50 border-rose-100 text-rose-600"
              : "bg-slate-50 border-slate-100 text-slate-400"
          }`}>
            {isPaid ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
          </div>
        </div>
      </div>

      {/* 2. DUAL WORKSTATION: TIMELINE (7 cols) + HISTORY (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: 10-MONTH TIMELINE & ACTION (7 COLS) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" />
                  <span>Suivi Annuel de Scolarité</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Année académique {academicStartYear}/{academicEndYear} · {paidMonthsCount}/10 mois réglés
                </p>
              </div>
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
                    onClick={() => setSelectedIdx(idx)}
                    className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-xl border transition-all cursor-pointer relative ${pillColor} ${
                      isSelected ? "ring-2 ring-blue-600 ring-offset-2 scale-105" : "hover:scale-102"
                    }`}
                  >
                    <span className="text-[11px] uppercase tracking-wider font-extrabold leading-none">
                      {m.labelFr}
                    </span>
                    <span className="text-[9px] mt-1 opacity-90 leading-none">
                      {isPRecPaid ? "✓" : isPRecPartial ? "½" : "·"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Payé</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span>Partiel</span>
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
                onClick={() => setSelectedIdx((prev) => Math.max(0, prev - 1))}
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
                      : isOverdue
                      ? "bg-rose-100 text-rose-800"
                      : "bg-slate-100 text-slate-600"
                  }`}>
                    {isPaid ? "RÉGLÉ" : isOverdue ? "EN RETARD" : "À VENIR"}
                  </span>
                </h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Frais de scolarité : {fmt(monthlyRate)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedIdx((prev) => Math.min(ACADEMIC_MONTHS.length - 1, prev + 1))}
                disabled={selectedIdx === ACADEMIC_MONTHS.length - 1}
                className="w-8 h-8 rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Status Body */}
            {isPaid ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-emerald-900 shadow-2xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Frais de scolarité réglés pour {frMonthName}
                    </span>
                    <span className="text-[11px] text-emerald-700 block mt-0.5">
                      Montant reçu : {fmt(currentPayment?.amount || monthlyRate)}
                      {currentPayment?.paidAt ? ` le ${formatDate(currentPayment.paidAt)}` : ""}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="inline-block text-xs sm:text-sm font-extrabold px-3 py-1 bg-white rounded-lg border border-emerald-200 text-emerald-700 shadow-2xs">
                    {fmt(currentPayment?.amount || monthlyRate)}
                  </span>
                  <span className="block text-[10px] font-bold text-emerald-600 mt-1">
                    Encaissé
                  </span>
                </div>
              </div>
            ) : (
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
                        Montant à encaisser : {fmt(monthlyRate)}
                      </span>
                    </div>
                  </div>

                  <span className="text-sm font-black">
                    {fmt(monthlyRate)}
                  </span>
                </div>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleCollectTuition}
                    disabled={isPending}
                    className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Banknote size={16} />
                    <span>{isPending ? "Traitement en cours..." : `Encaisser la scolarité (${fmt(monthlyRate)})`}</span>
                  </button>
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

            <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
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
                            Reçu le {formatDate(p.paidAt)}
                          </span>
                        </div>

                        <div className="text-right flex items-center gap-2">
                          <span className="text-xs font-black text-emerald-700">
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
    </div>
  );
}
