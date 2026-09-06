"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormModal from "@/components/FormModal";
import { getUserAvatar } from "@/lib/avatar";
import { getStudentProfileBundle, getClassStudentsBundles } from "./actions";
import { 
  StudentBreadcrumbNav, 
  StudentSideDrawer, 
  FloatingStudentNavTrigger, 
  QuickStudentItem 
} from "./StudentQuickNav";
import StudentTuitionTab from "./tabs/StudentTuitionTab";
import StudentGradesTab from "./tabs/StudentGradesTab";
import StudentAttendanceTab from "./tabs/StudentAttendanceTab";
import StudentScheduleTab, { StudentScheduleItem } from "./tabs/StudentScheduleTab";
import { 
  Phone, 
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
  AlertCircle,
  Award,
  MessageCircle,
  Mail,
  GraduationCap,
  ShieldCheck,
  ShieldAlert,
  TrendingUp,
  UserCheck,
  Loader2,
  Copy,
  Check
} from "lucide-react";

export interface StudentBundle {
  student: any;
  payments: any[];
  attendances: any[];
  grades: any[];
  scheduleItems: StudentScheduleItem[];
  studentFullName: string;
  totalWeeklyHours: number;
}

interface StudentProfileClientProps {
  initialStudentId?: string;
  initialBundlesMap?: Record<string, StudentBundle>;
  student: any;
  payments?: any[];
  attendances?: any[];
  grades?: any[];
  scheduleItems?: StudentScheduleItem[];
  studentFullName: string;
  totalWeeklyHours: number;
  levelTuitionFee: number;
  gradeLevel: number;
  isAdmin: boolean;
  classmates?: QuickStudentItem[];
  allStudents?: QuickStudentItem[];
}

export default function StudentProfileClient({
  initialStudentId,
  initialBundlesMap,
  student: initialStudent,
  payments: initialPayments = [],
  attendances: initialAttendances = [],
  grades: initialGrades = [],
  scheduleItems: initialScheduleItems = [],
  studentFullName: initialStudentFullName,
  totalWeeklyHours: initialTotalWeeklyHours = 0,
  levelTuitionFee,
  gradeLevel,
  isAdmin,
  classmates = [],
  allStudents = [],
}: StudentProfileClientProps) {
  // Sync activeTab with URL ?tab= query parameter on mount if present
  const [activeTab, setActiveTab] = useState<"tuition" | "grades" | "attendance" | "schedule" | "overview">(() => {
    if (typeof window !== "undefined") {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const tabParam = urlParams.get("tab");
        if (
          tabParam === "grades" || 
          tabParam === "attendance" || 
          tabParam === "schedule" || 
          tabParam === "overview" || 
          tabParam === "tuition"
        ) {
          return tabParam;
        }
      } catch {}
    }
    return "tuition";
  });

  const [isSideNavOpen, setIsSideNavOpen] = useState(true);

  // Active student ID
  const [activeStudentId, setActiveStudentId] = useState<string>(
    initialStudentId || initialStudent.id
  );

  const router = useRouter();
  const [loadingStudentId, setLoadingStudentId] = useState<string | null>(null);

  // In-memory preloaded bundles map for instant 0ms switching
  const [bundlesMap, setBundlesMap] = useState<Record<string, StudentBundle>>(() => {
    if (initialBundlesMap && Object.keys(initialBundlesMap).length > 0) {
      return initialBundlesMap;
    }
    return {
      [initialStudent.id]: {
        student: initialStudent,
        payments: initialPayments,
        attendances: initialAttendances,
        grades: initialGrades,
        scheduleItems: initialScheduleItems,
        studentFullName: initialStudentFullName,
        totalWeeklyHours: initialTotalWeeklyHours,
      },
    };
  });

  // Smooth tab change with URL synchronization
  const handleTabChange = useCallback((tab: "tuition" | "grades" | "attendance" | "schedule" | "overview") => {
    setActiveTab(tab);
    try {
      const url = new URL(window.location.href);
      if (tab === "tuition") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
  }, []);

  // Track previous initial student ID so we ONLY sync if the server prop actually changes
  const prevInitialStudentIdRef = useRef(initialStudentId);
  useEffect(() => {
    if (initialStudentId && initialStudentId !== prevInitialStudentIdRef.current) {
      prevInitialStudentIdRef.current = initialStudentId;
      setActiveStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (initialBundlesMap) {
      setBundlesMap((prev) => ({ ...prev, ...initialBundlesMap }));
    }
  }, [initialBundlesMap]);

  // Sync open preference with localStorage (open by default on desktop, closed by default on mobile)
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 1024) {
          setIsSideNavOpen(false);
          return;
        }
        const saved = localStorage.getItem("student_nav_open");
        if (saved === "false") {
          setIsSideNavOpen(false);
        } else {
          setIsSideNavOpen(true);
        }
      }
    } catch {}
  }, []);

  const handleToggleSideNav = useCallback(() => {
    setIsSideNavOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("student_nav_open", String(next));
      } catch {}
      return next;
    });
  }, []);

  const handleCloseSideNav = useCallback(() => {
    setIsSideNavOpen(false);
    try {
      localStorage.setItem("student_nav_open", "false");
    } catch {}
  }, []);

  const handleOpenSideNav = useCallback(() => {
    setIsSideNavOpen(true);
    try {
      localStorage.setItem("student_nav_open", "true");
    } catch {}
  }, []);

  const handlePrefetchStudent = useCallback((id: string) => {
    if (!id || bundlesMap[id] || id === activeStudentId) return;
    getStudentProfileBundle(id).then((res) => {
      if (res.success && res.data) {
        setBundlesMap((prev) => ({ ...prev, [id]: res.data as StudentBundle }));
      }
    }).catch(() => {});
  }, [bundlesMap, activeStudentId]);

  const prefetchedClassesRef = useRef<Set<number>>(new Set());
  const handlePrefetchClass = useCallback((classId: number) => {
    if (!classId || prefetchedClassesRef.current.has(classId)) return;
    prefetchedClassesRef.current.add(classId);
    getClassStudentsBundles(classId).then((res) => {
      if (res.success && res.data) {
        setBundlesMap((prev) => ({ ...prev, ...(res.data as Record<string, StudentBundle>) }));
      }
    }).catch(() => {});
  }, []);

  // Instant synchronous student switch (0ms) or fast async in-memory fetch (NO hard reload)
  const handleSelectStudent = useCallback(async (id: string) => {
    if (!id || id === activeStudentId) return;

    const tabSuffix = activeTab !== "tuition" ? `?tab=${activeTab}` : "";

    // 1. Instant 0ms switch if already preloaded in memory
    if (bundlesMap && bundlesMap[id]) {
      setActiveStudentId(id);
      try {
        window.history.pushState({ studentId: id }, "", `/list/students/${id}${tabSuffix}`);
      } catch {}
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {}
      return;
    }

    // 2. Dynamic in-memory fetch without full document reload
    setLoadingStudentId(id);
    try {
      const res = await getStudentProfileBundle(id);
      if (res.success && res.data) {
        setBundlesMap((prev) => ({ ...prev, [id]: res.data as StudentBundle }));
        setActiveStudentId(id);
        try {
          window.history.pushState({ studentId: id }, "", `/list/students/${id}${tabSuffix}`);
        } catch {}
        try {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } catch {}
      } else {
        // Fallback to Next.js soft client-side router transition
        router.push(`/list/students/${id}${tabSuffix}`);
      }
    } catch (err) {
      console.error("Async student switch error:", err);
      router.push(`/list/students/${id}${tabSuffix}`);
    } finally {
      setLoadingStudentId(null);
    }
  }, [activeStudentId, bundlesMap, activeTab, router]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const match = window.location.pathname.match(/\/list\/students\/([^/?#]+)/);
      if (match && match[1]) {
        const idFromUrl = match[1];
        if (bundlesMap[idFromUrl]) {
          setActiveStudentId(idFromUrl);
        }
      }
      try {
        const url = new URL(window.location.href);
        const tabParam = url.searchParams.get("tab");
        if (
          tabParam === "grades" || 
          tabParam === "attendance" || 
          tabParam === "schedule" || 
          tabParam === "overview" || 
          tabParam === "tuition"
        ) {
          setActiveTab(tabParam);
        } else {
          setActiveTab("tuition");
        }
      } catch {}
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [bundlesMap]);

  const currentBundle = bundlesMap[activeStudentId] || {
    student: initialStudent,
    payments: initialPayments,
    attendances: initialAttendances,
    grades: initialGrades,
    scheduleItems: initialScheduleItems,
    studentFullName: initialStudentFullName,
    totalWeeklyHours: initialTotalWeeklyHours,
  };

  const {
    student,
    payments,
    attendances,
    grades,
    scheduleItems,
    studentFullName,
    totalWeeklyHours,
  } = currentBundle;

  const fmt = (n: number) => n.toLocaleString("en-US").replace(/,/g, " ") + " DT";

  // Tuition & Grade Level metrics dynamically derived from active student
  const currentLevelTuitionFee = student.class?.level?.tuitionFee ?? levelTuitionFee;
  const currentGradeLevel = student.class?.level?.level ?? gradeLevel;
  const monthlyRate = student.customTuition ?? currentLevelTuitionFee;
  const totalPaid = payments.reduce((acc: number, p: any) => acc + (p.amount || 0), 0);

  // Attendance metrics
  const totalAttendances = attendances.length;
  const unexcusedAbsences = attendances.filter(
    (a: any) => a.status === "ABSENT" && a.justificationStatus !== "APPROVED" && a.justificationStatus !== "EXCUSED"
  ).length;
  const presentCount = attendances.filter((a: any) => a.status === "PRESENT" || a.status === "LATE").length;
  const attendanceRate = totalAttendances > 0 ? Math.round((presentCount / totalAttendances) * 100) : 100;

  // Academic metrics (Overall average across all entered grades)
  const averageGrade = useMemo(() => {
    if (!grades || grades.length === 0) return null;
    const sum = grades.reduce((acc: number, g: any) => acc + (g.score || 0), 0);
    return (sum / grades.length).toFixed(2);
  }, [grades]);

  // Derive current student's classmates dynamically based on active student's class
  const activeClassId = student.classId;
  const currentClassmates = useMemo(() => {
    if (activeClassId && allStudents && allStudents.length > 0) {
      const filtered = allStudents.filter((s) => s.classId === activeClassId);
      if (filtered.length > 0) return filtered;
    }
    return classmates;
  }, [activeClassId, allStudents, classmates]);

  // Clean WhatsApp phone number & parent contact
  const parentPhone = student.parent?.phone || student.phone || "";
  const isStudentDirectPhone = !student.parent?.phone && Boolean(student.phone);
  const cleanWhatsAppPhone = useMemo(() => {
    if (!parentPhone) return "";
    let p = parentPhone.replace(/\D/g, "");
    if (p.length === 8) {
      p = "216" + p; // Default Tunisia country code for local 8-digit numbers
    }
    return p;
  }, [parentPhone]);

  const [copiedPhone, setCopiedPhone] = useState(false);
  const handleCopyPhone = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!parentPhone) return;
    try {
      navigator.clipboard.writeText(parentPhone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } catch {}
  }, [parentPhone]);

  return (
    <div className="flex-1 p-4 lg:p-6 flex flex-col gap-6 max-w-[1700px] mx-auto w-full transition-all duration-300 relative">
      {/* Top progress indicator during async student fetch */}
      {loadingStudentId && (
        <div className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-gradient-to-r from-blue-600 via-purple-600 to-emerald-500 animate-pulse transition-all shadow-sm" />
      )}

      {/* 1. TOP BREADCRUMB & QUICK NAV */}
      <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0">
          <Link 
            href="/list/students" 
            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors font-medium text-slate-600 shrink-0"
          >
            <ArrowLeft size={16} />
            <span>Élèves</span>
          </Link>
          <span className="text-slate-300 shrink-0">/</span>
          {student.class?.name && (
            <>
              <Link 
                href={`/list/classes/${student.classId}`}
                className="hover:text-blue-600 transition-colors font-medium text-slate-600 truncate"
              >
                Classe {student.class.name}
              </Link>
              <span className="text-slate-300 shrink-0">/</span>
            </>
          )}
          <span className="font-semibold text-slate-800 truncate max-w-[150px] sm:max-w-none">
            {studentFullName}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Inscrit
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Stepper & Switcher */}
          {currentClassmates.length > 0 && (
            <StudentBreadcrumbNav
              currentStudentId={student.id}
              students={currentClassmates}
              onOpenList={handleOpenSideNav}
              onSelectStudent={handleSelectStudent}
              onPrefetchStudent={handlePrefetchStudent}
              loadingStudentId={loadingStudentId}
              activeTab={activeTab}
            />
          )}

          {/* Toggle Directory Button */}
          <button
            type="button"
            onClick={handleToggleSideNav}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
              isSideNavOpen
                ? "bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
            title={isSideNavOpen ? "Masquer le volet des élèves" : "Afficher l'annuaire des élèves"}
          >
            <GraduationCap size={15} className={isSideNavOpen ? "text-blue-600" : "text-slate-500"} />
            <span>{isSideNavOpen ? "Masquer l'annuaire" : `Annuaire (${(allStudents.length > 0 ? allStudents : classmates).length})`}</span>
          </button>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <FormModal key={student.id} table="student" type="update" data={student} />
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace: Left Column (Profile & Content) + Right Column (Docked Directory) */}
      <div className="flex items-start gap-6 w-full">
        {/* Left Column */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          {/* 2. UNIFIED STUDENT IDENTITY & METRIC HEADER */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm relative overflow-hidden flex flex-col gap-5">
        {/* Subtle accent line */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500" />

        {/* Identity & Main Info */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden relative border-2 border-slate-100 shadow-sm bg-slate-50 shrink-0">
              <Image
                src={getUserAvatar(student.img, "student", student.sex)}
                alt={studentFullName}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">
                  {studentFullName}
                </h1>
              </div>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Élève · Matricule : <span className="font-mono text-slate-600 font-bold">{student.id}</span>
              </p>

              {/* Class & Level pills */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                {student.class ? (
                  <Link
                    href={`/list/classes/${student.classId}`}
                    className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-100 flex items-center gap-1 hover:bg-purple-100 transition-colors"
                  >
                    <Users size={11} className="text-purple-500" />
                    Classe {student.class.name}
                  </Link>
                ) : (
                  <span className="text-xs text-slate-400 italic">Non assigné à une classe</span>
                )}

                <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100 flex items-center gap-1">
                  <GraduationCap size={11} className="text-blue-500" />
                  {gradeLevel === 0 ? "Préscolaire" : `Niveau ${gradeLevel}`}
                </span>

                {student.sex && (
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 flex items-center gap-1">
                    {student.sex === "MALE" ? "Garçon" : "Fille"}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Monthly Tuition Rate Badge */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-4 py-2.5 flex items-center gap-3 self-start md:self-auto">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Banknote size={20} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 block tracking-wider leading-none">
                Tarif Mensuel
              </span>
              <span className="text-xl font-black text-emerald-800 block mt-0.5">
                {fmt(monthlyRate)}
              </span>
              {student.customTuition !== null && student.customTuition !== undefined && (
                <span className="text-[10px] text-emerald-600 font-bold block">
                  (Tarif personnalisé)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Parent Contact & Student Metadata Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
          {/* Parent Name & Direct Contact Actions */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="min-w-0 flex-1 truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Parent / Tuteur</span>
              <span className="font-bold text-slate-800 block truncate text-xs">
                {student.parent ? `${student.parent.name} ${student.parent.surname}` : "Non renseigné"}
              </span>
              {parentPhone ? (
                <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                  <a
                    href={`tel:${parentPhone}`}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 truncate transition-colors"
                    title={`Appeler : ${parentPhone}`}
                  >
                    <Phone size={10} className="text-blue-500 shrink-0" />
                    <span className="truncate">{parentPhone}</span>
                  </a>
                  {isStudentDirectPhone && (
                    <span className="text-[9px] font-medium text-slate-400 shrink-0">
                      (Élève)
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-[10px] text-slate-400 italic block truncate mt-0.5">
                  Aucun numéro
                </span>
              )}
            </div>
            {parentPhone && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                  title={copiedPhone ? "Numéro copié !" : `Copier : ${parentPhone}`}
                >
                  {copiedPhone ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
                <a
                  href={`tel:${parentPhone}`}
                  className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                  title={`Appeler : ${parentPhone}`}
                >
                  <Phone size={13} />
                </a>
                {cleanWhatsAppPhone && (
                  <a
                    href={`https://wa.me/${cleanWhatsAppPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-lg bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
                    title="Envoyer un message WhatsApp"
                  >
                    <MessageCircle size={13} />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Birthday */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-slate-500 border border-slate-100 shrink-0">
              <CalendarIcon size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Date de Naissance</span>
              <span className="font-semibold text-slate-700 block">
                {student.birthday ? new Intl.DateTimeFormat("fr-FR").format(new Date(student.birthday)) : "-"}
              </span>
            </div>
          </div>

          {/* Blood Type */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-rose-500 border border-slate-100 shrink-0">
              <Droplet size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Groupe Sanguin</span>
              <span className="font-semibold text-slate-700 block">
                {student.bloodType || "Inconnu"}
              </span>
            </div>
          </div>

          {/* Weekly Hours */}
          <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/80 border border-slate-100">
            <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center text-indigo-600 border border-slate-100 shrink-0">
              <Clock size={13} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Volume Horaire</span>
              <span className="font-semibold text-indigo-700 block">
                {totalWeeklyHours}h / semaine
              </span>
            </div>
          </div>
        </div>

        {/* 4 Sleek Quick Real Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          {/* Scolarité Total Versé */}
          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-700 flex items-center justify-center font-black text-sm shrink-0">
              <CreditCard size={15} />
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">{fmt(totalPaid)}</span>
              <span className="text-[10px] text-slate-400 font-medium">scolarité réglée</span>
            </div>
          </div>

          {/* Moyenne Générale */}
          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center font-black text-sm shrink-0">
              <Award size={15} />
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">
                {averageGrade ? `${averageGrade} / 20` : "Non noté"}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">moyenne générale</span>
            </div>
          </div>

          {/* Assiduité */}
          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
              attendanceRate >= 90 ? "bg-blue-100/80 text-blue-700" : "bg-rose-100/80 text-rose-700"
            }`}>
              <Clock size={15} />
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">{attendanceRate}%</span>
              <span className="text-[10px] text-slate-400 font-medium">
                {unexcusedAbsences > 0 ? `${unexcusedAbsences} abs. injustifiée(s)` : "présence régulière"}
              </span>
            </div>
          </div>

          {/* Emploi du Temps */}
          <div className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center font-black text-sm shrink-0">
              <Calendar size={15} />
            </div>
            <div className="leading-tight">
              <span className="text-xs font-bold text-slate-800 block">{scheduleItems.length} séances</span>
              <span className="text-[10px] text-slate-400 font-medium">{totalWeeklyHours}h par semaine</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. WORKSPACE TABS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 pb-3 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Espaces de travail">
          {/* TUITION TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "tuition"}
            onClick={() => handleTabChange("tuition")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "tuition"
                ? "bg-emerald-600 text-white shadow-sm shadow-emerald-200"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <Wallet size={15} />
            <span>Scolarité & Finances</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "tuition" ? "bg-white/20 text-white" : "bg-emerald-50 text-emerald-700"
            }`}>
              {fmt(totalPaid)}
            </span>
          </button>

          {/* GRADES TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "grades"}
            onClick={() => handleTabChange("grades")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "grades"
                ? "bg-purple-600 text-white shadow-sm shadow-purple-200"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <Award size={15} />
            <span>Notes & Bulletins</span>
            {averageGrade && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === "grades" ? "bg-white/20 text-white" : "bg-purple-50 text-purple-700"
              }`}>
                {averageGrade}/20
              </span>
            )}
          </button>

          {/* ATTENDANCE TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "attendance"}
            onClick={() => handleTabChange("attendance")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
              activeTab === "attendance"
                ? "bg-amber-600 text-white shadow-sm shadow-amber-200"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60"
            }`}
          >
            <Clock size={15} />
            <span>Assiduité & Discipline</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === "attendance" ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"
            }`}>
              {attendanceRate}%
            </span>
          </button>

          {/* SCHEDULE TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "schedule"}
            onClick={() => handleTabChange("schedule")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
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
              {totalWeeklyHours}h
            </span>
          </button>

          {/* OVERVIEW TAB */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => handleTabChange("overview")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none shrink-0 ${
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
        {/* Tuition Hub */}
        <div className={activeTab === "tuition" || activeTab === "overview" ? "w-full" : "hidden"}>
          <StudentTuitionTab
            key={student.id}
            studentId={student.id}
            studentName={studentFullName}
            gradeLevel={currentGradeLevel}
            customTuition={student.customTuition}
            levelTuitionFee={currentLevelTuitionFee}
            payments={payments}
            isAdmin={isAdmin}
          />
        </div>

        {/* Grades Hub */}
        <div className={activeTab === "grades" || activeTab === "overview" ? "w-full" : "hidden"}>
          <StudentGradesTab
            key={student.id}
            studentId={student.id}
            studentName={studentFullName}
            classId={student.classId}
            className={student.class?.name}
            gradeLevel={currentGradeLevel}
            grades={grades}
            isAdmin={isAdmin}
          />
        </div>

        {/* Attendance Hub */}
        <div className={activeTab === "attendance" || activeTab === "overview" ? "w-full" : "hidden"}>
          <StudentAttendanceTab
            key={student.id}
            studentId={student.id}
            studentName={studentFullName}
            attendances={attendances}
            isAdmin={isAdmin}
          />
        </div>

        {/* Schedule */}
        <div className={activeTab === "schedule" || activeTab === "overview" ? "w-full" : "hidden"}>
          <StudentScheduleTab
            key={student.id}
            items={scheduleItems}
            studentName={studentFullName}
            className={student.class?.name}
          />
        </div>
      </div>
    </div>

    {/* Right Column: Docked Directory Sidebar (Desktop) & Overlay Drawer (Mobile) */}
    {isSideNavOpen && (
      <StudentSideDrawer
        currentStudentId={student.id}
        currentClassName={student.class?.name}
        students={allStudents.length > 0 ? allStudents : classmates}
        isOpen={isSideNavOpen}
        onClose={handleCloseSideNav}
        onToggleOpen={handleToggleSideNav}
        onSelectStudent={handleSelectStudent}
        onPrefetchStudent={handlePrefetchStudent}
        onPrefetchClass={handlePrefetchClass}
        loadingStudentId={loadingStudentId}
        activeTab={activeTab}
      />
    )}
  </div>

  {/* Floating Edge Trigger (when closed) */}
  {!isSideNavOpen && (
    <FloatingStudentNavTrigger
      onOpen={handleOpenSideNav}
      totalStudents={allStudents.length > 0 ? allStudents.length : classmates.length}
    />
  )}
</div>
);
}
