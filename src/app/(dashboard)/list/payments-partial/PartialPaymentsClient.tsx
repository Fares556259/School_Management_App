"use client";

import Table from "@/components/Table";
import { Payment } from "@prisma/client";
import { MONTHS } from "@/lib/dateUtils";
import { useState, useTransition, useMemo } from "react";
import {
  CheckCircle,
  Calendar,
  Wallet,
  Search,
  ArrowUpRight,
  X,
  Download,
  AlertTriangle,
  Clock,
  Filter,
  CheckCircle2,
  Receipt,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { receiveStudentPayment } from "../students/actions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { downloadCSV } from "@/lib/csvExport";
import { toast } from "react-toastify";

export type DueStatus = "all" | "overdue" | "this_month" | "future" | "unscheduled";

export function getPaymentDueStatus(
  deferredUntil?: Date | string | null
): "overdue" | "this_month" | "future" | "unscheduled" {
  if (!deferredUntil) return "unscheduled";
  const dueDate = new Date(deferredUntil);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  if (dueDate < today) return "overdue";
  if (dueDate <= endOfMonth) return "this_month";
  return "future";
}

interface ExtendedPayment extends Payment {
  student: {
    name: string;
    surname: string;
    level: { level: number };
    class: { name: string };
  } | null;
}

export default function PartialPaymentsClient({ initialData }: { initialData: ExtendedPayment[] }) {
  const [data, setData] = useState(initialData);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DueStatus>("all");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [selectedRecovery, setSelectedRecovery] = useState<ExtendedPayment | null>(null);
  const [recoveryAmount, setRecoveryAmount] = useState(0);
  const { t, locale } = useLanguage();

  // Extract unique classes and months for filters
  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      if (item.student?.class?.name) set.add(item.student.class.name);
    });
    return Array.from(set).sort();
  }, [data]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    data.forEach((item) => {
      const mName = MONTHS[item.month - 1];
      if (mName) set.add(`${mName} ${item.year}`);
    });
    return Array.from(set);
  }, [data]);

  // Overall KPIs calculation
  const metrics = useMemo(() => {
    let totalPending = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let thisMonthAmount = 0;
    let thisMonthCount = 0;
    let futureAmount = 0;
    let futureCount = 0;

    data.forEach((item) => {
      const pending = item.deferredAmount || 0;
      totalPending += pending;
      const status = getPaymentDueStatus(item.deferredUntil);

      if (status === "overdue") {
        overdueAmount += pending;
        overdueCount += 1;
      } else if (status === "this_month") {
        thisMonthAmount += pending;
        thisMonthCount += 1;
      } else {
        futureAmount += pending;
        futureCount += 1;
      }
    });

    return {
      totalPending,
      totalCount: data.length,
      overdueAmount,
      overdueCount,
      thisMonthAmount,
      thisMonthCount,
      futureAmount,
      futureCount,
    };
  }, [data]);

  // Filter pipeline
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      // Search
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const fullName = `${item.student?.name} ${item.student?.surname}`.toLowerCase();
        const className = (item.student?.class?.name || "").toLowerCase();
        if (!fullName.includes(s) && !className.includes(s)) return false;
      }

      // Status
      if (selectedStatus !== "all") {
        const itemStatus = getPaymentDueStatus(item.deferredUntil);
        if (selectedStatus !== itemStatus) return false;
      }

      // Class
      if (selectedClass && item.student?.class?.name !== selectedClass) {
        return false;
      }

      // Month
      if (selectedMonth) {
        const mKey = `${MONTHS[item.month - 1]} ${item.year}`;
        if (mKey !== selectedMonth) return false;
      }

      return true;
    });
  }, [data, searchTerm, selectedStatus, selectedClass, selectedMonth]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredData.length === 0) return;

    const exportRows = filteredData.map((item) => {
      const status = getPaymentDueStatus(item.deferredUntil);
      const statusLabel =
        status === "overdue"
          ? "En retard (Échu)"
          : status === "this_month"
          ? "Échéance ce mois"
          : status === "future"
          ? "Échéance future"
          : "Non planifié";

      const dueDateStr = item.deferredUntil
        ? new Date(item.deferredUntil).toLocaleDateString("fr-FR")
        : "Non planifiée";

      const paidDateStr = item.paidAt
        ? new Date(item.paidAt).toLocaleDateString("fr-FR")
        : "N/A";

      return {
        "Nom de l'élève": item.student?.surname || "",
        "Prénom de l'élève": item.student?.name || "",
        Classe: item.student?.class?.name || "N/A",
        Niveau: item.student?.level?.level === 0 ? "Préscolaire" : `Niveau ${item.student?.level?.level || "N/A"}`,
        "Mois de scolarité": `${MONTHS[item.month - 1]} ${item.year}`,
        "Montant Déjà Payé (DT)": item.amount,
        "Reliquat Reste Dû (DT)": item.deferredAmount || 0,
        "Total Scolarité (DT)": item.amount + (item.deferredAmount || 0),
        "Date d'Échéance": dueDateStr,
        "Statut de Recouvrement": statusLabel,
        "Date du Premier Paiement": paidDateStr,
      };
    });

    downloadCSV(exportRows, `Recouvrement_Paiements_Partiels_${new Date().toISOString().split("T")[0]}.csv`);
  };

  const columns = [
    { header: t.recovery?.table?.student || "Élève", accessor: "student" },
    {
      header: t.recovery?.table?.feeMonth || "Mois concerné",
      accessor: "month",
      className: "hidden md:table-cell",
    },
    {
      header: t.recovery?.table?.paid || "Déjà payé",
      accessor: "amount",
      className: "text-right",
    },
    {
      header: t.recovery?.table?.gapPending || "Reste dû (Reliquat)",
      accessor: "deferredAmount",
      className: "text-right",
    },
    {
      header: t.recovery?.table?.recoverySchedule || "Échéance & Statut",
      accessor: "deferredUntil",
    },
    {
      header: t.recovery?.table?.actions || "Actions",
      accessor: "action",
    },
  ];

  const handleOpenRecovery = (payment: ExtendedPayment) => {
    setSelectedRecovery(payment);
    setRecoveryAmount(payment.deferredAmount || 0);
  };

  const handleProcessRecovery = () => {
    if (!selectedRecovery || !selectedRecovery.student) return;

    const fullAmount = selectedRecovery.amount + (selectedRecovery.deferredAmount || 0);
    const mName = MONTHS[selectedRecovery.month - 1];
    const monthYear = `${mName} ${selectedRecovery.year}`;
    const newTotal = selectedRecovery.amount + recoveryAmount;

    startTransition(async () => {
      const result = await receiveStudentPayment(
        selectedRecovery.studentId!,
        `${selectedRecovery.student?.name} ${selectedRecovery.student?.surname}`,
        fullAmount,
        monthYear,
        newTotal
      );

      if (result.success) {
        if (newTotal >= fullAmount) {
          setData((prev) => prev.filter((p) => p.id !== selectedRecovery.id));
        } else {
          setData((prev) =>
            prev.map((p) =>
              p.id === selectedRecovery.id
                ? { ...p, amount: newTotal, deferredAmount: fullAmount - newTotal }
                : p
            )
          );
        }
        toast.success(t.toasts?.paymentRecorded || "Paiement enregistré avec succès !");
        setSelectedRecovery(null);
      } else {
        toast.error(result.error || t.toasts?.paymentFailed || "Failed to update payment");
      }
    });
  };

  const renderRow = (item: ExtendedPayment) => {
    const dueStatus = getPaymentDueStatus(item.deferredUntil);

    return (
      <tr
        key={item.id}
        className={`border-b border-slate-100 last:border-none transition-colors group ${
          dueStatus === "overdue" ? "bg-rose-50/25 hover:bg-rose-50/50" : "hover:bg-orange-50/40"
        }`}
      >
        <td className="p-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border shrink-0 ${
                dueStatus === "overdue"
                  ? "bg-rose-100 border-rose-200 text-rose-700"
                  : "bg-slate-100 border-slate-200 text-slate-600"
              }`}
            >
              {item.student?.name.charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-slate-800 group-hover:text-slate-900 transition-colors text-sm">
                {item.student?.name} {item.student?.surname}
              </p>
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                {item.student?.class.name} •{" "}
                {item.student?.level.level === 0
                  ? "Préscolaire"
                  : `${(t as any).recovery?.table?.level || "Niveau"} ${item.student?.level.level}`}
              </p>
            </div>
          </div>
        </td>

        <td className="p-4 hidden md:table-cell">
          <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-700 rounded-md text-[10px] font-bold uppercase tracking-wider">
            {MONTHS[item.month - 1]} {item.year}
          </span>
        </td>

        <td className="p-4 text-right">
          <div className="flex items-center justify-end font-bold text-emerald-600 text-sm">
            {item.amount.toLocaleString("en-US").replace(/,/g, " ")}
            <span className="text-slate-400 font-medium text-xs ml-1">DT</span>
          </div>
        </td>

        <td className="p-4 text-right">
          <div className="flex items-center justify-end font-black text-rose-600 text-sm">
            {item.deferredAmount ? item.deferredAmount.toLocaleString("en-US").replace(/,/g, " ") : 0}
            <span className="text-slate-400 font-medium text-xs ml-1">DT</span>
          </div>
        </td>

        <td className="p-4 whitespace-nowrap">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 text-slate-600 text-xs font-medium">
              <Calendar size={13} className="opacity-70" />
              <span>
                {item.deferredUntil
                  ? new Date(item.deferredUntil).toLocaleDateString(
                      locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
                      { year: "numeric", month: "short", day: "numeric" }
                    )
                  : (t.recovery?.status?.unplanned || "Non planifiée")}
              </span>
            </div>

            <div>
              {dueStatus === "overdue" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                  <AlertTriangle size={10} />
                  {t.recovery?.status?.overdue || "En retard"}
                </span>
              ) : dueStatus === "this_month" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  <Clock size={10} />
                  {t.recovery?.status?.thisMonth || "Ce mois"}
                </span>
              ) : dueStatus === "future" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  {t.recovery?.status?.future || "À venir"}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  {t.recovery?.status?.unplanned || "Non planifié"}
                </span>
              )}
            </div>
          </div>
        </td>

        <td className="p-4">
          <button
            onClick={() => handleOpenRecovery(item)}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-500 hover:text-white transition-all shadow-sm group-hover:scale-105 disabled:opacity-50"
          >
            <Wallet size={14} />
            <span className="text-xs font-bold uppercase tracking-wider">
              {t.recovery?.table?.recover || "Recouvrer"}
            </span>
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* 3 KPI CARDS FOR RECOVERY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total to recover */}
        <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden group hover:border-blue-300 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-blue-900">
              {t.recovery?.totalToRecover || "Total Reliquats à Recouvrer"}
            </span>
            <span className="text-[10px] font-black bg-blue-200/80 text-blue-900 px-2 py-0.5 rounded-full">
              {t.recovery?.globalBadge || "Global"}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-blue-700">
              {metrics.totalPending.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-blue-500 ml-1">DT</span>
          </div>
          <p className="text-xs font-semibold text-blue-700 mt-2">
            {(t.recovery?.pendingDossiersCount || "{count} dossiers partiels en attente").replace("{count}", String(metrics.totalCount))}
          </p>
        </div>

        {/* Overdue */}
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-rose-800">
              ⚠ {t.recovery?.overdueDue || "Reliquats Échus (En retard)"}
            </span>
            <span className="text-[10px] font-black bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-full">
              {t.recovery?.highPriorityBadge || "Priorité haute"}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-rose-600">
              {metrics.overdueAmount.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-rose-400 ml-1">DT</span>
          </div>
          <p className="text-xs font-semibold text-rose-700 mt-2">
            {(t.recovery?.overdueDossiersCount || "{count} élève(s) dont l'échéance est dépassée").replace("{count}", String(metrics.overdueCount))}
          </p>
        </div>

        {/* This month */}
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              📅 {t.recovery?.dueThisMonth || "Échéances du Mois"}
            </span>
            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              {t.recovery?.thisMonthBadge || "Ce mois-ci"}
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">
              {metrics.thisMonthAmount.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-amber-500 ml-1">DT</span>
          </div>
          <p className="text-xs font-semibold text-amber-800 mt-2">
            {(t.recovery?.thisMonthDossiersCount || "{count} reliquat(s) attendu(s) avant la fin du mois").replace("{count}", String(metrics.thisMonthCount))}
          </p>
        </div>
      </div>

      {/* FILTER CONTROLS & EXPORT */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
        {/* Status quick tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setSelectedStatus("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedStatus === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {t.recovery?.filterAll || "Tous"} ({data.length})
          </button>
          <button
            onClick={() => setSelectedStatus("overdue")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedStatus === "overdue"
                ? "bg-rose-600 text-white shadow-sm"
                : "bg-white text-rose-700 hover:bg-rose-50 border border-rose-200"
            }`}
          >
            <AlertTriangle size={12} />
            {t.recovery?.filterOverdue || "En retard"} ({metrics.overdueCount})
          </button>
          <button
            onClick={() => setSelectedStatus("this_month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
              selectedStatus === "this_month"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-white text-amber-700 hover:bg-amber-50 border border-amber-200"
            }`}
          >
            <Clock size={12} />
            {t.recovery?.filterThisMonth || "Ce mois"} ({metrics.thisMonthCount})
          </button>
          <button
            onClick={() => setSelectedStatus("future")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedStatus === "future"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
            }`}
          >
            {t.recovery?.filterFuture || "Futures"} ({metrics.futureCount})
          </button>
        </div>

        {/* Dropdowns & Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Class Filter */}
          {uniqueClasses.length > 0 && (
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">{t.recovery?.allClasses || "Toutes les classes"}</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          )}

          {/* Month Filter */}
          {uniqueMonths.length > 0 && (
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
            >
              <option value="">{t.recovery?.allMonths || "Tous les mois"}</option>
              {uniqueMonths.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder={t.recovery?.searchPlaceholder || "Rechercher un élève..."}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-slate-200 w-40"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={filteredData.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-50"
            title={t.recovery?.exportButton || "Export Recouvrement"}
          >
            <Download size={14} />
            <span>{t.recovery?.exportButton || "Export Recouvrement"}</span>
          </button>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)]">
        <Table columns={columns} renderRow={renderRow} data={filteredData} />
        {filteredData.length === 0 && (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="text-emerald-500" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-700">
              {t.recovery?.emptyTitle || "Tous les reliquats sont recouvrés !"}
            </h3>
            <p className="text-sm text-slate-500">
              {t.recovery?.emptySubtitle || "Aucun paiement partiel en attente d'encaissement."}
            </p>
          </div>
        )}
      </div>

      {/* RECOVERY MODAL */}
      {selectedRecovery && (() => {
        const currentPending = selectedRecovery.deferredAmount || 0;
        const alreadyPaid = selectedRecovery.amount || 0;
        const totalTuition = alreadyPaid + currentPending;
        const isFullSettlement = recoveryAmount === currentPending;
        const isExceeded = recoveryAmount > currentPending;
        const newRemaining = Math.max(0, currentPending - recoveryAmount);
        const paidPercent = totalTuition > 0 ? Math.round((alreadyPaid / totalTuition) * 100) : 0;
        const newPaidTotal = alreadyPaid + (isExceeded ? 0 : Math.max(0, recoveryAmount));
        const newPaidPercent = totalTuition > 0
          ? Math.min(100, Math.round((newPaidTotal / totalTuition) * 100))
          : 0;
        const isRtl = locale === "ar";

        return (
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
            onClick={() => !isPending && setSelectedRecovery(null)}
            dir={isRtl ? "rtl" : "ltr"}
          >
            <div
              className="bg-white rounded-[24px] shadow-2xl border border-slate-100 max-w-lg w-full relative overflow-hidden animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-b from-slate-50 to-white px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                      {t.recovery?.modal?.title || "Recouvrement de Reliquat"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {t.recovery?.modal?.subtitle || "Enregistrement d'un versement sur reliquat de scolarité"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedRecovery(null)}
                  disabled={isPending}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40 shrink-0 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Student info & Context */}
                <div className="flex items-center justify-between p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm shrink-0 shadow-xs">
                      {selectedRecovery.student?.name?.charAt(0) || "E"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">
                        {selectedRecovery.student?.name} {selectedRecovery.student?.surname}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {selectedRecovery.student?.class?.name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                            {selectedRecovery.student.class.name}
                          </span>
                        )}
                        {selectedRecovery.student?.level?.level !== undefined && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-medium text-slate-500">
                            {selectedRecovery.student.level.level === 0
                              ? "Préscolaire"
                              : `${(t as any).recovery?.table?.level || "Niveau"} ${selectedRecovery.student.level.level}`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
                      <Calendar size={12} className="opacity-70" />
                      {MONTHS[selectedRecovery.month - 1]} {selectedRecovery.year}
                    </span>
                    {selectedRecovery.deferredUntil && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {new Date(selectedRecovery.deferredUntil).toLocaleDateString(
                          locale === "ar" ? "ar-EG-u-nu-latn" : locale === "fr" ? "fr-FR" : "en-US",
                          { day: "numeric", month: "short", year: "numeric" }
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {/* Financial Snapshot & Progress */}
                <div className="bg-slate-50/70 border border-slate-100 rounded-2xl p-4">
                  <div className="grid grid-cols-3 gap-2 text-center divide-x divide-slate-200/80 rtl:divide-x-reverse">
                    <div className="px-2">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        {t.recovery?.modal?.tuitionTotal || "Total scolarité"}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-slate-800">
                        {totalTuition.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">DT</span>
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="block text-[10px] font-bold text-emerald-600/90 uppercase tracking-wider mb-0.5">
                        {t.recovery?.modal?.alreadyPaid || "Déjà réglé"}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-emerald-600">
                        {alreadyPaid.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">DT</span>
                      </span>
                    </div>

                    <div className="px-2">
                      <span className="block text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-0.5">
                        {t.recovery?.modal?.currentPending || "Reste dû actuel"}
                      </span>
                      <span className="text-sm sm:text-base font-black text-rose-600">
                        {currentPending.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">DT</span>
                      </span>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-200/70">
                    <div className="flex justify-between items-center text-[11px] mb-1.5">
                      <span className="font-semibold text-slate-500">
                        {(t.recovery?.modal?.paidProgress || "{percent}% réglé").replace("{percent}", String(paidPercent))}
                      </span>
                      {recoveryAmount > 0 && !isExceeded && (
                        <span className="font-bold text-emerald-600 flex items-center gap-1">
                          <span>→ {newPaidPercent}%</span>
                          {isFullSettlement && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-bold">
                              100%
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-slate-200/80 h-2 rounded-full overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300"
                        style={{ width: `${paidPercent}%` }}
                      />
                      {recoveryAmount > 0 && !isExceeded && totalTuition > 0 && (
                        <div
                          className="bg-emerald-300 h-full transition-all duration-300"
                          style={{ width: `${Math.min(100 - paidPercent, (recoveryAmount / totalTuition) * 100)}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount Input & Quick Chips */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      {t.recovery?.modal?.recoveryAmount || "Montant à encaisser"}
                    </label>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Max: {currentPending} DT
                    </span>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={currentPending}
                      value={recoveryAmount === 0 ? "" : recoveryAmount}
                      onChange={(e) => {
                        const val = e.target.value === "" ? 0 : Number(e.target.value);
                        setRecoveryAmount(val);
                      }}
                      placeholder={t.recovery?.modal?.amountPlaceholder || "Entrez le montant en DT"}
                      className={`w-full ${
                        isRtl ? "pr-4 pl-14 text-right" : "pl-4 pr-14 text-left"
                      } py-3 bg-white border ${
                        isExceeded
                          ? "border-rose-300 focus:border-rose-500 focus:ring-rose-200"
                          : "border-slate-200 focus:border-slate-800 focus:ring-slate-100"
                      } rounded-xl text-lg font-bold text-slate-900 outline-none focus:ring-4 transition-all shadow-xs`}
                    />
                    <div
                      className={`absolute ${
                        isRtl ? "left-4" : "right-4"
                      } top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 uppercase tracking-wider pointer-events-none`}
                    >
                      DT
                    </div>
                  </div>

                  {/* Quick Chips */}
                  <div className="flex flex-wrap items-center gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={() => setRecoveryAmount(currentPending)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                        isFullSettlement
                          ? "bg-[#181d26] text-white border-[#181d26] shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      ⚡ {t.recovery?.modal?.settleAll || "Tout solder"} ({currentPending} DT)
                    </button>

                    {currentPending >= 20 && (
                      <button
                        type="button"
                        onClick={() => setRecoveryAmount(Math.round(currentPending / 2))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                          recoveryAmount === Math.round(currentPending / 2) && !isFullSettlement
                            ? "bg-[#181d26] text-white border-[#181d26] shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {t.recovery?.modal?.settleHalf || "Régler 50%"} ({Math.round(currentPending / 2)} DT)
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Feedback Banner */}
                {isExceeded ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs font-medium animate-in fade-in duration-150">
                    <AlertCircle size={16} className="shrink-0 text-rose-500" />
                    <span>
                      {(t.recovery?.modal?.amountExceedsNotice || "Le montant dépasse le reliquat restant ({max} DT)").replace(
                        "{max}",
                        String(currentPending)
                      )}
                    </span>
                  </div>
                ) : isFullSettlement && recoveryAmount > 0 ? (
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-medium animate-in fade-in duration-150">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>
                      {t.recovery?.modal?.fullSettlementNotice ||
                        "Ce versement soldera l'intégralité du reliquat (0 DT restant)."}
                    </span>
                  </div>
                ) : recoveryAmount > 0 ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700 text-xs animate-in fade-in duration-150">
                    <span className="font-medium">
                      {(
                        t.recovery?.modal?.partialSettlementNotice ||
                        "Nouveau solde restant après encaissement : {remaining} DT"
                      ).replace("{remaining}", String(newRemaining))}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {newRemaining} DT
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRecovery(null)}
                  disabled={isPending}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
                >
                  {t.recovery?.modal?.cancel || "Annuler"}
                </button>

                <button
                  type="button"
                  onClick={handleProcessRecovery}
                  disabled={isPending || recoveryAmount <= 0 || isExceeded}
                  className="px-5 py-2.5 rounded-xl bg-[#181d26] hover:bg-[#2a313e] text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>{t.recovery?.modal?.processing || "Enregistrement..."}</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>{t.recovery?.modal?.confirm || "Confirmer l'encaissement"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

