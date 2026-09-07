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
} from "lucide-react";
import { receiveStudentPayment } from "../students/actions";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { downloadCSV } from "@/lib/csvExport";

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
    { header: (t as any).recovery?.table?.student || "Élève", accessor: "student" },
    {
      header: (t as any).recovery?.table?.feeMonth || "Mois concerné",
      accessor: "month",
      className: "hidden md:table-cell",
    },
    {
      header: (t as any).recovery?.table?.paid || "Déjà payé",
      accessor: "amount",
      className: "text-right",
    },
    {
      header: "Reste dû (Reliquat)",
      accessor: "deferredAmount",
      className: "text-right",
    },
    {
      header: "Échéance & Statut",
      accessor: "deferredUntil",
    },
    {
      header: (t as any).recovery?.table?.actions || "Actions",
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
        setSelectedRecovery(null);
      } else {
        alert("Failed to update payment");
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
                  : "Non planifiée"}
              </span>
            </div>

            <div>
              {dueStatus === "overdue" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase tracking-wider">
                  <AlertTriangle size={10} />
                  En retard (Échu)
                </span>
              ) : dueStatus === "this_month" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 uppercase tracking-wider">
                  <Clock size={10} />
                  Échéance ce mois
                </span>
              ) : dueStatus === "future" ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  À venir
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200 uppercase tracking-wider">
                  Non planifié
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
              {(t as any).recovery?.table?.recover || "Recouvrer"}
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
        <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Total Reliquats à Recouvrer
          </span>
          <div className="mt-2">
            <span className="text-3xl font-black">
              {metrics.totalPending.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-slate-400 ml-1">DT</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            {metrics.totalCount} dossiers partiels en attente
          </p>
        </div>

        {/* Overdue */}
        <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-rose-800">
              ⚠ Reliquats Échus (En retard)
            </span>
            <span className="text-[10px] font-black bg-rose-200/80 text-rose-800 px-2 py-0.5 rounded-full">
              Priorité haute
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-rose-600">
              {metrics.overdueAmount.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-rose-400 ml-1">DT</span>
          </div>
          <p className="text-xs font-semibold text-rose-700 mt-2">
            {metrics.overdueCount} élève(s) dont l&apos;échéance est dépassée
          </p>
        </div>

        {/* This month */}
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              📅 Échéances du Mois
            </span>
            <span className="text-[10px] font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">
              Ce mois-ci
            </span>
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-amber-700">
              {metrics.thisMonthAmount.toLocaleString("en-US").replace(/,/g, " ")}
            </span>
            <span className="text-sm font-semibold text-amber-500 ml-1">DT</span>
          </div>
          <p className="text-xs font-semibold text-amber-800 mt-2">
            {metrics.thisMonthCount} reliquat(s) attendu(s) avant la fin du mois
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
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            Tous ({data.length})
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
            En retard ({metrics.overdueCount})
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
            Ce mois ({metrics.thisMonthCount})
          </button>
          <button
            onClick={() => setSelectedStatus("future")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedStatus === "future"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-blue-700 hover:bg-blue-50 border border-blue-200"
            }`}
          >
            Futures ({metrics.futureCount})
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
              <option value="">Toutes les classes</option>
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
              <option value="">Tous les mois</option>
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
              placeholder="Rechercher élève..."
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
            title="Exporter la liste de recouvrement en CSV"
          >
            <Download size={14} />
            <span>Export Recouvrement</span>
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
              {(t as any).recovery?.empty?.title || "Aucun reliquat dans cette sélection !"}
            </h3>
            <p className="text-sm text-slate-500">
              Tous les paiements correspondant à ces critères ont été soldés.
            </p>
          </div>
        )}
      </div>

      {/* RECOVERY MODAL */}
      {selectedRecovery && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedRecovery(null)}
              className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>

            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">
              {(t as any).recovery?.modal?.title || "Encaisser le Reliquat"}
            </h2>
            <p className="text-sm text-slate-500 mb-6 font-medium">
              {(t as any).recovery?.modal?.recordingFor || "Paiement pour"}{" "}
              <span className="font-bold text-slate-700">
                {selectedRecovery.student?.name} {selectedRecovery.student?.surname}
              </span>
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl mb-6 border border-slate-100">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Reste Dû Actuel</span>
                <span className="text-xs font-black text-rose-500">
                  {selectedRecovery.deferredAmount} DT
                </span>
              </div>
              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-full" />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Montant à Encaisser Maintenant (DT)
              </label>
              <input
                type="number"
                value={recoveryAmount}
                onChange={(e) => setRecoveryAmount(Number(e.target.value))}
                max={selectedRecovery.deferredAmount || 0}
                className="w-full border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
              />
            </div>

            <button
              onClick={handleProcessRecovery}
              disabled={isPending || recoveryAmount <= 0}
              className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              {isPending ? (
                (t as any).recovery?.modal?.processing || "Enregistrement..."
              ) : (
                <>
                  <span>{(t as any).recovery?.modal?.confirm || "Valider l'Encaissement"}</span>
                  <ArrowUpRight size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

