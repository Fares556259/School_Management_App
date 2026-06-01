"use client";
import { getSchoolYearMonths, isMonthBefore, getMonthKey, MONTHS } from "@/lib/dateUtils";
import { Payment } from "@prisma/client";
import { Check, X, AlertCircle } from "lucide-react";

/**
 * A sleek, horizontal stepper UI showing the payment timeline for the academic year.
 * Designed to span the full width of a modal or card.
 */
export default function PaymentTimeline({
  payments,
  selectedMonthKey,
}: {
  payments: Payment[];
  selectedMonthKey?: string;
}) {
  const now = new Date();
  const paidMonths = new Map<string, "PAID" | "PARTIAL">();
  
  payments.forEach((p) => {
    if ((p.status === "PAID" || p.status === "PARTIAL") && p.month > 0 && p.month <= 12) {
      paidMonths.set(`${MONTHS[p.month - 1]} ${p.year}`, p.status as any);
    }
  });

  const schoolMonths = getSchoolYearMonths(now);
  const currentMonthKey = getMonthKey(undefined);

  const months = schoolMonths.map((monthKey) => {
    const paymentStatus = paidMonths.get(monthKey);
    const [mName] = monthKey.split(" ");
    const short = mName.substring(0, 3);
    
    const isPast = isMonthBefore(monthKey, currentMonthKey);
    const isCurrent = monthKey === currentMonthKey;
    
    let status = "upcoming";
    if (paymentStatus === "PAID") status = "paid";
    else if (paymentStatus === "PARTIAL") status = "partial";
    else if (isPast || isCurrent) status = "unpaid";

    return { key: monthKey, short, status };
  });

  return (
    <div className="w-full py-2">
      {/* TOP ROW: MONTH NAMES & CURRENT INDICATOR */}
      <div className="flex justify-between items-end mb-4 px-1">
        {months.map((m) => {
          const isCurrent = m.key === currentMonthKey;
          return (
            <div key={`label-${m.key}`} className="w-10 text-center relative flex flex-col items-center">
              {isCurrent && (
                <div className="absolute -top-4 text-[9px] font-bold text-indigo-500 uppercase tracking-widest">
                  Now
                </div>
              )}
              <span className={`text-[12px] ${
                isCurrent 
                  ? 'font-bold text-indigo-600' 
                  : m.status === 'upcoming' 
                    ? 'font-medium text-[#a1a1aa]' 
                    : 'font-semibold text-[#41454d]'
              }`}>
                {m.short}
              </span>
            </div>
          );
        })}
      </div>

      {/* MIDDLE ROW: TIMELINE NODES & CONNECTING LINES */}
      <div className="relative flex items-center justify-between w-full px-1 py-1">
        {/* Background connecting lines (segmented) */}
        <div className="absolute left-[20px] right-[20px] top-1/2 h-[2px] -translate-y-1/2 z-0 flex">
          {months.slice(0, -1).map((m, idx) => {
            const nextM = months[idx + 1];
            // Line is green if both current and next month are paid
            const isGreen = m.status === "paid" && nextM.status === "paid";
            return (
              <div 
                key={`line-${m.key}`} 
                className={`flex-1 h-full transition-colors ${isGreen ? 'bg-emerald-500' : 'bg-[#e2e8f0]'}`} 
              />
            );
          })}
        </div>
        
        {/* Nodes */}
        {months.map((m) => {
          const isSelected = m.key === selectedMonthKey;
          return (
            <div key={`node-${m.key}`} className="relative z-10 w-10 flex justify-center group" title={`${m.key}: ${m.status}`}>
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ring-[5px] ring-[#f8fafc] transition-transform ${
                  isSelected ? "scale-125" : "group-hover:scale-110"
                } ${
                  m.status === "paid"
                    ? "bg-emerald-500 text-white shadow-sm"
                    : m.status === "partial"
                      ? "bg-orange-500 text-white shadow-sm"
                      : m.status === "unpaid"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "bg-white border-2 border-[#e2e8f0]"
                }`}
              >
                {m.status === "paid" && <Check size={12} strokeWidth={4} />}
                {m.status === "partial" && <AlertCircle size={12} strokeWidth={3} />}
                {m.status === "unpaid" && <X size={12} strokeWidth={4} />}
                {m.status === "upcoming" && <div className="w-1.5 h-1.5 rounded-full bg-[#e2e8f0]" />}
              </div>
            </div>
          );
        })}
      </div>

      {/* BOTTOM ROW: STATUS LABELS (PILLS) */}
      <div className="flex justify-between items-start mt-4 px-1">
        {months.map((m) => (
          <div key={`status-${m.key}`} className="w-10 flex justify-center">
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md whitespace-nowrap ${
              m.status === "paid"
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : m.status === "partial"
                  ? "bg-orange-50 text-orange-600 border border-orange-100"
                  : m.status === "unpaid"
                    ? "bg-rose-50 text-rose-600 border border-rose-100"
                    : "bg-slate-50 text-slate-400 border border-slate-100"
            }`}>
              {m.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
