"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  User,
  Calendar,
  CheckCircle2,
  ArrowRight,
  HandCoins,
  Wallet,
  Download,
  MessageSquare,
  Clock,
  Phone,
  MessageCircle,
  Search,
  Filter,
} from "lucide-react";
import QuickPayButton from "../finance/QuickPayButton";
import { downloadCSV } from "@/lib/csvExport";
import { useLanguage } from "@/lib/translations/LanguageContext";
import { toast } from "react-toastify";

export interface ActionItem {
  id: string;
  name: string;
  amount: number;
  type: "student" | "teacher" | "staff";
  phone?: string;
  className?: string;
  role?: string;
  paymentStatus?: string | null;
  advanceAmount?: number;
  missedHours?: number;
  deduction?: number;
  paidAmount?: number;
  totalFee?: number;
  baseSalary?: number;
}

interface ActionCenterProps {
  unpaidEmployees: ActionItem[];
  unpaidFees: ActionItem[];
  monthLabel: string;
  englishMonthYear: string;
}

/**
 * Bouton d'envoi de rappels push / in-app avec cooldown anti-spam de 4h
 */
const SendSmsButton = ({
  listType,
  disabled = false,
}: {
  listType: string;
  disabled?: boolean;
}) => {
  const { t } = useLanguage();
  const [cooldown, setCooldown] = useState<number>(0);
  const [isSending, setIsSending] = useState(false);
  const storageKey = `sms_cooldown_${listType}`;

  useEffect(() => {
    const checkCooldown = () => {
      const lastSent = localStorage.getItem(storageKey);
      if (lastSent) {
        const elapsed = Date.now() - parseInt(lastSent, 10);
        const remaining = 4 * 60 * 60 * 1000 - elapsed;
        if (remaining > 0) {
          setCooldown(remaining);
        } else {
          setCooldown(0);
        }
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 60000);
    return () => clearInterval(interval);
  }, [storageKey]);

  const handleSendReminders = async () => {
    if (disabled) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/finance/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem(storageKey, Date.now().toString());
        setCooldown(4 * 60 * 60 * 1000);
        toast.success(
          `✓ ${data.count || 0} rappel(s) envoyés aux parents via l'application.`
        );
      } else {
        toast.error("Échec de l'envoi des rappels.");
      }
    } catch (error) {
      console.error("Failed to send reminders:", error);
      toast.error("Erreur de connexion. Veuillez réessayer.");
    } finally {
      setIsSending(false);
    }
  };

  const formatCooldown = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (cooldown > 0 && !disabled) {
    return (
      <div className="w-full py-2.5 bg-slate-100 border border-slate-200 rounded-[6px] text-[12px] font-medium text-slate-500 flex items-center justify-center gap-2 select-none">
        <Clock size={14} className="text-slate-400" />
        <span>
          {t.actionCenter.smsLocked} {formatCooldown(cooldown)})
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            localStorage.removeItem(storageKey);
            setCooldown(0);
          }}
          className="ml-2 px-1.5 py-0.5 bg-rose-500 text-white rounded text-[11px] hover:bg-rose-600 transition-colors"
        >
          Reset
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleSendReminders}
      disabled={isSending || disabled}
      className={`w-full py-2.5 border rounded-[6px] text-[13px] font-medium flex items-center justify-center gap-2 shadow-sm transition-all ${
        disabled
          ? "bg-[#f9f9f9] border-[#dddddd] text-[#898989] cursor-not-allowed"
          : "bg-[#ffffff] border-[#dddddd] text-[#181d26] hover:bg-[#f8fafc] hover:border-slate-300"
      }`}
    >
      {isSending ? (
        <div className="w-4 h-4 border-2 border-[#181d26] border-t-transparent rounded-full animate-spin" />
      ) : (
        <MessageSquare
          size={14}
          className={disabled ? "text-[#898989]" : "text-[#41454d]"}
        />
      )}
      <span>
        {isSending
          ? t.actionCenter.sendingReminders
          : t.actionCenter.sendReminders || "Envoyer Rappels (App Push)"}
      </span>
    </button>
  );
};

/**
 * Générateur de lien WhatsApp pré-rempli
 */
function getWhatsAppUrl(
  phone: string | undefined,
  studentName: string,
  monthLabel: string,
  amount: number,
  isPartial: boolean,
  defaultTemplate: string,
  partialTemplate?: string
): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const fullNumber = digits.length === 8 ? `216${digits}` : digits;
  const chosenTemplate =
    isPartial && partialTemplate ? partialTemplate : defaultTemplate;
  const message = chosenTemplate
    .replace("{student}", studentName)
    .replace("{month}", monthLabel)
    .replace("{amount}", `${amount.toLocaleString()} DT`);
  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(message)}`;
}

export default function ActionCenter({
  unpaidEmployees = [],
  unpaidFees = [],
  monthLabel,
  englishMonthYear,
}: ActionCenterProps) {
  const { t } = useLanguage();

  // État local réactif pour mise à jour optimiste immédiate
  const [employees, setEmployees] = useState<ActionItem[]>(unpaidEmployees);
  const [fees, setFees] = useState<ActionItem[]>(unpaidFees);
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set());

  // Synchronisation avec les props serveur
  useEffect(() => {
    setEmployees(unpaidEmployees);
  }, [unpaidEmployees]);

  useEffect(() => {
    setFees(unpaidFees);
  }, [unpaidFees]);

  // Filtres Employés
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | "TEACHER" | "STAFF">(
    "ALL"
  );

  // Filtres Élèves
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string>("ALL");

  // Extraction dynamique des classes disponibles dans les impayés
  const availableClasses = useMemo(() => {
    const classes = new Set<string>();
    fees.forEach((f) => {
      if (f.className) classes.add(f.className);
    });
    return Array.from(classes).sort();
  }, [fees]);

  // Handler de règlement optimiste (0ms)
  const handleItemSettled = (id: string) => {
    setSettledIds((prev) => new Set(prev).add(id));
  };

  const handleItemRollback = (id: string) => {
    setSettledIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // Listes actives (non réglées pendant la session)
  const activeEmployees = useMemo(
    () => employees.filter((e) => !settledIds.has(e.id)),
    [employees, settledIds]
  );
  const activeFees = useMemo(
    () => fees.filter((f) => !settledIds.has(f.id)),
    [fees, settledIds]
  );

  // Totaux calculés en direct
  const calculatedUnpaidEmployeesTotal = useMemo(
    () => activeEmployees.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    [activeEmployees]
  );
  const calculatedUncollectedFeesTotal = useMemo(
    () => activeFees.reduce((acc, curr) => acc + (curr.amount || 0), 0),
    [activeFees]
  );

  // Filtrage Employés
  const filteredEmployees = useMemo(() => {
    return activeEmployees.filter((item) => {
      if (roleFilter === "TEACHER" && item.type !== "teacher") return false;
      if (roleFilter === "STAFF" && item.type !== "staff") return false;
      if (employeeSearch) {
        const query = employeeSearch.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesPhone = item.phone?.includes(query);
        const matchesRole = item.role?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesRole) return false;
      }
      return true;
    });
  }, [activeEmployees, employeeSearch, roleFilter]);

  // Filtrage Élèves
  const filteredFees = useMemo(() => {
    return activeFees.filter((item) => {
      if (classFilter !== "ALL" && item.className !== classFilter) return false;
      if (studentSearch) {
        const query = studentSearch.toLowerCase().trim();
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesPhone = item.phone?.includes(query);
        const matchesClass = item.className?.toLowerCase().includes(query);
        if (!matchesName && !matchesPhone && !matchesClass) return false;
      }
      return true;
    });
  }, [activeFees, studentSearch, classFilter]);

  // Exports CSV
  const handleExportEmployees = () => {
    if (filteredEmployees.length === 0) return;
    const data = filteredEmployees.map((e) => ({
      Nom: e.name,
      Type: e.type.toUpperCase(),
      Fonction: e.role || (e.type === "teacher" ? "Enseignant" : "Personnel"),
      "Salaire Base (DT)": e.baseSalary || e.amount,
      "Avance (DT)": e.advanceAmount || 0,
      "Heures Absence": e.missedHours || 0,
      "Retenue Absence (DT)": e.deduction || 0,
      "Net Dû (DT)": e.amount,
      Contact: e.phone || "Sans contact",
    }));
    downloadCSV(
      data,
      `salaires-en-attente-${monthLabel.replace(/\s+/g, "_")}.csv`
    );
  };

  const handleExportFees = () => {
    if (filteredFees.length === 0) return;
    const data = filteredFees.map((f) => ({
      Élève: f.name,
      Classe: f.className || "Non assignée",
      "Frais Scolarité (DT)": f.totalFee || f.amount,
      "Déjà Payé (DT)": f.paidAmount || 0,
      "Reste Dû (DT)": f.amount,
      Statut:
        f.paymentStatus === "PARTIAL"
          ? "Reliquat"
          : f.paymentStatus === "PENDING"
          ? "En attente"
          : "Non payé",
      "Téléphone Parent": f.phone || "Sans contact",
    }));
    downloadCSV(
      data,
      `scolarites-en-souffrance-${monthLabel.replace(/\s+/g, "_")}.csv`
    );
  };

  return (
    <div className="relative flex flex-col gap-6 w-full">
      {/* 1. Cartes de synthèse supérieures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Rémunérations en attente */}
        <div className="bg-[#ffffff] rounded-[8px] p-6 border border-[#dddddd] shadow-sm flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[4px] h-full bg-rose-500 rounded-l-[8px]" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-600">
              <Wallet size={16} />
              <p className="text-[14px] font-medium capitalize tracking-wide text-[#41454d]">
                {t.actionCenter.unpaidEmployees}
              </p>
            </div>
            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
              {activeEmployees.length} {t.actionCenter.pending}
            </span>
          </div>
          <h2 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">
            {`\u202A${calculatedUnpaidEmployeesTotal.toLocaleString()} DT\u202C`}
          </h2>
          <span className="text-[12px] text-[#5a5a5a]">
            {monthLabel} {t.actionCenter.only?.toLowerCase()}
          </span>
        </div>

        {/* Scolarités en souffrance */}
        <div className="bg-[#ffffff] rounded-[8px] p-6 border border-[#dddddd] shadow-sm flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-[4px] h-full bg-emerald-500 rounded-l-[8px]" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-600">
              <HandCoins size={16} />
              <p className="text-[14px] font-medium capitalize tracking-wide text-[#41454d]">
                {t.actionCenter.uncollectedFees}
              </p>
            </div>
            <span className="text-[12px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              {activeFees.length} {t.actionCenter.pending}
            </span>
          </div>
          <h2 className="text-[32px] font-normal text-[#181d26] leading-[1.2]">
            {`\u202A${calculatedUncollectedFeesTotal.toLocaleString()} DT\u202C`}
          </h2>
          <span className="text-[12px] text-[#5a5a5a]">
            {monthLabel} {t.actionCenter.only?.toLowerCase()}
          </span>
        </div>
      </div>

      {/* 2. Deux Colonnes d'Action Opérationnelles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* COLONNE GAUCHE : Employés & Salaires */}
        <div className="bg-[#ffffff] rounded-[8px] shadow-sm border border-[#dddddd] flex flex-col overflow-hidden">
          {/* Entête */}
          <div className="p-5 border-b border-[#dddddd] bg-[#ffffff] flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium text-[#181d26] text-[16px] tracking-tight">
                {t.actionCenter.unpaidEmployees}
              </h3>
              <span className="text-[12px] text-[#5a5a5a]">
                {filteredEmployees.length} / {activeEmployees.length}{" "}
                {t.actionCenter.pending}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filteredEmployees.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportEmployees}
                  title={t.actionCenter.exportList || "Exporter CSV"}
                  className="p-1.5 bg-[#ffffff] rounded-[6px] border border-[#dddddd] text-[#5a5a5a] hover:text-[#181d26] hover:bg-[#f8fafc] transition-all shadow-sm"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Barre de Recherche et Filtres */}
          <div className="p-3 bg-[#fafafa] border-b border-[#dddddd] flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder={
                  t.actionCenter.searchPlaceholder || "Rechercher..."
                }
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-white border border-[#dddddd] rounded-[6px] outline-none focus:border-[#181d26] transition-colors"
              />
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setRoleFilter("ALL")}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-[6px] transition-colors ${
                  roleFilter === "ALL"
                    ? "bg-[#181d26] text-white"
                    : "bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-100"
                }`}
              >
                {t.actionCenter.allRoles || "Tous"}
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("TEACHER")}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-[6px] transition-colors ${
                  roleFilter === "TEACHER"
                    ? "bg-[#181d26] text-white"
                    : "bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-100"
                }`}
              >
                {t.actionCenter.teachersOnly || "Enseignants"}
              </button>
              <button
                type="button"
                onClick={() => setRoleFilter("STAFF")}
                className={`px-2.5 py-1 text-[12px] font-medium rounded-[6px] transition-colors ${
                  roleFilter === "STAFF"
                    ? "bg-[#181d26] text-white"
                    : "bg-white border border-[#dddddd] text-[#41454d] hover:bg-slate-100"
                }`}
              >
                {t.actionCenter.staffOnly || "Personnel"}
              </button>
            </div>
          </div>

          {/* Liste déroulante des employés */}
          <div className="p-4 space-y-2.5 flex-1 flex flex-col min-h-[300px]">
            {filteredEmployees.length > 0 ? (
              <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2 scrollbar-slim">
                {filteredEmployees.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-3 border border-[#dddddd]/70 rounded-[8px] hover:bg-[#f8fafc] hover:border-[#dddddd] transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-[#dddddd] text-[#5a5a5a] shrink-0">
                        <User size={15} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[14px] font-medium text-[#181d26] truncate">
                            {item.name}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] uppercase tracking-wide border border-indigo-200 text-indigo-700 bg-indigo-50">
                            {item.type === "teacher"
                              ? t.actionCenter.teachersOnly || "Enseignant"
                              : item.role || "Personnel"}
                          </span>
                          {item.advanceAmount && item.advanceAmount > 0 ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center gap-1">
                              <span>
                                {t.actionCenter.advanceBadge || "Avance"}: {item.advanceAmount.toLocaleString()} DT
                              </span>
                            </span>
                          ) : item.paymentStatus === "PARTIAL" ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-purple-50 text-purple-700 border border-purple-200">
                              {t.actionCenter.partialAdvance || "Avance"}
                            </span>
                          ) : null}

                          {item.missedHours && item.missedHours > 0 ? (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1">
                              <span>
                                {item.missedHours}
                                {t.actionCenter.absenceBadge || "h abs."}
                                {item.deduction
                                  ? ` (-${item.deduction.toLocaleString()} DT)`
                                  : ""}
                              </span>
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[12px] text-[#5a5a5a] truncate">
                          {item.phone || (
                            <span className="opacity-60 italic">
                              {t.actionCenter.noContact}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-[14px] font-bold text-[#181d26] whitespace-nowrap">
                        {`\u202A${item.amount.toLocaleString()} DT\u202C`}
                      </span>
                      <QuickPayButton
                        id={item.id}
                        name={item.name}
                        amount={item.amount}
                        type={item.type}
                        monthYear={englishMonthYear}
                        onOptimisticPay={() => handleItemSettled(item.id)}
                        onRollback={() => handleItemRollback(item.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {t.actionCenter.allSettled}
                </p>
                <p className="text-[12px] text-slate-400 font-normal px-4 mt-1">
                  {t.actionCenter.noPending}
                </p>
              </div>
            )}
          </div>

          {/* Pied de carte Employés */}
          <div className="p-4 bg-[#f8fafc] border-t border-[#dddddd] mt-auto space-y-3">
            <Link
              href="/list/teachers"
              className="w-full py-2.5 bg-[#181d26] hover:bg-[#333840] border border-[#181d26] rounded-[6px] text-[13px] font-medium text-white transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <HandCoins size={14} />
              <span>{t.actionCenter.processSalaries}</span>
            </Link>

            <Link
              href="/list/expenses"
              className="flex items-center justify-center gap-1 text-[12px] font-medium text-[#5a5a5a] hover:text-[#181d26] cursor-pointer transition-colors"
            >
              <span>{t.actionCenter.viewHistory}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* COLONNE DROITE : Frais & Scolarités */}
        <div className="bg-[#ffffff] rounded-[8px] shadow-sm border border-[#dddddd] flex flex-col overflow-hidden">
          {/* Entête */}
          <div className="p-5 border-b border-[#dddddd] bg-[#ffffff] flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium text-[#181d26] text-[16px] tracking-tight">
                {t.actionCenter.uncollectedFees}
              </h3>
              <span className="text-[12px] text-[#5a5a5a]">
                {filteredFees.length} / {activeFees.length}{" "}
                {t.actionCenter.pending}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {filteredFees.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportFees}
                  title={t.actionCenter.exportList || "Exporter CSV"}
                  className="p-1.5 bg-[#ffffff] rounded-[6px] border border-[#dddddd] text-[#5a5a5a] hover:text-[#181d26] hover:bg-[#f8fafc] transition-all shadow-sm"
                >
                  <Download size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Barre de Recherche et Filtre par Classe */}
          <div className="p-3 bg-[#fafafa] border-b border-[#dddddd] flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder={
                  t.actionCenter.searchPlaceholder || "Rechercher un élève..."
                }
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-[13px] bg-white border border-[#dddddd] rounded-[6px] outline-none focus:border-[#181d26] transition-colors"
              />
            </div>
            {availableClasses.length > 0 && (
              <div className="flex items-center gap-1">
                <select
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-[12px] font-medium bg-white border border-[#dddddd] rounded-[6px] text-[#181d26] outline-none focus:border-[#181d26]"
                >
                  <option value="ALL">
                    {t.actionCenter.allClasses || "Toutes les classes"}
                  </option>
                  {availableClasses.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Liste déroulante des élèves */}
          <div className="p-4 space-y-2.5 flex-1 flex flex-col min-h-[300px]">
            {filteredFees.length > 0 ? (
              <div className="max-h-[460px] overflow-y-auto pr-1 space-y-2 scrollbar-slim">
                {filteredFees.map((item) => {
                  const waUrl = getWhatsAppUrl(
                    item.phone,
                    item.name,
                    monthLabel,
                    item.amount,
                    item.paymentStatus === "PARTIAL",
                    t.actionCenter.whatsappMessage ||
                      "Bonjour, nous vous rappelons que les frais de scolarité de {student} pour le mois de {month} sont en attente.",
                    t.actionCenter.whatsappPartialMessage ||
                      "Bonjour, nous vous rappelons que le reliquat des frais de scolarité de {student} ({amount}) pour le mois de {month} est en attente de règlement."
                  );

                  return (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 border border-[#dddddd]/70 rounded-[8px] hover:bg-[#f8fafc] hover:border-[#dddddd] transition-all group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center border border-[#dddddd] text-[#5a5a5a] shrink-0">
                          <User size={15} />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[14px] font-medium text-[#181d26] truncate">
                              {item.name}
                            </span>
                            {item.className && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] border border-blue-200 text-blue-700 bg-blue-50">
                                {item.className}
                              </span>
                            )}
                            {item.paymentStatus === "PARTIAL" && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] bg-purple-50 text-purple-700 border border-purple-200/80 flex items-center gap-1">
                                <span>
                                  {t.actionCenter.partialRemaining || "Reliquat"}
                                </span>
                                {item.paidAmount ? (
                                  <span className="font-normal opacity-85">
                                    ({t.actionCenter.alreadyPaid || "Payé"}:{" "}
                                    {item.paidAmount.toLocaleString()} DT)
                                  </span>
                                ) : null}
                              </span>
                            )}
                          </div>
                          <span className="text-[12px] text-[#5a5a5a] truncate">
                            {item.phone ? (
                              <span className="flex items-center gap-2">
                                <span>{item.phone}</span>
                              </span>
                            ) : (
                              <span className="opacity-60 italic">
                                {t.actionCenter.noContact}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {/* Actions de contact rapide */}
                        {item.phone && (
                          <div className="flex items-center gap-1 mr-1">
                            <a
                              href={`tel:${item.phone.replace(/\s+/g, "")}`}
                              title={t.actionCenter.callParent || "Appeler"}
                              className="p-1.5 rounded-[6px] border border-[#dddddd] bg-white text-[#5a5a5a] hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm"
                            >
                              <Phone size={13} />
                            </a>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={
                                  t.actionCenter.whatsappReminder ||
                                  "Relancer sur WhatsApp"
                                }
                                className="p-1.5 rounded-[6px] border border-[#dddddd] bg-white text-[#5a5a5a] hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors shadow-sm"
                              >
                                <MessageCircle size={13} />
                              </a>
                            )}
                          </div>
                        )}

                        <span className="text-[14px] font-bold text-[#181d26] whitespace-nowrap">
                          {`\u202A${item.amount.toLocaleString()} DT\u202C`}
                        </span>

                        <QuickPayButton
                          id={item.id}
                          name={item.name}
                          amount={item.amount}
                          type={item.type}
                          monthYear={englishMonthYear}
                          onOptimisticPay={() => handleItemSettled(item.id)}
                          onRollback={() => handleItemRollback(item.id)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
                  <CheckCircle2 size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-800">
                  {t.actionCenter.allSettled}
                </p>
                <p className="text-[12px] text-slate-400 font-normal px-4 mt-1">
                  {t.actionCenter.noPending}
                </p>
              </div>
            )}
          </div>

          {/* Pied de carte Frais */}
          <div className="p-4 bg-[#f8fafc] border-t border-[#dddddd] mt-auto space-y-3">
            <Link
              href="/list/payments-partial"
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 border border-emerald-600 rounded-[6px] text-[13px] font-medium text-white transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Calendar size={14} />
              <span>{t.actionCenter.collectPayments}</span>
            </Link>

            <SendSmsButton
              listType="uncollected_fees"
              disabled={activeFees.length === 0}
            />

            <Link
              href="/admin/finance"
              className="flex items-center justify-center gap-1 text-[12px] font-medium text-[#5a5a5a] hover:text-[#181d26] cursor-pointer transition-colors"
            >
              <span>{t.actionCenter.viewHistory}</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
