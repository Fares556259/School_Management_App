"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getUserAvatar } from "@/lib/avatar";
import { 
  GraduationCap, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  X, 
  Pin, 
  PinOff, 
  Users, 
  ExternalLink,
  ChevronDown,
  Sparkles,
  Layers,
  Filter,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  CreditCard,
  Check
} from "lucide-react";

export interface QuickStudentPayment {
  id?: number;
  month: number;
  year: number;
  amount: number;
  status: string;
  paidAt?: Date | string | null;
  deferredAmount?: number | null;
}

export interface QuickStudentItem {
  id: string;
  name: string;
  surname: string;
  img?: string | null;
  sex?: string | null;
  className?: string | null;
  classId?: number | null;
  phone?: string | null;
  customTuition?: number | null;
  levelTuitionFee?: number | null;
  payments?: QuickStudentPayment[];
}

export const DRAWER_ACADEMIC_MONTHS = [
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

export interface StudentPaymentInfo {
  status: "PAID" | "PARTIAL" | "UNPAID";
  amountPaid: number;
  remainingDue: number;
  monthlyFee: number;
  unpaidMonthsCount: number;
  label: string;
}

export function computeStudentPaymentInfo(
  student: QuickStudentItem,
  periodFilter: string,
  bundlesMap?: Record<string, any>
): StudentPaymentInfo {
  const bundle = bundlesMap?.[student.id];
  const payments = (bundle?.payments && bundle.payments.length > 0) 
    ? bundle.payments 
    : (student.payments || []);
    
  const monthlyFee = 
    bundle?.student?.customTuition ?? 
    student.customTuition ?? 
    bundle?.student?.class?.level?.tuitionFee ?? 
    student.levelTuitionFee ?? 
    450;

  const now = new Date();
  const currentCalMonth = now.getMonth() + 1; // 1-12
  const currentCalYear = now.getFullYear();
  const academicStartYear = currentCalMonth >= 9 ? currentCalYear : currentCalYear - 1;

  if (periodFilter === "YEAR_DEBT") {
    let totalPaid = 0;
    let totalDue = 0;
    let unpaidMonthsCount = 0;

    DRAWER_ACADEMIC_MONTHS.forEach((m) => {
      const y = academicStartYear + m.offsetYear;
      const isPastOrCurrent = (y < currentCalYear) || (y === currentCalYear && m.month <= currentCalMonth);
      if (!isPastOrCurrent) return;

      const p = payments.find((rec: any) => rec.month === m.month && rec.year === y);
      const paid = p?.amount || 0;
      const isRecordPaid = p?.status === "PAID" || paid >= monthlyFee;

      totalPaid += paid;
      if (!isRecordPaid) {
        unpaidMonthsCount += 1;
        totalDue += Math.max(0, monthlyFee - paid);
      }
    });

    if (unpaidMonthsCount === 0) {
      return {
        status: "PAID",
        amountPaid: totalPaid,
        remainingDue: 0,
        monthlyFee,
        unpaidMonthsCount: 0,
        label: "À jour sur l'année",
      };
    }

    return {
      status: totalPaid > 0 ? "PARTIAL" : "UNPAID",
      amountPaid: totalPaid,
      remainingDue: totalDue,
      monthlyFee,
      unpaidMonthsCount,
      label: `${unpaidMonthsCount} mois impayé${unpaidMonthsCount > 1 ? "s" : ""}`,
    };
  }

  // Specific month evaluation
  let targetMonth: number;
  let targetYear: number;

  if (periodFilter === "CURRENT") {
    const activeM = DRAWER_ACADEMIC_MONTHS.find((m) => m.month === currentCalMonth) || DRAWER_ACADEMIC_MONTHS[0];
    targetMonth = activeM.month;
    targetYear = academicStartYear + activeM.offsetYear;
  } else {
    const [mStr, yStr] = periodFilter.split("-");
    targetMonth = parseInt(mStr, 10);
    targetYear = parseInt(yStr, 10);
  }

  const p = payments.find((rec: any) => rec.month === targetMonth && rec.year === targetYear);
  const paid = p?.amount || 0;
  const isPaid = p?.status === "PAID" || paid >= monthlyFee;
  const isPartial = p?.status === "PARTIAL" || (paid > 0 && paid < monthlyFee);

  if (isPaid) {
    return {
      status: "PAID",
      amountPaid: paid,
      remainingDue: 0,
      monthlyFee,
      unpaidMonthsCount: 0,
      label: "Payé",
    };
  }

  if (isPartial) {
    const remaining = Math.max(0, monthlyFee - paid);
    return {
      status: "PARTIAL",
      amountPaid: paid,
      remainingDue: remaining,
      monthlyFee,
      unpaidMonthsCount: 1,
      label: `Partiel (reste ${remaining} DT)`,
    };
  }

  return {
    status: "UNPAID",
    amountPaid: 0,
    remainingDue: monthlyFee,
    monthlyFee,
    unpaidMonthsCount: 1,
    label: `Non payé (${monthlyFee} DT)`,
  };
}

interface StudentSideDrawerProps {
  currentStudentId: string;
  currentClassName?: string | null;
  students: QuickStudentItem[];
  bundlesMap?: Record<string, any>;
  isOpen: boolean;
  isPinned?: boolean;
  onToggleOpen?: () => void;
  onClose: () => void;
  onTogglePin?: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
  onPrefetchClass?: (classId: number) => void;
  loadingStudentId?: string | null;
  activeTab?: string;
  onTabChange?: (tab: "tuition" | "grades" | "attendance" | "schedule" | "overview") => void;
}

export function StudentBreadcrumbNav({
  currentStudentId,
  students,
  onOpenList,
  onSelectStudent,
  onPrefetchStudent,
  loadingStudentId,
  activeTab,
}: {
  currentStudentId: string;
  students: QuickStudentItem[];
  onOpenList: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
  loadingStudentId?: string | null;
  activeTab?: string;
}) {
  const currentIndex = students.findIndex((s) => s.id === currentStudentId);
  const total = students.length;

  const prevStudent = currentIndex > 0 ? students[currentIndex - 1] : null;
  const nextStudent = currentIndex >= 0 && currentIndex < total - 1 ? students[currentIndex + 1] : null;
  const tabSuffix = activeTab && activeTab !== "tuition" ? `?tab=${activeTab}` : "";

  const isPrevLoading = Boolean(prevStudent && loadingStudentId === prevStudent.id);
  const isNextLoading = Boolean(nextStudent && loadingStudentId === nextStudent.id);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* Index and Prev/Next buttons */}
      <div className="flex items-center bg-white border border-slate-200/80 rounded-xl p-0.5 shadow-2xs text-xs font-semibold text-slate-700">
        <a
          href={prevStudent ? `/list/students/${prevStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => prevStudent && onPrefetchStudent?.(prevStudent.id)}
          onTouchStart={() => prevStudent && onPrefetchStudent?.(prevStudent.id)}
          onClick={(e) => {
            if (!prevStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (isPrevLoading) return;
            if (onSelectStudent) {
              onSelectStudent(prevStudent.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            prevStudent 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={prevStudent ? `Précédent : ${prevStudent.name} ${prevStudent.surname}` : "Premier élève"}
        >
          {isPrevLoading ? (
            <Loader2 size={13} className="animate-spin text-blue-600" />
          ) : (
            <ChevronLeft size={16} />
          )}
        </a>

        <button
          type="button"
          onClick={onOpenList}
          className="px-2 py-1 hover:bg-slate-100 rounded-md transition-colors text-[11px] font-bold text-slate-600 flex items-center gap-1 cursor-pointer"
          title="Ouvrir la liste de tous les élèves"
        >
          <span>{currentIndex >= 0 ? currentIndex + 1 : "?"}</span>
          <span className="text-slate-300">/</span>
          <span>{total}</span>
        </button>

        <a
          href={nextStudent ? `/list/students/${nextStudent.id}${tabSuffix}` : "#"}
          data-no-loader="true"
          onMouseEnter={() => nextStudent && onPrefetchStudent?.(nextStudent.id)}
          onTouchStart={() => nextStudent && onPrefetchStudent?.(nextStudent.id)}
          onClick={(e) => {
            if (!nextStudent) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            if (isNextLoading) return;
            if (onSelectStudent) {
              onSelectStudent(nextStudent.id);
            }
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
            nextStudent 
              ? "hover:bg-slate-100 text-slate-700 hover:text-slate-900 cursor-pointer" 
              : "opacity-30 cursor-not-allowed text-slate-400 pointer-events-none"
          }`}
          title={nextStudent ? `Suivant : ${nextStudent.name} ${nextStudent.surname}` : "Dernier élève"}
        >
          {isNextLoading ? (
            <Loader2 size={13} className="animate-spin text-blue-600" />
          ) : (
            <ChevronRight size={16} />
          )}
        </a>
      </div>

      {/* Quick Switcher Trigger */}
      <button
        type="button"
        onClick={onOpenList}
        className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors shadow-2xs cursor-pointer"
        title="Parcourir tous les élèves par classe"
      >
        <Users size={14} className="text-blue-600" />
        <span>Changer d&apos;élève</span>
      </button>
    </div>
  );
}

function formatClassLabel(className?: string | null): string {
  if (!className || className === "Sans classe" || className === "Non assignée") {
    return className || "Non assignée";
  }
  if (className.toLowerCase().startsWith("classe")) return className;
  return `Classe ${className}`;
}

const fmtCurrency = (n: number) => n.toLocaleString("fr-FR").replace(/,/g, " ") + " DT";

export function StudentSideDrawer({
  currentStudentId,
  currentClassName,
  students,
  bundlesMap,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
  onSelectStudent,
  onPrefetchStudent,
  onPrefetchClass,
  loadingStudentId,
  activeTab,
  onTabChange,
}: StudentSideDrawerProps) {
  const [search, setSearch] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNPAID" | "PAID">("ALL");
  const [periodFilter, setPeriodFilter] = useState<string>("CURRENT");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const currentCalMonth = now.getMonth() + 1;
  const currentCalYear = now.getFullYear();
  const currentAcademicStartYear = currentCalMonth >= 9 ? currentCalYear : currentCalYear - 1;

  const currentMonthCfg = DRAWER_ACADEMIC_MONTHS.find((m) => m.month === currentCalMonth) || DRAWER_ACADEMIC_MONTHS[0];
  const currentMonthLabel = `${currentMonthCfg.fullFr} ${currentAcademicStartYear + currentMonthCfg.offsetYear}`;

  // 1. Precalculate payment info for each student in the list
  const paymentInfoMap = useMemo(() => {
    const map = new Map<string, StudentPaymentInfo>();
    students.forEach((s) => {
      map.set(s.id, computeStudentPaymentInfo(s, periodFilter, bundlesMap));
    });
    return map;
  }, [students, periodFilter, bundlesMap]);

  // 2. Compute global status counts
  const { totalUnpaidCount, totalPaidCount, totalDueSum } = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    let dueSum = 0;

    students.forEach((s) => {
      const info = paymentInfoMap.get(s.id);
      if (info?.status === "PAID") {
        paid++;
      } else {
        unpaid++;
        dueSum += (info?.remainingDue || 0);
      }
    });

    return {
      totalUnpaidCount: unpaid,
      totalPaidCount: paid,
      totalDueSum: dueSum,
    };
  }, [students, paymentInfoMap]);

  // 3. Filter students by statusFilter
  const studentsByStatus = useMemo(() => {
    if (statusFilter === "ALL") return students;
    if (statusFilter === "UNPAID") {
      return students.filter((s) => paymentInfoMap.get(s.id)?.status !== "PAID");
    }
    return students.filter((s) => paymentInfoMap.get(s.id)?.status === "PAID");
  }, [students, statusFilter, paymentInfoMap]);

  // 4. Group all students by class name
  const { classGroups, allClassesList, currentClassCount, currentClassUnpaidCount } = useMemo(() => {
    const map = new Map<string, QuickStudentItem[]>();
    const allStudentsMap = new Map<string, QuickStudentItem[]>();

    students.forEach((s) => {
      const cName = s.className || "Sans classe";
      if (!allStudentsMap.has(cName)) allStudentsMap.set(cName, []);
      allStudentsMap.get(cName)!.push(s);
    });

    studentsByStatus.forEach((s) => {
      const cName = s.className || "Sans classe";
      if (!map.has(cName)) map.set(cName, []);
      map.get(cName)!.push(s);
    });

    allStudentsMap.forEach((_, cName) => {
      if (!map.has(cName)) map.set(cName, []);
    });

    const currentKey = currentClassName || "";
    let currentCount = 0;
    let currentUnpaid = 0;

    const sortedEntries = Array.from(allStudentsMap.keys()).sort((a, b) => {
      if (currentKey && a === currentKey) return -1;
      if (currentKey && b === currentKey) return 1;
      return a.localeCompare(b);
    });

    const groups = sortedEntries.map((className) => {
      const allClassStudents = allStudentsMap.get(className) || [];
      const filteredClassStudents = map.get(className) || [];
      const unpaidInClass = allClassStudents.filter(
        (s) => paymentInfoMap.get(s.id)?.status !== "PAID"
      ).length;

      if (currentKey && className === currentKey) {
        currentCount = allClassStudents.length;
        currentUnpaid = unpaidInClass;
      }

      return {
        className,
        isCurrentClass: currentKey ? className === currentKey : false,
        students: filteredClassStudents,
        totalCount: allClassStudents.length,
        unpaidCount: unpaidInClass,
      };
    });

    return {
      classGroups: groups,
      allClassesList: groups.map((g) => g.className),
      currentClassCount: currentCount,
      currentClassUnpaidCount: currentUnpaid,
    };
  }, [students, studentsByStatus, currentClassName, paymentInfoMap]);

  // State to track which class accordions are expanded
  const [expandedClasses, setExpandedClasses] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (currentClassName) {
      initial[currentClassName] = true;
    }
    return initial;
  });

  // Ensure current class is expanded if currentClassName changes
  useEffect(() => {
    if (currentClassName) {
      setExpandedClasses((prev) => ({
        ...prev,
        [currentClassName]: true,
      }));
    }
  }, [currentClassName]);

  // Auto-expand all classes that have unpaid students when UNPAID filter is toggled
  useEffect(() => {
    if (statusFilter === "UNPAID") {
      const expanded: Record<string, boolean> = {};
      classGroups.forEach((g) => {
        if (g.unpaidCount > 0) {
          expanded[g.className] = true;
        }
      });
      setExpandedClasses(expanded);
    }
  }, [statusFilter, classGroups]);

  const toggleClassAccordion = (className: string) => {
    setExpandedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }));
  };

  const handleExpandAll = () => {
    const all: Record<string, boolean> = {};
    allClassesList.forEach((c) => {
      all[c] = true;
    });
    setExpandedClasses(all);
  };

  const handleCollapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    if (currentClassName) {
      collapsed[currentClassName] = true;
    }
    setExpandedClasses(collapsed);
  };

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Global search across students filtered by status
  const isSearching = Boolean(search.trim());
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = search.toLowerCase().trim();
    return studentsByStatus.filter((s) => {
      const fullName = `${s.name} ${s.surname}`.toLowerCase();
      const revFullName = `${s.surname} ${s.name}`.toLowerCase();
      const cName = (s.className || "").toLowerCase();
      return fullName.includes(q) || revFullName.includes(q) || cName.includes(q);
    });
  }, [studentsByStatus, search, isSearching]);

  // Filtered class groups when not searching
  const displayedGroups = useMemo(() => {
    if (selectedClassFilter === "ALL") {
      return classGroups;
    }
    return classGroups.filter((g) => g.className === selectedClassFilter);
  }, [classGroups, selectedClassFilter]);

  // Total unpaid count and remaining balance in current visible selection
  const { visibleUnpaidCount, visibleDueSum } = useMemo(() => {
    let count = 0;
    let due = 0;
    displayedGroups.forEach((g) => {
      g.students.forEach((s) => {
        const info = paymentInfoMap.get(s.id);
        if (info && info.status !== "PAID") {
          count++;
          due += info.remainingDue;
        }
      });
    });
    return { visibleUnpaidCount: count, visibleDueSum: due };
  }, [displayedGroups, paymentInfoMap]);

  if (!isOpen) return null;

  const renderDrawerBody = (isMobile = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* 1. Drawer Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
            <GraduationCap size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-800 truncate">
                Annuaire des Élèves
              </h2>
              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-blue-100/80 text-blue-700 shrink-0">
                {students.length}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate">
              {classGroups.length} classes enregistrées
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
            title="Masquer l'annuaire"
            aria-label="Masquer l'annuaire"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Global Search Bar */}
      <div className="p-2.5 border-b border-slate-100 bg-white shrink-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            ref={isMobile ? undefined : searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche (nom, prénom, classe)..."
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Effacer la recherche"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 3. Innovative Period & Payment Status Filter Toolbar */}
      <div className="px-2.5 pt-2 pb-2 border-b border-slate-100 bg-slate-50/70 flex flex-col gap-2 shrink-0">
        {/* Period Selector Row */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 text-slate-600 min-w-0">
            <Calendar size={12} className="text-blue-600 shrink-0" />
            <span className="text-[10px] font-bold text-slate-500 shrink-0">Période :</span>
          </div>

          <div className="relative min-w-0">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="text-[11px] font-extrabold text-blue-900 bg-white hover:bg-blue-50/70 border border-blue-200/90 rounded-lg pl-2 pr-5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs appearance-none transition-colors truncate max-w-[210px]"
            >
              <option value="CURRENT">Mois en cours ({currentMonthLabel})</option>
              <option value="YEAR_DEBT">⚠️ Tout retard cumulé (Année)</option>
              <optgroup label="Mois de l'année scolaire">
                {DRAWER_ACADEMIC_MONTHS.map((m) => {
                  const y = currentAcademicStartYear + m.offsetYear;
                  return (
                    <option key={`${m.month}-${y}`} value={`${m.month}-${y}`}>
                      {m.fullFr} {y}
                    </option>
                  );
                })}
              </optgroup>
            </select>
            <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-600 pointer-events-none" />
          </div>
        </div>

        {/* Status Segmented Control (Tous / Non payés / À jour) */}
        <div className="grid grid-cols-3 gap-1 p-0.5 bg-slate-200/60 rounded-xl">
          {/* Tous */}
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-white text-slate-800 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
            title="Afficher tous les élèves"
          >
            <span>Tous</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              statusFilter === "ALL" ? "bg-slate-100 text-slate-800" : "bg-white/70 text-slate-600"
            }`}>
              {students.length}
            </span>
          </button>

          {/* Non payés */}
          <button
            type="button"
            onClick={() => setStatusFilter("UNPAID")}
            className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "UNPAID"
                ? "bg-rose-600 text-white shadow-2xs"
                : "text-rose-700 hover:bg-rose-100/60"
            }`}
            title="Filtrer uniquement les élèves non payés ou partiels"
          >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusFilter === "UNPAID" ? "bg-white animate-pulse" : "bg-rose-500"}`} />
            <span className="truncate">Non payés</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black shrink-0 ${
              statusFilter === "UNPAID" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-800"
            }`}>
              {totalUnpaidCount}
            </span>
          </button>

          {/* À jour */}
          <button
            type="button"
            onClick={() => setStatusFilter("PAID")}
            className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              statusFilter === "PAID"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "text-emerald-700 hover:bg-emerald-100/60"
            }`}
            title="Filtrer les élèves ayant réglé leur scolarité"
          >
            <CheckCircle2 size={11} className={`shrink-0 ${statusFilter === "PAID" ? "text-white" : "text-emerald-600"}`} />
            <span className="truncate">À jour</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black shrink-0 ${
              statusFilter === "PAID" ? "bg-white text-emerald-700" : "bg-emerald-100 text-emerald-800"
            }`}>
              {totalPaidCount}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Financial Micro-Banner when Unpaid is active */}
      {statusFilter === "UNPAID" && (
        <div className="px-3 py-2 bg-rose-50/90 border-b border-rose-200/70 flex items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <CreditCard size={12} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-rose-950 truncate">
                {visibleUnpaidCount} impayé{visibleUnpaidCount > 1 ? "s" : ""} {selectedClassFilter !== "ALL" ? `en ${selectedClassFilter}` : "au total"}
              </p>
              <p className="text-[10px] font-medium text-rose-700 truncate">
                Total dû : <span className="font-black text-rose-900">{fmtCurrency(visibleDueSum)}</span>
              </p>
            </div>
          </div>
          <span className="text-[9px] font-extrabold text-rose-600 bg-white border border-rose-200 px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs">
            1 clic = Régler
          </span>
        </div>
      )}

      {/* 5. Class Filter Quick Bar (When not searching) */}
      {!isSearching && (
        <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 max-w-full">
            {/* All Classes Chip */}
            <button
              type="button"
              onClick={() => setSelectedClassFilter("ALL")}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedClassFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-2xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70"
              }`}
            >
              Toutes ({statusFilter === "UNPAID" ? totalUnpaidCount : statusFilter === "PAID" ? totalPaidCount : students.length})
            </button>

            {/* Current Class Quick Chip & Other Classes */}
            {classGroups.map((group) => {
              const cName = group.className;
              const isCurrent = group.isCurrentClass;
              const countToShow = statusFilter === "UNPAID" 
                ? group.unpaidCount 
                : statusFilter === "PAID" 
                ? (group.totalCount - group.unpaidCount) 
                : group.totalCount;

              const isFullyPaid = group.unpaidCount === 0;

              let chipClass = "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/70";
              if (selectedClassFilter === cName) {
                chipClass = statusFilter === "UNPAID"
                  ? (group.unpaidCount > 0 ? "bg-rose-600 text-white shadow-2xs" : "bg-emerald-600 text-white shadow-2xs")
                  : (isCurrent ? "bg-blue-600 text-white shadow-2xs" : "bg-purple-600 text-white shadow-2xs");
              } else if (statusFilter === "UNPAID") {
                chipClass = group.unpaidCount > 0
                  ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80"
                  : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/70";
              } else if (isCurrent) {
                chipClass = "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/70";
              }

              return (
                <button
                  key={cName}
                  type="button"
                  onClick={() => setSelectedClassFilter(cName)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${chipClass}`}
                >
                  {isCurrent && <Sparkles size={11} className={selectedClassFilter === cName ? "text-white" : "text-blue-500"} />}
                  <span>{cName}</span>
                  {statusFilter === "UNPAID" && isFullyPaid ? (
                    <span className="text-[10px] font-black text-emerald-600">✓</span>
                  ) : (
                    <span className="opacity-90">({countToShow})</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Expand / Collapse All Toggle (only when viewing all classes) */}
          {selectedClassFilter === "ALL" && (
            <button
              type="button"
              onClick={() => {
                const anyClosed = allClassesList.some((c) => !expandedClasses[c]);
                if (anyClosed) {
                  handleExpandAll();
                } else {
                  handleCollapseAll();
                }
              }}
              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
              title="Tout déplier ou tout replier"
            >
              {allClassesList.some((c) => !expandedClasses[c]) ? "Tout ouvrir" : "Replier"}
            </button>
          )}
        </div>
      )}

      {/* 6. Main Scrollable List Area */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar min-h-0">
        {/* SEARCH MODE: Flat result list across all classes */}
        {isSearching ? (
          searchResults.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <Users size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">Aucun élève trouvé</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Aucun résultat pour &ldquo;{search}&rdquo; {statusFilter === "UNPAID" ? "dans les élèves non payés" : ""}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Résultats ({searchResults.length})</span>
                {statusFilter === "UNPAID" && (
                  <span className="text-[10px] text-rose-600 font-bold lowercase">
                    filtre non payé actif
                  </span>
                )}
              </div>
              {searchResults.map((s) => (
                <StudentRowItem
                  key={s.id}
                  student={s}
                  paymentInfo={paymentInfoMap.get(s.id)}
                  statusFilter={statusFilter}
                  isCurrent={s.id === currentStudentId}
                  isLoading={loadingStudentId === s.id}
                  activeTab={activeTab}
                  isMobile={isMobile}
                  onClose={onClose}
                  onSelectStudent={onSelectStudent}
                  onPrefetchStudent={onPrefetchStudent}
                  onTabChange={onTabChange}
                />
              ))}
            </div>
          )
        ) : (
          /* CLASS ACCORDION MODE */
          <div className="flex flex-col gap-2">
            {displayedGroups.map((group) => {
              const isExpanded = Boolean(expandedClasses[group.className]);
              const isCurrentClass = group.isCurrentClass;
              const hasUnpaid = group.unpaidCount > 0;

              return (
                <div
                  key={group.className}
                  className={`rounded-xl border overflow-hidden transition-all duration-200 ${
                    isCurrentClass
                      ? "bg-blue-50/30 border-blue-200/80 shadow-2xs"
                      : statusFilter === "UNPAID" && hasUnpaid
                      ? "bg-rose-50/20 border-rose-200/60"
                      : "bg-white border-slate-200/70"
                  }`}
                >
                  {/* Class Accordion Header with background prefetching */}
                  <button
                    type="button"
                    onMouseEnter={() => {
                      if (group.students.length > 0 && group.students[0].classId) {
                        onPrefetchClass?.(group.students[0].classId);
                      }
                    }}
                    onTouchStart={() => {
                      if (group.students.length > 0 && group.students[0].classId) {
                        onPrefetchClass?.(group.students[0].classId);
                      }
                    }}
                    onClick={() => {
                      toggleClassAccordion(group.className);
                      if (!isExpanded && group.students.length > 0 && group.students[0].classId) {
                        onPrefetchClass?.(group.students[0].classId);
                      }
                    }}
                    className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
                      isCurrentClass
                        ? "bg-blue-50/60 hover:bg-blue-100/50"
                        : statusFilter === "UNPAID" && hasUnpaid
                        ? "bg-rose-50/40 hover:bg-rose-100/40"
                        : "bg-slate-50/70 hover:bg-slate-100/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        isCurrentClass
                          ? "bg-blue-600 text-white shadow-2xs"
                          : statusFilter === "UNPAID" && hasUnpaid
                          ? "bg-rose-600 text-white shadow-2xs"
                          : "bg-purple-100 text-purple-700"
                      }`}>
                        {isCurrentClass ? <Sparkles size={13} /> : statusFilter === "UNPAID" && hasUnpaid ? <AlertCircle size={13} /> : <Users size={13} />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-slate-800 truncate">
                            {formatClassLabel(group.className)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {statusFilter === "UNPAID" ? (
                        hasUnpaid ? (
                          <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                            <span>{group.unpaidCount} non payé{group.unpaidCount > 1 ? "s" : ""}</span>
                          </span>
                        ) : (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Check size={11} className="text-emerald-600" />
                            <span>À jour ✓</span>
                          </span>
                        )
                      ) : statusFilter === "PAID" ? (
                        <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {group.students.length} à jour
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {hasUnpaid && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                              {group.unpaidCount} impayé{group.unpaidCount > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                            isCurrentClass
                              ? "bg-blue-100 text-blue-800"
                              : "bg-slate-200/70 text-slate-600"
                          }`}>
                            {group.students.length}
                          </span>
                        </div>
                      )}

                      <ChevronDown
                        size={15}
                        className={`text-slate-400 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Class Students List (Collapsible Body) */}
                  {isExpanded && (
                    <div className="p-1.5 flex flex-col gap-1 divide-y divide-slate-100/60">
                      {group.students.length > 0 ? (
                        group.students.map((s) => (
                          <StudentRowItem
                            key={s.id}
                            student={s}
                            paymentInfo={paymentInfoMap.get(s.id)}
                            statusFilter={statusFilter}
                            isCurrent={s.id === currentStudentId}
                            isLoading={loadingStudentId === s.id}
                            activeTab={activeTab}
                            isMobile={isMobile}
                            onClose={onClose}
                            onSelectStudent={onSelectStudent}
                            onPrefetchStudent={onPrefetchStudent}
                            onTabChange={onTabChange}
                          />
                        ))
                      ) : (
                        <div className="p-3 text-center bg-emerald-50/60 rounded-xl m-1 border border-emerald-100 flex items-center justify-center gap-2 text-xs text-emerald-800">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span className="font-bold">
                            Tous les élèves de cette classe sont à jour !
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Drawer Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/80 shrink-0 flex items-center justify-between text-xs">
        <Link
          href="/list/students"
          className="text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1.5 transition-colors"
        >
          <span>Tableau complet des élèves</span>
          <ExternalLink size={12} />
        </Link>

        <span className="text-[11px] text-slate-400 font-medium">
          {isSearching ? searchResults.length : studentsByStatus.length} élève{studentsByStatus.length > 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Docked Sidebar (lg and above): Integrated directly in the page flow */}
      <aside 
        className="hidden lg:flex flex-col w-[340px] xl:w-[370px] shrink-0 sticky top-4 h-[calc(100vh-100px)] bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden z-20"
        aria-label="Annuaire des élèves par classe"
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
          aria-label="Annuaire des élèves par classe"
        >
          {renderDrawerBody(true)}
        </aside>
      </div>
    </>
  );
}

function StudentRowItem({
  student: s,
  paymentInfo,
  statusFilter,
  isCurrent,
  isLoading,
  activeTab,
  isMobile,
  onClose,
  onSelectStudent,
  onPrefetchStudent,
  onTabChange,
}: {
  student: QuickStudentItem;
  paymentInfo?: StudentPaymentInfo;
  statusFilter: "ALL" | "UNPAID" | "PAID";
  isCurrent: boolean;
  isLoading?: boolean;
  activeTab?: string;
  isMobile?: boolean;
  onClose?: () => void;
  onSelectStudent?: (id: string) => void;
  onPrefetchStudent?: (id: string) => void;
  onTabChange?: (tab: "tuition" | "grades" | "attendance" | "schedule" | "overview") => void;
}) {
  // If unpaid filter is on, target tuition tab directly
  const targetTab = statusFilter === "UNPAID" ? "tuition" : (activeTab && activeTab !== "tuition" ? activeTab : "tuition");
  const tabSuffix = targetTab && targetTab !== "tuition" ? `?tab=${targetTab}` : "";

  return (
    <a
      href={`/list/students/${s.id}${tabSuffix}`}
      data-no-loader="true"
      onMouseEnter={() => onPrefetchStudent?.(s.id)}
      onTouchStart={() => onPrefetchStudent?.(s.id)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        if (isLoading) return;
        if (isMobile && onClose) onClose();

        // One-click jump to tuition tab when in unpaid filter mode
        if (statusFilter === "UNPAID" && onTabChange) {
          onTabChange("tuition");
        }

        if (onSelectStudent) {
          onSelectStudent(s.id);
        }
      }}
      className={`w-full text-left group flex items-center gap-2.5 p-2 rounded-xl transition-all cursor-pointer ${
        isLoading
          ? "bg-blue-50/90 border border-blue-300 ring-2 ring-blue-400/40 animate-pulse shadow-sm"
          : isCurrent
          ? "bg-blue-50/90 border border-blue-200/90 shadow-2xs"
          : "hover:bg-slate-50/90 border border-transparent"
      }`}
    >
      {/* Avatar with status indicator dot */}
      <div className="relative w-9 h-9 shrink-0">
        <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-200/80 bg-slate-100 shadow-2xs">
          <Image
            src={getUserAvatar(s.img, "student", s.sex)}
            alt={`${s.name} ${s.surname}`}
            fill
            className="object-cover"
          />
        </div>
        {/* Status indicator dot */}
        {paymentInfo && (
          <span 
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
              paymentInfo.status === "PAID"
                ? "bg-emerald-500"
                : paymentInfo.status === "PARTIAL"
                ? "bg-amber-500"
                : "bg-rose-500"
            }`}
            title={paymentInfo.label}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={`text-xs font-bold truncate ${
            isLoading
              ? "text-blue-700 font-extrabold"
              : isCurrent
              ? "text-blue-950"
              : "text-slate-800 group-hover:text-blue-600"
          }`}>
            {s.name} {s.surname}
          </span>
          {isCurrent && !isLoading && (
            <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded-md bg-blue-600 text-white shrink-0">
              Actuel
            </span>
          )}
          {isLoading && (
            <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 shrink-0">
              Chargement...
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 mt-0.5">
          <span className="text-[10px] text-slate-500 font-medium truncate flex items-center gap-1">
            <GraduationCap size={10} className="text-slate-400 shrink-0" />
            <span>{formatClassLabel(s.className || "Non assignée")}</span>
          </span>

          {/* Payment Status Pill */}
          {paymentInfo && (
            paymentInfo.status === "PAID" ? (
              <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                <Check size={9} />
                <span>À jour</span>
              </span>
            ) : paymentInfo.status === "PARTIAL" ? (
              <span className="text-[9px] font-extrabold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>Reste {paymentInfo.remainingDue} DT</span>
              </span>
            ) : (
              <span className="text-[9px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span>Non payé ({paymentInfo.remainingDue} DT)</span>
              </span>
            )
          )}
        </div>
      </div>

      {/* Right indicator */}
      {isLoading ? (
        <Loader2 size={14} className="animate-spin text-blue-600 shrink-0" />
      ) : !isCurrent ? (
        <ChevronRight size={13} className="text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
      ) : null}
    </a>
  );
}

export function FloatingStudentNavTrigger({
  onOpen,
  totalStudents,
}: {
  onOpen: () => void;
  totalStudents: number;
  isPinned?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30 bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-l-2xl py-3 px-2 flex flex-col items-center gap-1.5 transition-transform hover:-translate-x-1 duration-200 group border-l border-t border-b border-blue-400/30 cursor-pointer"
      title="Afficher l'annuaire des élèves"
      aria-label="Afficher l'annuaire des élèves"
    >
      <GraduationCap size={16} className="group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-black leading-none bg-white text-blue-700 px-1.5 py-0.5 rounded-full shadow-2xs">
        {totalStudents}
      </span>
      <span className="text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] rotate-180 opacity-90 mt-1">
        Élèves
      </span>
    </button>
  );
}
