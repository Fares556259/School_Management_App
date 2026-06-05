"use client";
import { getSchoolYearMonths, isMonthBefore, getMonthKey, MONTHS } from "@/lib/dateUtils";
import { Payment } from "@prisma/client";
import { Check, X, AlertCircle } from "lucide-react";
import { getReceiptContext } from "@/lib/receiptActions";

/**
 * A sleek, horizontal stepper UI showing the payment timeline for the academic year.
 * Designed to span the full width of a modal or card.
 */
export default function PaymentTimeline({
  payments,
  selectedMonthKey,
  student,
  schoolName,
  adminName,
}: {
  payments: Payment[];
  selectedMonthKey?: string;
  student?: any;
  schoolName?: string;
  adminName?: string;
}) {
  const now = new Date();
  const paidPayments = new Map<string, Payment>();
  
  payments.forEach((p) => {
    if ((p.status === "PAID" || p.status === "PARTIAL") && p.month > 0 && p.month <= 12) {
      paidPayments.set(`${MONTHS[p.month - 1]} ${p.year}`, p);
    }
  });

  const schoolMonths = getSchoolYearMonths(now);
  const currentMonthKey = getMonthKey(undefined);

  const months = schoolMonths.map((monthKey) => {
    const payment = paidPayments.get(monthKey);
    const [mName] = monthKey.split(" ");
    const short = mName.substring(0, 3);
    
    const isPast = isMonthBefore(monthKey, currentMonthKey);
    const isCurrent = monthKey === currentMonthKey;
    
    let status = "upcoming";
    if (payment?.status === "PAID") status = "paid";
    else if (payment?.status === "PARTIAL") status = "partial";
    else if (isPast || isCurrent) status = "unpaid";

    return { key: monthKey, short, status, payment };
  });

  const handleDownloadReceipt = async (payment: Payment, monthKey: string) => {
    if (!student) return;
    const { jsPDF } = await import("jspdf");
    const { schoolName, adminName } = await getReceiptContext();
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(24, 29, 38);
    doc.text("REÇU DE PAIEMENT", 105, 33, { align: "center" });
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");

    // Receipt No & Date
    const receiptNo = (payment.id || Math.floor(Math.random() * 900000) + 100000).toString().padStart(6, "0");
    const dateStr = new Intl.DateTimeFormat("fr-FR").format(new Date(payment.paidAt || new Date()));
    
    // Draw fields
    doc.setFont("helvetica", "bold");
    doc.text("N° de reçu : ", 20, 50);
    doc.setFont("helvetica", "normal");
    doc.text(receiptNo, 50, 50);
    doc.setDrawColor(180, 180, 180);
    doc.line(48, 51, 90, 51); // underline

    doc.setFont("helvetica", "bold");
    doc.text("Date : ", 120, 50);
    doc.setFont("helvetica", "normal");
    doc.text(dateStr, 135, 50);
    doc.line(133, 51, 190, 51); // underline

    // Dynamic info
    const parentName = student.parent ? `${student.parent.name} ${student.parent.surname}` : "____________________";
    const studentName = `${student.name} ${student.surname}`;
    const amountStr = payment.amount ? `${payment.amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} TND` : "______________ TND";
    
    // Format month for French display (e.g. "Sep 2026" -> "Septembre 2026")
    const [mName, yStr] = monthKey.split(" ");
    const frenchMonths: Record<string, string> = { "Jan": "Janvier", "Feb": "Février", "Mar": "Mars", "Apr": "Avril", "May": "Mai", "Jun": "Juin", "Jul": "Juillet", "Aug": "Août", "Sep": "Septembre", "Oct": "Octobre", "Nov": "Novembre", "Dec": "Décembre" };
    const frenchMonth = frenchMonths[mName] || mName;
    const paymentFor = `Frais de scolarité - ${frenchMonth} ${yStr}`;

    const addField = (label: string, value: string, yPos: number, xOffset = 60, lineEnd = 190) => {
      doc.setFont("helvetica", "bold");
      doc.text(label, 20, yPos);
      doc.setFont("helvetica", "normal");
      doc.text(value, xOffset, yPos);
      doc.setDrawColor(200, 200, 200);
      doc.line(xOffset - 2, yPos + 2, lineEnd, yPos + 2);
    };

    addField("Reçu de (Parent) : ", parentName, 75);
    addField("Nom de l'élève : ", studentName, 95);
    addField("Montant payé : ", amountStr, 115);
    addField("Motif du paiement : ", paymentFor, 135);
    addField("Reçu par : ", adminName || "Administration", 155);

    // Signatures at the bottom
    doc.setFont("helvetica", "bold");
    doc.text("Signature du parent :", 20, 205);
    doc.line(65, 206, 100, 206);

    doc.text("Cachet de l'école :", 120, 205);
    doc.line(155, 206, 190, 206);

    // Save PDF
    doc.save(`Recu-${receiptNo}.pdf`);
  };

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
              <div className="flex flex-col items-center gap-1">
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
                
                {/* Download Button for Paid/Partial */}
                {(m.status === "paid" || m.status === "partial") && m.payment && (
                  <button 
                    onClick={() => handleDownloadReceipt(m.payment!, m.key)}
                    className="flex items-center gap-1 text-[9px] text-[#1b61c9] hover:underline mt-1 font-medium bg-[#f8fafc] border border-[#dddddd] px-1.5 py-0.5 rounded-md"
                    title="Download Receipt"
                  >
                    <span>Download</span>
                  </button>
                )}
              </div>
          </div>
        ))}
      </div>
    </div>
  );
}
