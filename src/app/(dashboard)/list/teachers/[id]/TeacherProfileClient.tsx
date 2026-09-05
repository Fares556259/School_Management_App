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
  teacher: initialTeacher,
  expenses: initialExpenses = [],
  cleanSubjects: initialCleanSubjects,
  scheduleItems: initialScheduleItems,
  teacherFullName: initialTeacherFullName,
  totalHours: initialTotalHours,
  isAdmin,
  allTeachers = [],
}: TeacherProfileClientProps) {
  const [activeTab, setActiveTab] = useState<"finance" | "schedule" | "overview">("finance");
  const [isSideNavOpen, setIsSideNavOpen] = useState(false);
  const [isSideNavPinned, setIsSideNavPinned] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const [currentBundle, setCurrentBundle] = useState<TeacherBundle>({
    teacher: initialTeacher,
    expenses: initialExpenses,
    cleanSubjects: initialCleanSubjects,
    scheduleItems: initialScheduleItems,
    teacherFullName: initialTeacherFullName,
    totalHours: initialTotalHours,
  });

  const cacheRef = useRef<Map<string, TeacherBundle>>(new Map());
  const fetchingIdsRef = useRef<Set<string>>(new Set());

  // Seed cache on mount / initial teacher change
  useEffect(() => {
    cacheRef.current.set(initialTeacher.id, {
      teacher: initialTeacher,
      expenses: initialExpenses,
      cleanSubjects: initialCleanSubjects,
      scheduleItems: initialScheduleItems,
      teacherFullName: initialTeacherFullName,
      totalHours: initialTotalHours,
    });
  }, [initialTeacher, initialExpenses, initialCleanSubjects, initialScheduleItems, initialTeacherFullName, initialTotalHours]);

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

  const fetchTeacherBundle = useCallback(async (id: string): Promise<TeacherBundle | null> => {
    if (cacheRef.current.has(id)) {
      return cacheRef.current.get(id)!;
    }
    if (fetchingIdsRef.current.has(id)) {
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (cacheRef.current.has(id)) {
            clearInterval(interval);
            resolve(cacheRef.current.get(id)!);
          }
          if (!fetchingIdsRef.current.has(id) && !cacheRef.current.has(id)) {
            clearInterval(interval);
            resolve(null);
          }
        }, 30);
      });
    }

    fetchingIdsRef.current.add(id);
    try {
      const res = await getTeacherProfileBundle(id);
      if (res.success && res.data) {
        cacheRef.current.set(id, res.data as TeacherBundle);
        return res.data as TeacherBundle;
      }
      return null;
    } catch {
      return null;
    } finally {
      fetchingIdsRef.current.delete(id);
    }
  }, []);

  const handleSelectTeacher = useCallback(async (id: string) => {
    if (id === currentBundle.teacher.id) return;

    // Instant 0ms switch if already cached
    if (cacheRef.current.has(id)) {
      const bundle = cacheRef.current.get(id)!;
      setCurrentBundle(bundle);
      window.history.pushState({ teacherId: id }, "", `/list/teachers/${id}`);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      return;
    }

    // Otherwise fetch smoothly without unmounting or blurring
    setIsSwitching(true);
    const bundle = await fetchTeacherBundle(id);
    setIsSwitching(false);

    if (bundle) {
      setCurrentBundle(bundle);
      window.history.pushState({ teacherId: id }, "", `/list/teachers/${id}`);
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    } else {
      window.location.href = `/list/teachers/${id}`;
    }
  }, [currentBundle.teacher.id, fetchTeacherBundle]);

  const handlePrefetchTeacher = useCallback((id: string) => {
    if (!cacheRef.current.has(id) && !fetchingIdsRef.current.has(id)) {
      fetchTeacherBundle(id);
    }
  }, [fetchTeacherBundle]);

  // Proactive adjacent prefetching: immediately cache previous and next teachers
  useEffect(() => {
    const currentIndex = allTeachers.findIndex((t) => t.id === currentBundle.teacher.id);
    if (currentIndex !== -1) {
      const prev = currentIndex > 0 ? allTeachers[currentIndex - 1] : null;
      const next = currentIndex < allTeachers.length - 1 ? allTeachers[currentIndex + 1] : null;

      if (next) handlePrefetchTeacher(next.id);
      if (prev) handlePrefetchTeacher(prev.id);

      // Background prefetch remaining teachers in idle time
      const timer = setTimeout(() => {
        allTeachers.forEach((t) => {
          if (t.id !== currentBundle.teacher.id) {
            handlePrefetchTeacher(t.id);
          }
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [currentBundle.teacher.id, allTeachers, handlePrefetchTeacher]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/list\/teachers\/([^/?#]+)/);
      if (match && match[1]) {
        const idFromUrl = match[1];
        if (idFromUrl !== currentBundle.teacher.id) {
          if (cacheRef.current.has(idFromUrl)) {
            setCurrentBundle(cacheRef.current.get(idFromUrl)!);
          } else {
            fetchTeacherBundle(idFromUrl).then((b) => {
              if (b) setCurrentBundle(b);
            });
          }
        }
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentBundle.teacher.id, fetchTeacherBundle]);

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
      {/* Subtle top indicator during first-time cold fetch */}
      {isSwitching && (
        <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 animate-pulse z-[9999]" />
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
              isSwitching={isSwitching}
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
        <div className="flex items-center gap-2">
          {/* FINANCE TAB */}
          <button
            onClick={() => setActiveTab("finance")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
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
            onClick={() => setActiveTab("schedule")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
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
            onClick={() => setActiveTab("overview")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
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

      {/* 4. TAB PANELS */}
      {activeTab === "finance" && (
        <div className="w-full">
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
      )}

      {activeTab === "schedule" && (
        <div className="w-full">
          <TeacherSchedule 
            key={teacher.id}
            items={scheduleItems}
            teacherName={teacherFullName}
          />
        </div>
      )}

      {activeTab === "overview" && (
        <div className="flex flex-col gap-6 w-full">
          <TeacherFinanceHub
            key={`hub-${teacher.id}`}
            teacherId={teacher.id}
            teacherName={teacherFullName}
            salary={teacher.salary}
            hourlyRate={teacher.hourlyRate}
            hoursPerMonth={teacher.hoursPerMonth}
            payments={teacher.payments}
            expenses={expenses}
            isAdmin={isAdmin}
          />
          <TeacherSchedule 
            key={`sched-${teacher.id}`}
            items={scheduleItems}
            teacherName={teacherFullName}
          />
        </div>
      )}

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
      />
    </div>
  );
}
