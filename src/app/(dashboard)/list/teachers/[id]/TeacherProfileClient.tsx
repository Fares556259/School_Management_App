"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import FormModal from "@/components/FormModal";
import TeacherFinanceHub from "./TeacherFinanceHub";
import TeacherSchedule, { ScheduleItem } from "./TeacherSchedule";
import { getUserAvatar } from "@/lib/avatar";
import { getTeacherProfileBundle } from "../actions";
import { 
  TeacherBreadcrumbNav, 
  TeacherSideDrawer, 
  FloatingTeacherNavTrigger, 
  QuickTeacherItem 
} from "./TeacherQuickNav";
import { 
  Phone, 
  MapPin, 
  Calendar as CalendarIcon, 
  Droplet, 
  Banknote, 
  Users, 
  BookOpen, 
  Clock, 
  CreditCard, 
  ArrowLeft,
  Wallet,
  Calendar,
  LayoutGrid,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

interface TeacherProfileClientProps {
  initialTeacherId?: string;
  initialBundlesMap?: Record<string, TeacherBundle>;
  teacher: any;
  expenses?: any[];
  cleanSubjects: string[];
  scheduleItems: ScheduleItem[];
  teacherFullName: string;
  totalHours: number;
  isAdmin: boolean;
  allTeachers?: QuickTeacherItem[];
}

export interface TeacherBundle {
  teacher: any;
  expenses: any[];
  cleanSubjects: string[];
  scheduleItems: ScheduleItem[];
  teacherFullName: string;
  totalHours: number;
}

export default function TeacherProfileClient({
  initialTeacherId,
  initialBundlesMap,
  teacher: initialTeacher,
  expenses: initialExpenses = [],
  cleanSubjects: initialCleanSubjects,
  scheduleItems: initialScheduleItems,
  teacherFullName: initialTeacherFullName,
  totalHours: initialTotalHours,
  isAdmin,
  allTeachers = [],
}: TeacherProfileClientProps) {
  // Sync activeTab with URL ?tab= query parameter on mount if present
  const [activeTab, setActiveTab] = useState<"finance" | "schedule" | "overview">(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get("tab");
        if (tabParam === "schedule" || tabParam === "overview" || tabParam === "finance") {
          return tabParam;
        }
      } catch {}
    }
    return "finance";
  });

  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [isSideNavPinned, setIsSideNavPinned] = useState(false);

  // Active teacher ID
  const [isSwitching, setIsSwitching] = useState(false);
  const [activeTeacherId, setActiveTeacherId] = useState<string>(
    initialTeacherId || initialTeacher.id
  );

  // In-memory preloaded bundles map for instant 0ms switching
  const [bundlesMap, setBundlesMap] = useState<Record<string, TeacherBundle>>(() => {
    if (initialBundlesMap && Object.keys(initialBundlesMap).length > 0) {
      return initialBundlesMap;
    }
    return {
      [initialTeacher.id]: {
        teacher: initialTeacher,
        expenses: initialExpenses,
        cleanSubjects: initialCleanSubjects,
        scheduleItems: initialScheduleItems,
        teacherFullName: initialTeacherFullName,
        totalHours: initialTotalHours,
      },
    };
  });

  // Smooth tab change with URL synchronization
  const handleTabChange = useCallback((tab: "finance" | "schedule" | "overview") => {
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

  // Track previous initial teacher ID so we ONLY sync if the server prop actually changes
  const prevInitialTeacherIdRef = useRef(initialTeacherId);
  useEffect(() => {
    if (initialTeacherId && initialTeacherId !== prevInitialTeacherIdRef.current) {
      prevInitialTeacherIdRef.current = initialTeacherId;
      setActiveTeacherId(initialTeacherId);
    }
  }, [initialTeacherId]);

  useEffect(() => {
    if (initialBundlesMap) {
      setBundlesMap((prev) => ({ ...prev, ...initialBundlesMap }));
    }
  }, [initialBundlesMap]);

  useEffect(() => {
    try {
      const savedPin = localStorage.getItem("teacher_nav_pinned");
      if (savedPin === "true") {
        setIsSideNavPinned(true);
      }
    } catch {}
  }, []);

  const handleTogglePin = () => {
    setIsSideNavPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("teacher_nav_pinned", String(next));
      } catch {}
      return next;
    });
  };


  const handlePrefetchTeacher = useCallback((id: string) => {
    if (!id || bundlesMap[id] || id === activeTeacherId) return;
    getTeacherProfileBundle(id).then((res) => {
      if (res.success && res.data) {
        setBundlesMap((prev) => ({ ...prev, [id]: res.data as TeacherBundle }));
      }
    }).catch(() => {});
  }, [bundlesMap, activeTeacherId]);

  // Instant synchronous teacher switch (0ms) preserving current tab
  const handleSelectTeacher = useCallback((id: string) => {
    if (!id || id === activeTeacherId || isSwitching) return;

    const tabSuffix = activeTab !== "finance" ? `?tab=${activeTab}` : "";

    if (bundlesMap[id]) {
      setActiveTeacherId(id);
      window.history.pushState({ teacherId: id }, "", `/list/teachers/${id}${tabSuffix}`);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }

    setIsSwitching(true);
    getTeacherProfileBundle(id)
      .then((res) => {
        setIsSwitching(false);
        if (res.success && res.data) {
          setBundlesMap((prev) => ({ ...prev, [id]: res.data as TeacherBundle }));
          setActiveTeacherId(id);
          window.history.pushState({ teacherId: id }, "", `/list/teachers/${id}${tabSuffix}`);
          window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
        } else {
          window.location.href = `/list/teachers/${id}${tabSuffix}`;
        }
      })
      .catch(() => {
        window.location.href = `/list/teachers/${id}${tabSuffix}`;
      });
  }, [activeTeacherId, bundlesMap, activeTab, isSwitching]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/list\/teachers\/([^/?#]+)/);
      if (match && match[1]) {
        const idFromUrl = match[1];
        if (bundlesMap[idFromUrl]) {
          setActiveTeacherId(idFromUrl);
        }
      }
      try {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get("tab");
        if (tabParam === "schedule" || tabParam === "overview" || tabParam === "finance") {
          setActiveTab(tabParam);
        } else {
          setActiveTab("finance");
        }
      } catch {}
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [bundlesMap]);

  const currentBundle = bundlesMap[activeTeacherId] || {
    teacher: initialTeacher,
    expenses: initialExpenses,
    cleanSubjects: initialCleanSubjects,
    scheduleItems: initialScheduleItems,
    teacherFullName: initialTeacherFullName,
    totalHours: initialTotalHours,
  };

  const {
    teacher,
    expenses,
    cleanSubjects,
    scheduleItems,
    teacherFullName,
    totalHours,
  } = currentBundle;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  // Calculate quick payment total for the badge
  const totalPaid = (teacher.payments || []).reduce((acc: number, p: any) => acc + (p.amount || 0), 0);

  return (
    <div className={`flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1600px] mx-auto w-full transition-all duration-300 ${
      isSideNavPinned ? "lg:pr-[330px]" : ""
    }`}>
      {/* LOADING OVERLAY */}
      {isSwitching && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
          <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-sm font-bold text-slate-700">Chargement du profil...</p>
          </div>
        </div>
      )}
      
      {/* 1. TOP BREADCRUMB & QUICK NAV */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
          <Link 
            href="/list/teachers" 
            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-medium text-slate-600 shrink-0"
          >
            <ArrowLeft size={16} />
            <span>Enseignants</span>
          </Link>
          <span className="text-slate-300 shrink-0">/</span>
          <span className="font-semibold text-slate-800 truncate max-w-[150px] sm:max-w-none">
            {teacherFullName}
          </span>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
            teacher.activated 
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
              : "bg-amber-50 text-amber-700 border border-amber-200"
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${teacher.activated ? "bg-emerald-500" : "bg-amber-500"}`} />
            {teacher.activated ? "Actif" : "En attente"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stepper & Switcher */}
          {allTeachers.length > 0 && (
            <TeacherBreadcrumbNav
              currentTeacherId={teacher.id}
              teachers={allTeachers}
              onOpenList={() => setIsSideNavOpen(true)}
              onSelectTeacher={handleSelectTeacher}
              onPrefetchTeacher={handlePrefetchTeacher}
              activeTab={activeTab}
            />
          )}

          {isAdmin && (
            <div className="flex items-center gap-2">
              <FormModal table="teacher" type="update" data={teacher} />
            </div>
          )}
        </div>
      </div>

      {/* 2. UNIFIED TEACHER IDENTITY & METRIC HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden flex flex-col gap-5">
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

        {/* Identity & Main Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative border-2 border-slate-100 shadow-sm bg-slate-50 shrink-0">
              <Image
                src={getUserAvatar(teacher.img, "teacher", teacher.sex)}
                alt={teacherFullName}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  {teacherFullName}
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Enseignant / Corps professoral · ID: <span className="font-mono text-slate-500">{teacher.id.substring(0, 8)}...</span>
              </p>

              {/* Subject & Class pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {cleanSubjects.length > 0 ? (
                  cleanSubjects.map((subj, idx) => (
                    <span 
                      key={idx}
                      className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1"
                    >
                      <BookOpen size={11} className="text-blue-500" />
                      {subj}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400 italic">Aucune matière assignée</span>
                )}

                {teacher.classes.length > 0 && teacher.classes.map((cls: any) => (
                  <span 
                    key={cls.id}
                    className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1"
                  >
                    <Users size={11} className="text-purple-500" />
                    Classe {cls.name}
                  </span>
                ))}
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
                Salaire Mensuel
              </span>
              <span className="text-xl font-black text-emerald-800 block mt-0.5">
                {fmt(teacher.salary)}
              </span>
            </div>
          </div>
        </div>

        {/* Metadata Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
              <Phone size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Téléphone</span>
              {teacher.phone ? (
                <a href={`tel:${teacher.phone}`} className="font-semibold text-slate-700 hover:text-blue-600 truncate block">
                  {teacher.phone}
                </a>
              ) : (
                <span className="text-slate-400 italic">Non renseigné</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
              <CalendarIcon size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Naissance</span>
              <span className="font-semibold text-slate-700 block">
                {new Intl.DateTimeFormat("fr-FR").format(new Date(teacher.birthday))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-rose-500 border border-slate-100 shrink-0">
              <Droplet size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Groupe Sanguin</span>
              <span className="font-semibold text-slate-700 block">
                {teacher.bloodType || "Inconnu"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
              <Clock size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Volume Horaire</span>
              <span className="font-semibold text-indigo-700 block">
                {totalHours}h / semaine
              </span>
            </div>
          </div>
        </div>

        {/* 4 Sleek Quick Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center font-black text-sm shrink-0">
              {teacher._count.classes}
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">Classes</span>
              <span className="text-[10px] text-slate-400 font-medium">assignées</span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center font-black text-sm shrink-0">
              {cleanSubjects.length}
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">Matières</span>
              <span className="text-[10px] text-slate-400 font-medium">enseignées</span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center font-black text-sm shrink-0">
              {scheduleItems.length}
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">Séances / sem.</span>
              <span className="text-[10px] text-slate-400 font-medium">{totalHours}h de cours</span>
            </div>
          </div>

          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
              {teacher.payments.length}
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">Versements</span>
              <span className="text-[10px] text-slate-400 font-medium">{fmt(totalPaid)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WORKSPACE TABS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 flex-wrap">
        <div className="flex items-center gap-2" role="tablist" aria-label="Espaces de travail">
          {/* FINANCE TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "finance"}
            onClick={() => handleTabChange("finance")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === "finance"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <Wallet size={15} />
            <span>Rémunération & Finances</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "finance" ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
            }`}>
              {fmt(totalPaid)}
            </span>
          </button>

          {/* SCHEDULE TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            onClick={() => handleTabChange("schedule")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === "schedule"
                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <Calendar size={15} />
            <span>Emploi du temps</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "schedule" ? "bg-white/20 text-white" : "bg-indigo-50 text-indigo-700"
            }`}>
              {totalHours}h / sem
            </span>
          </button>

          {/* OVERVIEW TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => handleTabChange("overview")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none ${
              activeTab === "overview"
                ? "bg-slate-800 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <LayoutGrid size={15} />
            <span className="hidden sm:inline">Vue complète</span>
          </button>
        </div>
      </div>

      {/* 4. TAB PANELS (Persistent Mounting with 0ms instantaneous CSS toggle) */}
      <div className="w-full flex flex-col gap-6">
        {/* Finance Hub */}
        <div className={activeTab === "finance" || activeTab === "overview" ? "w-full" : "hidden"}>
          <TeacherFinanceHub
            key={teacher.id}
            teacherId={teacher.id}
            teacherName={teacherFullName}
            salary={teacher.salary}
            hourlyRate={teacher.hourlyRate}
            hoursPerMonth={teacher.hoursPerMonth}
            payments={teacher.payments}
            expenses={expenses}
            isAdmin={isAdmin}
          />
        </div>

        {/* Schedule */}
        <div className={activeTab === "schedule" || activeTab === "overview" ? "w-full" : "hidden"}>
          <TeacherSchedule 
            key={teacher.id}
            items={scheduleItems}
            teacherName={teacherFullName}
          />
        </div>
      </div>

      {/* Floating Edge Trigger (when closed & not pinned) */}
      <FloatingTeacherNavTrigger
        onOpen={() => setIsSideNavOpen(true)}
        totalTeachers={allTeachers.length}
        isPinned={isSideNavPinned}
      />

      {/* Side Drawer / Panel */}
      <TeacherSideDrawer
        currentTeacherId={teacher.id}
        teachers={allTeachers}
        isOpen={isSideNavOpen}
        isPinned={isSideNavPinned}
        onClose={() => setIsSideNavOpen(false)}
        onToggleOpen={() => setIsSideNavOpen((prev) => !prev)}
        onTogglePin={handleTogglePin}
        onSelectTeacher={handleSelectTeacher}
        onPrefetchTeacher={handlePrefetchTeacher}
        activeTab={activeTab}
      />
    </div>
  );
}
