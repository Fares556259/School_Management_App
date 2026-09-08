"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { getUserAvatar } from "@/lib/avatar";
import { getStaffProfileBundle } from "../actions";
import CrudFormModal from "@/components/CrudFormModal";
import SalarySummaryCard from "./SalarySummaryCard";
import StaffSalaryTracker from "./StaffSalaryTracker";
import { 
  StaffBreadcrumbNav, 
  StaffSideDrawer, 
  FloatingStaffNavTrigger, 
  QuickStaffItem 
} from "./StaffQuickNav";
import { 
  Phone, 
  MapPin, 
  Calendar as CalendarIcon, 
  Droplet, 
  Banknote, 
  Contact, 
  CreditCard, 
  ArrowLeft,
  Wallet,
  TrendingUp,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
  ExternalLink,
  ShieldCheck,
  User,
  Sparkles
} from "lucide-react";
import { useLanguage } from "@/lib/translations/LanguageContext";

export interface StaffBundle {
  staff: any;
  expenses: any[];
  staffFullName: string;
}

interface StaffProfileClientProps {
  initialStaffId?: string;
  initialBundlesMap?: Record<string, StaffBundle>;
  staff: any;
  expenses?: any[];
  staffFullName: string;
  isAdmin: boolean;
  allStaff?: QuickStaffItem[];
}

export default function StaffProfileClient({
  initialStaffId,
  initialBundlesMap,
  staff: initialStaff,
  expenses: initialExpenses = [],
  staffFullName: initialStaffFullName,
  isAdmin,
  allStaff = [],
}: StaffProfileClientProps) {
  // Sync activeTab with URL ?tab= query parameter on mount if present
  const [activeTab, setActiveTab] = useState<"finance" | "overview">(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get("tab");
        if (tabParam === "overview" || tabParam === "finance") {
          return tabParam;
        }
      } catch {}
    }
    return "finance";
  });

  const [isSideNavOpen, setIsSideNavOpen] = useState(true);

  // Sync preference with localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("staff_nav_open");
      if (saved !== null) {
        setIsSideNavOpen(saved === "true");
      }
    } catch {}
  }, []);

  const handleOpenSideNav = useCallback(() => {
    setIsSideNavOpen(true);
    try {
      localStorage.setItem("staff_nav_open", "true");
    } catch {}
  }, []);

  const handleCloseSideNav = useCallback(() => {
    setIsSideNavOpen(false);
    try {
      localStorage.setItem("staff_nav_open", "false");
    } catch {}
  }, []);

  const handleToggleSideNav = useCallback(() => {
    setIsSideNavOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("staff_nav_open", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Active staff ID
  const [activeStaffId, setActiveStaffId] = useState<string>(
    initialStaffId || initialStaff.id
  );

  // In-memory preloaded bundles map for instant 0ms switching
  const [bundlesMap, setBundlesMap] = useState<Record<string, StaffBundle>>(() => {
    if (initialBundlesMap && Object.keys(initialBundlesMap).length > 0) {
      return initialBundlesMap;
    }
    return {
      [initialStaff.id]: {
        staff: initialStaff,
        expenses: initialExpenses,
        staffFullName: initialStaffFullName,
      },
    };
  });

  // Selected month for salary tracking
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  });

  // Smooth tab change with URL synchronization
  const handleTabChange = useCallback((tab: "finance" | "overview") => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      if (tab === "finance") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
  }, []);

  // Track previous initial staff ID so we sync if server prop changes
  const prevInitialStaffIdRef = useRef(initialStaffId);
  useEffect(() => {
    if (initialStaffId && initialStaffId !== prevInitialStaffIdRef.current) {
      prevInitialStaffIdRef.current = initialStaffId;
      setActiveStaffId(initialStaffId);
    }
  }, [initialStaffId]);

  useEffect(() => {
    if (initialBundlesMap) {
      setBundlesMap((prev) => ({ ...prev, ...initialBundlesMap }));
    }
  }, [initialBundlesMap]);

  const handlePrefetchStaff = useCallback((id: string) => {
    if (!id || bundlesMap[id] || id === activeStaffId) return;
    getStaffProfileBundle(id).then((res) => {
      if (res.success && res.data) {
        setBundlesMap((prev) => ({ ...prev, [id]: res.data as StaffBundle }));
      }
    }).catch(() => {});
  }, [bundlesMap, activeStaffId]);

  // Instant synchronous staff switch (0ms) preserving current tab
  const handleSelectStaff = useCallback((id: string) => {
    if (!id || id === activeStaffId) return;

    const tabSuffix = activeTab !== "finance" ? `?tab=${activeTab}` : "";

    try {
      if (bundlesMap && bundlesMap[id]) {
        setActiveStaffId(id);
        try {
          window.history.pushState({ staffId: id }, "", `/list/staff/${id}${tabSuffix}`);
        } catch {}
        try {
          window.scrollTo(0, 0);
        } catch {}
        return;
      }
    } catch (err) {
      console.error("Sync staff switch error:", err);
    }

    // Dynamic fallback if not found in bundlesMap
    window.location.href = `/list/staff/${id}${tabSuffix}`;
  }, [activeStaffId, bundlesMap, activeTab]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/list\/staff\/([^/?#]+)/);
      if (match && match[1]) {
        const idFromUrl = match[1];
        if (bundlesMap[idFromUrl]) {
          setActiveStaffId(idFromUrl);
        }
      }
      try {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get("tab");
        if (tabParam === "overview" || tabParam === "finance") {
          setActiveTab(tabParam);
        } else {
          setActiveTab("finance");
        }
      } catch {}
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [bundlesMap]);

  // Active bundle
  const currentBundle = bundlesMap[activeStaffId] || {
    staff: initialStaff,
    expenses: initialExpenses,
    staffFullName: initialStaffFullName,
  };

  const { staff, expenses, staffFullName } = currentBundle;

  // Real-time update of payments in bundle
  const handlePaymentsChange = useCallback((updatedPayments: any[]) => {
    setBundlesMap((prev) => {
      const existing = prev[activeStaffId];
      if (!existing) return prev;
      return {
        ...prev,
        [activeStaffId]: {
          ...existing,
          staff: {
            ...existing.staff,
            payments: updatedPayments,
          },
        },
      };
    });
  }, [activeStaffId]);

  const { t, locale } = useLanguage();
  const fmt = (n: number) => `${n.toLocaleString("en-US").replace(/,/g, " ")} ${locale === "ar" ? "د.ت" : "DT"}`;

  // Financial Metrics Computation
  const currentMonthIdx = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const currentMonthPayment = (staff.payments || []).find(
    (p: any) => p.month === currentMonthIdx && p.year === currentYear
  );

  const isCurrentMonthPaid = currentMonthPayment?.status === "PAID";
  const isCurrentMonthPartial = currentMonthPayment?.status === "PARTIAL";
  const currentMonthAdvance = isCurrentMonthPartial ? currentMonthPayment.amount || 0 : 0;

  // School year metrics
  const academicStartYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  // Real total paid across all payments recorded for staff
  const totalPaidAll = (staff.payments || []).reduce((acc: number, p: any) => {
    if (p.status === "PAID") return acc + (p.amount || 0);
    if (p.status === "PARTIAL") return acc + Math.max(0, (p.amount || 0) - (p.deferredAmount || 0));
    return acc;
  }, 0);

  // Count elapsed months in current school year cycle (from September of academicStartYear)
  let elapsedMonthsCount = 0;
  for (let i = 0; i < 12; i++) {
    const m = ((8 + i) % 12) + 1;
    const y = 8 + i >= 12 ? academicStartYear + 1 : academicStartYear;
    if (y < currentYear || (y === currentYear && m <= currentMonthIdx)) {
      elapsedMonthsCount++;
    }
  }

  const totalOwed = elapsedMonthsCount * (staff.salary || 0);
  const totalOutstanding = Math.max(0, totalOwed - totalPaidAll);

  // Dynamic quick staff list synced with current bundlesMap state
  const liveStaffList = useMemo(() => {
    return allStaff.map((s) => {
      const bundle = bundlesMap[s.id];
      if (bundle) {
        return {
          ...s,
          name: bundle.staff.name,
          surname: bundle.staff.surname,
          role: bundle.staff.role,
          salary: bundle.staff.salary,
          img: bundle.staff.img,
          payments: bundle.staff.payments,
        };
      }
      return s;
    });
  }, [allStaff, bundlesMap]);

  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full transition-all duration-300">
      {/* 1. TOP BREADCRUMB & QUICK NAV */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
          <Link 
            href="/list/staff" 
            className="hover:text-indigo-600 transition-colors flex items-center gap-1.5 shrink-0 font-medium"
          >
            <ArrowLeft size={16} className={locale === "ar" ? "rotate-180" : ""} />
            <span>{t.staffProfile.directory.title}</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-bold text-slate-800 truncate">
            {staffFullName}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold shrink-0">
            {staff.role || t.staffProfile.identity.staffRole}
          </span>
        </div>

        {/* Quick Nav switcher & Directory Button */}
        <div className={`flex items-center gap-2 ${locale === "ar" ? "mr-auto" : "ml-auto"}`}>
          <StaffBreadcrumbNav
            currentStaffId={activeStaffId}
            staffList={liveStaffList}
            onOpenList={handleToggleSideNav}
            onSelectStaff={handleSelectStaff}
            onPrefetchStaff={handlePrefetchStaff}
            activeTab={activeTab}
          />

          <button
            type="button"
            onClick={handleToggleSideNav}
            className={`hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              isSideNavOpen
                ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                : "bg-white border-slate-200 hover:bg-slate-50 text-slate-700"
            }`}
            title={isSideNavOpen ? t.staffProfile.directory.hideDirectoryTooltip : t.staffProfile.directory.showDirectoryTooltip}
          >
            <Contact size={15} className={isSideNavOpen ? "text-indigo-600" : "text-slate-500"} />
            <span>{isSideNavOpen ? t.staffProfile.directory.hideDirectory : `${t.staffProfile.directory.title} (${liveStaffList.length})`}</span>
          </button>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <CrudFormModal entity="staff" mode="update" data={staff} id={staff.id} />
            </div>
          )}
        </div>
      </div>

      {/* MAIN TWO-COLUMN CONTAINER: Content (Left) + Docked Sidebar (Right) */}
      <div className="flex items-start gap-6 w-full">
        {/* LEFT / CENTER: Main Profile Details */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          
          {/* 2. UNIFIED STAFF IDENTITY CARD */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs relative overflow-hidden flex flex-col gap-5">
            {/* Subtle top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

            {/* Identity & Main Info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative border-2 border-slate-100 shadow-sm bg-slate-50 shrink-0">
                  <Image
                    src={getUserAvatar(staff.img, "staff", (staff as any).sex)}
                    alt={staffFullName}
                    width={96}
                    height={96}
                    className="w-full h-full object-cover"
                  />
                  <span
                    className={`absolute bottom-1 ${locale === "ar" ? "left-1" : "right-1"} w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${
                      isCurrentMonthPaid
                        ? "bg-emerald-500"
                        : isCurrentMonthPartial
                        ? "bg-purple-500"
                        : "bg-rose-500"
                    }`}
                    title={isCurrentMonthPaid ? t.staffProfile.directory.statusPaid : isCurrentMonthPartial ? t.staffProfile.kpis.advance.replace("{amount}", fmt(currentMonthAdvance)) : t.staffProfile.directory.statusUnpaid}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2.5 flex-wrap mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                      {staffFullName}
                    </h1>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    {t.staffProfile.identity.staffRole} · {t.staffProfile.identity.usernameLabel.replace("{username}", staff.username)}
                  </p>

                  {/* Role & Status pills */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-1.5">
                      <User size={12} className="text-indigo-500" />
                      {staff.role || t.staffProfile.identity.staffRole}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      {t.staffProfile.identity.activeContract}
                    </span>
                  </div>
                </div>
              </div>

              {/* Base Salary Badge */}
              <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center gap-3 self-start md:self-auto">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Banknote size={20} />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider leading-none">
                    {t.staffProfile.identity.monthlySalary}
                  </span>
                  <span className="text-xl font-black text-emerald-800 block mt-0.5">
                    {fmt(staff.salary || 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Metadata Strip (Always Visible) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                  <Phone size={13} />
                </div>
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t.staffProfile.identity.phone}</span>
                  {staff.phone ? (
                    <a href={`tel:${staff.phone}`} className="font-semibold text-slate-700 hover:text-indigo-600 truncate block">
                      {staff.phone}
                    </a>
                  ) : (
                    <span className="text-slate-400 italic">{t.staffProfile.identity.noPhone}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
                  <CalendarIcon size={13} />
                </div>
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t.staffProfile.identity.birthday}</span>
                  <span className="font-semibold text-slate-700 block">
                    {staff.birthday ? new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR").format(new Date(staff.birthday)) : t.staffProfile.identity.notSpecified}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-rose-500 border border-slate-100 shrink-0">
                  <Droplet size={13} />
                </div>
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t.staffProfile.identity.bloodType}</span>
                  <span className="font-semibold text-slate-700 block">
                    {staff.bloodType || t.staffProfile.identity.unknown}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-indigo-600 border border-slate-100 shrink-0">
                  <MapPin size={13} />
                </div>
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t.staffProfile.identity.address}</span>
                  <span className="font-semibold text-slate-700 block truncate" title={staff.address || t.staffProfile.identity.notSpecified}>
                    {staff.address || t.staffProfile.identity.notSpecified}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
                  <ShieldCheck size={13} />
                </div>
                <div className="truncate">
                  <span className="text-[10px] text-slate-400 block font-semibold uppercase">{t.staffProfile.identity.hiredDate}</span>
                  <span className="font-semibold text-slate-700 block">
                    {staff.createdAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR").format(new Date(staff.createdAt)) : t.staffProfile.identity.notSpecified}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FOUR SUMMARY METRIC CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Monthly Salary */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Banknote size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  {t.staffProfile.kpis.monthlySalary}
                </p>
                <h3 className="text-lg font-black text-slate-800">
                  {fmt(staff.salary || 0)}
                </h3>
              </div>
            </div>

            {/* Card 2: Current Month Status */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  isCurrentMonthPaid
                    ? "bg-emerald-50 border-emerald-100 text-emerald-600"
                    : isCurrentMonthPartial
                    ? "bg-purple-50 border-purple-100 text-purple-600"
                    : "bg-rose-50 border-rose-100 text-rose-600"
                }`}
              >
                {isCurrentMonthPaid ? (
                  <CheckCircle2 size={22} />
                ) : isCurrentMonthPartial ? (
                  <TrendingUp size={22} />
                ) : (
                  <AlertCircle size={22} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide truncate">
                  {t.staffProfile.kpis.currentMonth.replace("{month}", now.toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR", { month: "short" }))}
                </p>
                <h3
                  className={`text-sm font-black truncate ${
                    isCurrentMonthPaid
                      ? "text-emerald-700"
                      : isCurrentMonthPartial
                      ? "text-purple-700"
                      : "text-rose-700"
                  }`}
                >
                  {isCurrentMonthPaid
                    ? t.staffProfile.kpis.settled
                    : isCurrentMonthPartial
                    ? t.staffProfile.kpis.advance.replace("{amount}", fmt(currentMonthAdvance))
                    : t.staffProfile.kpis.toSettle}
                </h3>
              </div>
            </div>

            {/* Card 3: Total Paid This Year */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <Wallet size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  {t.staffProfile.kpis.totalPaidYear}
                </p>
                <h3 className="text-lg font-black text-slate-800">
                  {fmt(totalPaidAll)}
                </h3>
              </div>
            </div>

            {/* Card 4: Outstanding Balance */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                  totalOutstanding > 0
                    ? "bg-rose-50 border-rose-100 text-rose-600"
                    : "bg-slate-50 border-slate-200 text-slate-500"
                }`}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  {t.staffProfile.kpis.outstandingBalance}
                </p>
                <h3
                  className={`text-lg font-black ${
                    totalOutstanding > 0 ? "text-rose-700" : "text-slate-700"
                  }`}
                >
                  {totalOutstanding > 0 ? fmt(totalOutstanding) : t.staffProfile.kpis.upToDate}
                </h3>
              </div>
            </div>
          </div>

          {/* 4. TABS NAVIGATION */}
          <div className="flex items-center gap-2 border-b border-slate-200">
            <button
              type="button"
              onClick={() => handleTabChange("finance")}
              className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "finance"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CreditCard size={15} />
              <span>{t.staffProfile.tabs.finance}</span>
              {(staff.payments || []).length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold">
                  {(staff.payments || []).length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("overview")}
              className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "overview"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <User size={15} />
              <span>{t.staffProfile.tabs.overview}</span>
            </button>
          </div>

          {/* 5. TAB CONTENT */}
          {activeTab === "finance" && (
            <div className="flex flex-col gap-6">
              {/* Annual Progress & Breakdown */}
              <SalarySummaryCard
                salary={staff.salary || 0}
                payments={staff.payments || []}
                selectedMonth={selectedMonth}
                onSelectMonth={(month, year) => setSelectedMonth({ month, year })}
              />

              {/* Interactive Monthly Salary Tracker */}
              <StaffSalaryTracker
                staffId={staff.id}
                staffName={staffFullName}
                salary={staff.salary || 0}
                payments={staff.payments || []}
                isAdmin={isAdmin}
                selectedMonth={selectedMonth}
                onSelectMonth={(month, year) => setSelectedMonth({ month, year })}
                onPaymentsChange={handlePaymentsChange}
              />

              {/* Transactions / Payment History Table */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-indigo-600" />
                    <h3 className="text-sm font-bold text-slate-800">
                      {t.staffProfile.history.title}
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400 font-medium">
                    {t.staffProfile.history.disbursementsCount
                      .replace("{count}", String((staff.payments || []).length))
                      .replace("{plural}", (staff.payments || []).length > 1 ? "s" : "")}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  {(staff.payments || []).length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      {t.staffProfile.history.empty}
                    </div>
                  ) : (
                    <table className="w-full text-start text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase text-[10px]">
                          <th className="pb-2.5 text-start">{t.staffProfile.history.colMonth}</th>
                          <th className="pb-2.5 text-start">{t.staffProfile.history.colDate}</th>
                          <th className="pb-2.5 text-start">{t.staffProfile.history.colType}</th>
                          <th className="pb-2.5 text-start">{t.staffProfile.history.colStatus}</th>
                          <th className="pb-2.5 text-end">{t.staffProfile.history.colAmount}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...(staff.payments || [])]
                          .sort((a, b) => (b.year - a.year) || (b.month - a.month))
                          .map((p: any) => {
                            const isP = p.status === "PAID";
                            return (
                              <tr key={p.id || `${p.month}-${p.year}`} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 font-bold text-slate-800">
                                  {new Date(p.year, p.month - 1).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR", { month: "long", year: "numeric" })}
                                </td>
                                <td className="py-3 text-slate-500 font-medium">
                                  {p.paidAt ? new Date(p.paidAt).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR") : "-"}
                                </td>
                                <td className="py-3">
                                  {isP ? (
                                    <span className="font-semibold text-slate-700">{t.staffProfile.history.fullSalary}</span>
                                  ) : (
                                    <span className="font-semibold text-purple-700">{t.staffProfile.history.advance}</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  {isP ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                      <CheckCircle2 size={11} />
                                      <span>{t.staffProfile.history.settled}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                                      <TrendingUp size={11} />
                                      <span>{t.staffProfile.history.advance}</span>
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 text-end font-black text-slate-800 text-sm">
                                  {fmt(p.amount || 0)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Details */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <User size={16} className="text-indigo-600" />
                  <span>{t.staffProfile.overviewTab.personalInfo}</span>
                </h3>

                <div className="flex flex-col divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.overviewTab.fullName}</span>
                    <span className="font-bold text-slate-800">{staffFullName}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.overviewTab.username}</span>
                    <span className="font-semibold text-slate-700">{staff.username}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.role}</span>
                    <span className="font-semibold text-slate-700">{staff.role || t.staffProfile.identity.notSpecified}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.phone}</span>
                    <span className="font-semibold text-slate-700">{staff.phone || "-"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.birthday}</span>
                    <span className="font-semibold text-slate-700">
                      {staff.birthday ? new Date(staff.birthday).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR") : "-"}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.bloodType}</span>
                    <span className="font-semibold text-slate-700">{staff.bloodType || "-"}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.address}</span>
                    <span className="font-semibold text-slate-700">{staff.address || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Administrative Details */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-600" />
                  <span>{t.staffProfile.overviewTab.adminFrame}</span>
                </h3>

                <div className="flex flex-col divide-y divide-slate-100 text-xs">
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.identity.hiredDate}</span>
                    <span className="font-semibold text-slate-700">
                      {new Date(staff.createdAt).toLocaleDateString(locale === "ar" ? "ar-TN" : locale === "en" ? "en-US" : "fr-FR")}
                    </span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.overviewTab.contractSalary}</span>
                    <span className="font-bold text-indigo-700">{fmt(staff.salary || 0)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between">
                    <span className="text-slate-400 font-medium">{t.staffProfile.overviewTab.contractStatus}</span>
                    <span className="font-semibold text-emerald-600">{t.staffProfile.overviewTab.active}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT: Docked Sidebar Drawer (visible on desktop when open) */}
        {isSideNavOpen && (
          <StaffSideDrawer
            currentStaffId={activeStaffId}
            staffList={liveStaffList}
            isOpen={isSideNavOpen}
            onClose={handleCloseSideNav}
            onSelectStaff={handleSelectStaff}
            onPrefetchStaff={handlePrefetchStaff}
            activeTab={activeTab}
          />
        )}
      </div>

      {/* Floating Trigger (visible when drawer is closed) */}
      {!isSideNavOpen && (
        <FloatingStaffNavTrigger
          onOpen={handleOpenSideNav}
          totalStaff={liveStaffList.length}
        />
      )}
    </div>
  );
}
