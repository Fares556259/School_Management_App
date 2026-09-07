"use client";

import { useState, useTransition, useMemo } from "react";
import { payStaffSalary } from "../actions";
import { MONTHS } from "@/lib/dateUtils";
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  Banknote, 
  CreditCard,
  Sparkles,
  RotateCcw
} from "lucide-react";

interface PaymentRecord {
  id?: number;
  month: number;
  year: number;
  status: string;
  amount: number;
  paidAt?: Date | string | null;
  deferredAmount?: number | null;
}

interface StaffSalaryTrackerProps {
  staffId: string;
  staffName: string;
  salary: number;
  payments: PaymentRecord[];
  isAdmin: boolean;
  selectedMonth?: { month: number; year: number };
  onSelectMonth?: (month: number, year: number) => void;
  onPaymentsChange?: (updatedPayments: PaymentRecord[]) => void;
}

const MONTH_NAMES_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export default function StaffSalaryTracker({
  staffId,
  staffName,
  salary,
  payments: initialPayments,
  isAdmin,
  selectedMonth: externalSelectedMonth,
  onSelectMonth,
  onPaymentsChange,
}: StaffSalaryTrackerProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>(initialPayments);

  // Sync if initialPayments prop changes
  useMemo(() => {
    setPayments(initialPayments);
  }, [initialPayments]);

  const now = new Date();
  const [internalMonth, setInternalMonth] = useState({
    month: now.getMonth() + 1, // 1-based
    year: now.getFullYear(),
  });

  const currentMonth = externalSelectedMonth || internalMonth;

  const [isPending, startTransition] = useTransition();
  const [isAdvanceInputOpen, setIsAdvanceInputOpen] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState<string>("");
  const [actionError, setActionError] = useState<string | null>(null);

  const changeMonth = (delta: number) => {
    let nextM = currentMonth.month + delta;
    let nextY = currentMonth.year;
    if (nextM > 12) {
      nextM = 1;
      nextY++;
    } else if (nextM < 1) {
      nextM = 12;
      nextY--;
    }

    if (onSelectMonth) {
      onSelectMonth(nextM, nextY);
    } else {
      setInternalMonth({ month: nextM, year: nextY });
    }
    setIsAdvanceInputOpen(false);
    setActionError(null);
  };

  // Find payment for current month
  const currentPayment = useMemo(() => {
    return payments.find(
      (p) => p.month === currentMonth.month && p.year === currentMonth.year
    );
  }, [payments, currentMonth]);

  const isPaid = currentPayment?.status === "PAID";
  const isPartial = currentPayment?.status === "PARTIAL";
  const existingAdvance = isPartial ? currentPayment?.amount || 0 : 0;
  const balanceToPay = isPaid ? 0 : Math.max(0, salary - existingAdvance);

  const monthLabelFr = `${MONTH_NAMES_FR[currentMonth.month - 1]} ${currentMonth.year}`;
  const monthKeyServer = `${MONTHS[currentMonth.month - 1]} ${currentMonth.year}`;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  // Action: Pay remaining balance or full salary
  const handlePayFullOrRemaining = () => {
    if (!isAdmin || isPending || isPaid || balanceToPay <= 0) return;
    setActionError(null);

    startTransition(async () => {
      const result = await payStaffSalary(
        staffId,
        staffName,
        balanceToPay,
        monthKeyServer,
        false // Not an advance, it completes the salary
      );

      if (result.success) {
        const updated: PaymentRecord[] = [
          ...payments.filter((p) => !(p.month === currentMonth.month && p.year === currentMonth.year)),
          {
            id: currentPayment?.id || Date.now(),
            month: currentMonth.month,
            year: currentMonth.year,
            status: "PAID",
            amount: salary,
            paidAt: new Date(),
          },
        ];
        setPayments(updated);
        if (onPaymentsChange) onPaymentsChange(updated);
        setIsAdvanceInputOpen(false);
      } else {
        setActionError(result.error || "Erreur lors du paiement");
      }
    });
  };

  // Action: Pay advance
  const handlePayAdvance = () => {
    const amt = parseFloat(advanceAmount);
    if (!isAdmin || isPending || isPaid || isNaN(amt) || amt <= 0) return;

    if (amt >= balanceToPay) {
      // If advance covers full balance, pay full instead
      handlePayFullOrRemaining();
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const result = await payStaffSalary(
        staffId,
        staffName,
        amt,
        monthKeyServer,
        true // Advance
      );

      if (result.success) {
        const newTotalAmt = existingAdvance + amt;
        const updated: PaymentRecord[] = [
          ...payments.filter((p) => !(p.month === currentMonth.month && p.year === currentMonth.year)),
          {
            id: currentPayment?.id || Date.now(),
            month: currentMonth.month,
            year: currentMonth.year,
            status: "PARTIAL",
            amount: newTotalAmt,
            paidAt: new Date(),
          },
        ];
        setPayments(updated);
        if (onPaymentsChange) onPaymentsChange(updated);
        setAdvanceAmount("");
        setIsAdvanceInputOpen(false);
      } else {
        setActionError(result.error || "Erreur lors du versement de l'acompte");
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CreditCard size={18} className="text-indigo-600" />
            <span>Gestion des Rémunérations & Acomptes</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Suivez et réglez les salaires et acomptes mois par mois
          </p>
        </div>

        {/* Month navigator */}
        <div className="flex items-center bg-slate-100/90 p-1 rounded-xl border border-slate-200/60 shadow-2xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => changeMonth(-1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Mois précédent"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 py-1 font-bold text-slate-800 text-xs min-w-[130px] text-center">
            {monthLabelFr}
          </span>
          <button
            type="button"
            onClick={() => changeMonth(1)}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Mois suivant"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Main card breakdown */}
      <div className="bg-slate-50/70 rounded-xl p-4 sm:p-5 border border-slate-100 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Banknote size={20} />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Mois évalué</p>
              <h3 className="text-sm font-bold text-slate-800">{monthLabelFr}</h3>
            </div>
          </div>

          <div>
            {isPaid ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span>Mois Soldé ✓</span>
              </span>
            ) : isPartial ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                <TrendingUp size={14} className="text-purple-600" />
                <span>Acompte en cours</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <AlertCircle size={14} className="text-rose-600" />
                <span>Non payé</span>
              </span>
            )}
          </div>
        </div>

        {/* 3 Detail columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-400 block mb-1">Salaire contractuel</span>
            <span className="text-base font-black text-slate-800">{fmt(salary)}</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <span className="text-[11px] font-semibold text-purple-600 block mb-1">Acomptes déjà versés</span>
            <span className="text-base font-black text-purple-700">
              {isPaid ? fmt(existingAdvance) : isPartial ? fmt(existingAdvance) : "0 DT"}
            </span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200/70">
            <span className={`text-[11px] font-semibold block mb-1 ${balanceToPay > 0 ? "text-rose-600" : "text-emerald-600"}`}>
              Reste à régler
            </span>
            <span className={`text-base font-black ${balanceToPay > 0 ? "text-rose-700" : "text-emerald-700"}`}>
              {fmt(balanceToPay)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Zone */}
      {isAdmin && (
        <div>
          {isPaid ? (
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="font-semibold">
                  Le salaire de {monthLabelFr} a été entièrement versé.
                </span>
              </div>
              {currentPayment?.paidAt && (
                <span className="text-emerald-600 text-[11px]">
                  Régle le {new Date(currentPayment.paidAt).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Primary action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handlePayFullOrRemaining}
                  disabled={isPending || balanceToPay <= 0}
                  className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Banknote size={16} />
                  <span>
                    {isPending
                      ? "Traitement..."
                      : isPartial
                      ? `Solder le reste (${fmt(balanceToPay)})`
                      : `Régler le salaire complet (${fmt(salary)})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAdvanceInputOpen((prev) => !prev)}
                  disabled={isPending || balanceToPay <= 0}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 hover:border-indigo-300 bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs shadow-2xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <TrendingUp size={15} className="text-purple-600" />
                  <span>{isAdvanceInputOpen ? "Masquer l'avance" : "Verser un acompte..."}</span>
                </button>
              </div>

              {/* Inline advance drawer */}
              {isAdvanceInputOpen && (
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-all animate-in fade-in duration-200">
                  <div className="flex-1 min-w-[200px] w-full sm:w-auto">
                    <label className="block text-[11px] font-bold text-purple-900 mb-1">
                      Montant de l&apos;acompte (Max : {fmt(balanceToPay)})
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        placeholder="Ex : 200"
                        value={advanceAmount}
                        max={balanceToPay}
                        onChange={(e) => setAdvanceAmount(e.target.value)}
                        className="w-full pl-3 pr-10 py-1.5 text-xs bg-white border border-purple-200 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-bold text-purple-950"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        DT
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto self-end">
                    <button
                      type="button"
                      onClick={handlePayAdvance}
                      disabled={isPending || !advanceAmount || parseFloat(advanceAmount) <= 0}
                      className="py-2 px-4 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {isPending ? "Traitement..." : "Confirmer l'acompte"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAdvanceInputOpen(false);
                        setAdvanceAmount("");
                      }}
                      className="py-2 px-3 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold cursor-pointer"
                    >
                      Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
