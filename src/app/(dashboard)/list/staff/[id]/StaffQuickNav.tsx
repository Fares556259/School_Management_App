"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAvatar } from "@/lib/avatar";
import { 
  Users, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  ExternalLink,
  Phone,
  Contact,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles
} from "lucide-react";

export interface QuickStaffItem {
  id: string;
  name: string;
  surname: string;
  role: string;
  salary: number;
  img?: string | null;
  sex?: string | null;
  phone?: string | null;
  payments?: {
    id?: number;
    month: number;
    year: number;
    status: string;
    amount: number;
    deferredAmount?: number | null;
  }[];
}

interface StaffSideDrawerProps {
  currentStaffId: string;
  staffList: QuickStaffItem[];
  isOpen: boolean;
  onToggleOpen?: () => void;
  onClose: () => void;
  onSelectStaff?: (id: string) => void;
  onPrefetchStaff?: (id: string) => void;
  activeTab?: string;
}

export function StaffBreadcrumbNav({
  currentStaffId,
  staffList,
  onOpenList,
  onSelectStaff,
  onPrefetchStaff,
  activeTab,
}: {
  currentStaffId: string;
  staffList: QuickStaffItem[];
  onOpenList: () => void;
  onSelectStaff?: (id: string) => void;
  onPrefetchStaff?: (id: string) => void;
  activeTab?: string;
}) {
  const currentIndex = staffList.findIndex((s) => s.id === currentStaffId);
  const total = staffList.length;

  const prevStaff = currentIndex > 0 ? staffList[currentIndex - 1] : null;
  const nextStaff = currentIndex >= 0 && currentIndex < total - 1 ? staffList[currentIndex + 1] : null;
  const tabSuffix = activeTab && activeTab !== "finance" ? `?tab=${activeTab}` : "";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Index and Prev/Next buttons */}
      <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-xs font-semibold text-slate-700">
        <a
          href={prevStaff ? `/list/staff/${prevStaff.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => { if (prevStaff && onPrefetchStaff) onPrefetchStaff(prevStaff.id); }}
          onClick={(e) => {
            if (!prevStaff) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (onSelectStaff) {
              onSelectStaff(prevStaff.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            prevStaff 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={prevStaff ? `Précédent : ${prevStaff.name} ${prevStaff.surname}` : "Premier membre"}
        >
          <ChevronLeft size={16} />
        </a>

        <button
          type="button"
          onClick={onOpenList}
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
          title="Ouvrir l'annuaire du personnel"
        >
          <span>{currentIndex >= 0 ? currentIndex + 1 : "?"}</span>
          <span className="text-slate-300">/</span>
          <span>{total}</span>
        </button>

        <a
          href={nextStaff ? `/list/staff/${nextStaff.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => { if (nextStaff && onPrefetchStaff) onPrefetchStaff(nextStaff.id); }}
          onClick={(e) => {
            if (!nextStaff) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (onSelectStaff) {
              onSelectStaff(nextStaff.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            nextStaff 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={nextStaff ? `Suivant : ${nextStaff.name} ${nextStaff.surname}` : "Dernier membre"}
        >
          <ChevronRight size={16} />
        </a>
      </div>

      {/* Quick Switcher Trigger */}
      <button
        type="button"
        onClick={onOpenList}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        title="Parcourir le personnel"
      >
        <Contact size={14} className="text-indigo-600" />
        <span>Changer</span>
      </button>
    </div>
  );
}

export function StaffSideDrawer({
  currentStaffId,
  staffList,
  isOpen,
  onClose,
  onSelectStaff,
  onPrefetchStaff,
  activeTab,
}: StaffSideDrawerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Current calendar month (1-based)
  const now = new Date();
  const currentMonthIdx = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Helper to compute payment status for the current month
  const getStaffCurrentMonthStatus = useCallback((s: QuickStaffItem) => {
    const p = (s.payments || []).find(
      (pay) => pay.month === currentMonthIdx && pay.year === currentYear
    );
    if (!p) return { status: "UNPAID", label: "Non payé", advance: 0 };
    if (p.status === "PAID") return { status: "PAID", label: "Soldé", advance: 0 };
    if (p.status === "PARTIAL") return { status: "PARTIAL", label: "Avance", advance: p.amount || 0 };
    return { status: "UNPAID", label: "Non payé", advance: 0 };
  }, [currentMonthIdx, currentYear]);

  // Counts
  const counts = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    staffList.forEach((s) => {
      const st = getStaffCurrentMonthStatus(s);
      if (st.status === "PAID") paid++;
      else unpaid++;
    });
    return { all: staffList.length, paid, unpaid };
  }, [staffList, getStaffCurrentMonthStatus]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      // 1. Status filter
      if (statusFilter !== "ALL") {
        const st = getStaffCurrentMonthStatus(s);
        if (statusFilter === "PAID" && st.status !== "PAID") return false;
        if (statusFilter === "UNPAID" && st.status === "PAID") return false;
      }

      // 2. Search term
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      const fullName = `${s.name} ${s.surname}`.toLowerCase();
      const role = (s.role || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      return fullName.includes(q) || role.includes(q) || phone.includes(q);
    });
  }, [staffList, searchTerm, statusFilter, getStaffCurrentMonthStatus]);

  // Keyboard shortcut Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const tabSuffix = activeTab && activeTab !== "finance" ? `?tab=${activeTab}` : "";

  const renderDrawerBody = (isMobile: boolean) => (
    <div className="flex flex-col h-full bg-white">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
            <Contact size={18} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Annuaire du Personnel</span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                {staffList.length}
              </span>
            </h2>
            <p className="text-[11px] text-slate-400">
              {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          title="Fermer l'annuaire"
          aria-label="Fermer l'annuaire"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Rechercher par nom, rôle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200/90 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter segment tabs */}
        <div className="grid grid-cols-3 gap-1 mt-2 p-0.5 bg-slate-100/90 rounded-lg text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`py-1 rounded-md transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-slate-800 shadow-2xs font-bold"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tous ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("UNPAID")}
            className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
              statusFilter === "UNPAID"
                ? "bg-white text-rose-700 shadow-2xs font-bold"
                : "text-slate-500 hover:text-rose-600"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            <span>À régler ({counts.unpaid})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PAID")}
            className={`py-1 rounded-md transition-all flex items-center justify-center gap-1 cursor-pointer ${
              statusFilter === "PAID"
                ? "bg-white text-emerald-700 shadow-2xs font-bold"
                : "text-slate-500 hover:text-emerald-600"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span>Soldés ({counts.paid})</span>
          </button>
        </div>
      </div>

      {/* Staff List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
        {filteredStaff.length === 0 ? (
          <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
            <Contact size={28} className="text-slate-300 stroke-[1.5]" />
            <p className="text-xs font-medium">Aucun membre trouvé</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs text-indigo-600 hover:underline font-semibold"
              >
                Réinitialiser la recherche
              </button>
            )}
          </div>
        ) : (
          filteredStaff.map((s) => {
            const isCurrent = s.id === currentStaffId;
            const statusInfo = getStaffCurrentMonthStatus(s);

            let statusDotColor = "bg-rose-500";
            let statusBadge = (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/60">
                Non payé
              </span>
            );

            if (statusInfo.status === "PAID") {
              statusDotColor = "bg-emerald-500";
              statusBadge = (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-0.5">
                  Soldé ✓
                </span>
              );
            } else if (statusInfo.status === "PARTIAL") {
              statusDotColor = "bg-purple-500";
              statusBadge = (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                  Avance {statusInfo.advance} DT
                </span>
              );
            }

            return (
              <a
                key={s.id}
                href={`/list/staff/${s.id}${tabSuffix}`}
                data-no-loader="true"
                onMouseEnter={() => {
                  if (onPrefetchStaff) onPrefetchStaff(s.id);
                }}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                  e.preventDefault();
                  if (onSelectStaff) {
                    onSelectStaff(s.id);
                    if (isMobile) onClose();
                  }
                }}
                className={`group flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? "bg-indigo-50/80 border border-indigo-200/80 shadow-2xs ring-1 ring-indigo-500/10"
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                {/* Avatar with status indicator */}
                <div className="relative shrink-0">
                  <Image
                    src={getUserAvatar(s.img, "staff", (s as any).sex)}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover border border-slate-200"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusDotColor}`}
                    title={statusInfo.label}
                  />
                </div>

                {/* Staff details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <p className={`text-xs font-bold truncate ${isCurrent ? "text-indigo-950" : "text-slate-800 group-hover:text-indigo-900"}`}>
                      {s.name} {s.surname}
                    </p>
                    <span className="text-[11px] font-black text-slate-700 shrink-0">
                      {s.salary.toLocaleString("en-US").replace(/,/g, " ")} DT
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[10px] font-medium text-slate-500 truncate bg-slate-100 px-1.5 py-0.5 rounded-md max-w-[120px]">
                      {s.role || "Personnel"}
                    </span>
                    {statusBadge}
                  </div>
                </div>

                {!isCurrent && (
                  <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                )}
              </a>
            );
          })
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between text-xs">
        <Link
          href="/list/staff"
          className="text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1.5 transition-colors"
        >
          <span>Tableau complet</span>
          <ExternalLink size={12} />
        </Link>
        <span className="text-[11px] text-slate-400">
          {filteredStaff.length} affiché{filteredStaff.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Docked Sidebar (lg and above): Integrated directly in the page flow */}
      <aside
        className="hidden lg:flex flex-col w-[320px] xl:w-[350px] shrink-0 sticky top-4 h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden z-20"
        aria-label="Annuaire du personnel"
      >
        {renderDrawerBody(false)}
      </aside>

      {/* 2. Mobile Overlay Drawer (< lg) */}
      <div className="lg:hidden">
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 transition-opacity animate-in fade-in duration-200"
          onClick={onClose}
        />
        <aside
          className="fixed top-0 right-0 h-full w-[320px] sm:w-[360px] bg-white z-50 shadow-2xl border-l border-slate-200 flex flex-col"
          aria-label="Annuaire du personnel"
        >
          {renderDrawerBody(true)}
        </aside>
      </div>
    </>
  );
}

export function FloatingStaffNavTrigger({
  onOpen,
  totalStaff,
}: {
  onOpen: () => void;
  totalStaff: number;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg rounded-l-2xl py-3 px-2 flex flex-col items-center gap-1.5 transition-transform hover:-translate-x-1 duration-200 group border-l border-t border-b border-indigo-400/30 cursor-pointer"
      title="Afficher l'annuaire du personnel"
      aria-label="Afficher l'annuaire du personnel"
    >
      <Contact size={16} className="group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-black leading-none bg-white text-indigo-700 px-1.5 py-0.5 rounded-full shadow-2xs">
        {totalStaff}
      </span>
      <span className="text-[9px] font-semibold tracking-wider uppercase [writing-mode:vertical-rl] rotate-180 text-indigo-100">
        Personnel
      </span>
    </button>
  );
}
