"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  ShieldCheck,
  Users,
  Calendar,
  Smartphone,
  Bell,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Building2,
  Lock,
  Zap,
  MessageSquare,
  Award,
  GraduationCap,
  ClipboardList,
  CreditCard,
  FileText,
  Mail,
  Clock,
  LayoutDashboard,
  Menu as MenuIcon,
  X,
  Plus,
  Layers,
  Globe,
  ChevronDown,
} from "lucide-react";

/* ─────────── ANIMATION HELPERS ─────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

function Section({
  children,
  className = "",
  delay = 0,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      id={id}
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={{
        hidden: { opacity: 0, y: 40 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.6, ease: "easeOut" as const, delay },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─────────── ANIMATED COUNTER ─────────── */
function CountUp({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const hasRun = useRef(false);

  useEffect(() => {
    if (!inView || hasRun.current) return;
    hasRun.current = true;
    const duration = 1500;
    const steps = 40;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [inView, target]);

  return <span ref={ref}>{prefix}{count}{suffix}</span>;
}

/* ─────────── NAVBAR ─────────── */
const Navbar = ({
  isSignedIn,
  handleLoginClick,
  router,
}: {
  isSignedIn: boolean;
  handleLoginClick: () => void;
  router: any;
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Aperçu", href: "#apercu" },
    { label: "Système Tunisien", href: "#tunisie" },
    { label: "Modules", href: "#modules" },
    { label: "Application Parents", href: "#parents" },
    { label: "Tarifs", href: "#tarifs" },
    { label: "FAQ", href: "#faq" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const targetId = href.replace("#", "");
    const elem = document.getElementById(targetId);
    if (elem) {
      const yOffset = -70;
      const y = elem.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-white"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              SnapSchool
            </span>
          </div>

          <nav className="hidden lg:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => handleNavClick(e, l.href)}
                className="text-[13px] font-medium text-gray-500 hover:text-blue-600 transition-colors cursor-pointer"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <button
                  onClick={handleLoginClick}
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 px-4 py-2 transition-colors cursor-pointer"
                >
                  Connexion
                </button>
                <button
                  onClick={() => router.push("/sign-up")}
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg transition-all hover:shadow-md cursor-pointer"
                >
                  Essai gratuit
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg transition-colors cursor-pointer"
              >
                Mon espace
              </button>
            )}
          </div>

          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden p-2 text-gray-600"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="lg:hidden overflow-hidden border-t border-gray-100"
            >
              <div className="py-4 space-y-2">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => {
                      setMobileOpen(false);
                      handleNavClick(e, l.href);
                    }}
                    className="block text-sm font-medium text-gray-700 hover:text-blue-600 py-2 cursor-pointer"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                  <button
                    onClick={() => { handleLoginClick(); setMobileOpen(false); }}
                    className="block w-full text-left text-sm font-medium text-gray-700 py-2"
                  >
                    Connexion
                  </button>
                  <button
                    onClick={() => { router.push("/sign-up"); setMobileOpen(false); }}
                    className="w-full text-sm font-semibold text-white bg-blue-600 px-5 py-2.5 rounded-lg"
                  >
                    Essai gratuit
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

/* ─────────── MAIN PAGE ─────────── */
export default function Homepage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user ?? null;
      if (user) {
        setIsSignedIn(true);
        const role = user.user_metadata?.role as string | undefined;
        if (role === "admin") router.push("/admin");
        else if (role === "superadmin") router.push("/superadmin");
        else if (role === "teacher") router.push("/teacher");
        else if (role === "student") router.push("/student");
        else if (role === "parent") router.push("/parent");
      }
    };
    fetchUser();
  }, [router, supabase]);

  const handleLoginClick = () => {
    if (isSignedIn) router.push("/admin");
    else router.push("/sign-in");
  };

  /* ── Essential Modules ── */
  const features = [
    {
      icon: FileText,
      title: "Notes et bulletins",
      description: "Saisie rapide par les enseignants, calcul automatique des moyennes trimestrielles avec coefficients officiels et génération de bulletins PDF prêts à imprimer.",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: ClipboardList,
      title: "Gestion des absences",
      description: "Appel numérique en 45 secondes par classe. Les parents reçoivent une alerte immédiate sur leur téléphone en cas d'absence ou de retard.",
      color: "bg-red-50 text-red-600",
    },
    {
      icon: CreditCard,
      title: "Paiements et finances",
      description: "Suivi en Dinars (DT) des écolages par tranche, alertes automatiques d'impayés, reçus numérotés et gestion des salaires et avances des professeurs.",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Calendar,
      title: "Emploi du temps anti-conflit",
      description: "Création intuitive des grilles horaires. Détection automatique des collisions de salles ou d'enseignants, avec créneaux flexibles de 1h ou 2h.",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: Smartphone,
      title: "Application mobile parents",
      description: "Application intuitive pour iOS et Android : suivi des notes en direct, notifications des absences, devoirs et annonces importantes de l'école.",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: ShieldCheck,
      title: "Sécurité & Audit horodaté",
      description: "Chaque modification administrative est enregistrée. Chiffrement complet des données scolaires et sauvegardes cloud quotidiennes automatiques.",
      color: "bg-gray-100 text-gray-700",
    },
  ];

  /* ── Essential FAQs ── */
  const faqs = [
    {
      q: "Combien de temps faut-il pour démarrer avec SnapSchool ?",
      a: "Votre espace est opérationnel en 48 heures. Nous prenons en charge gratuitement l'importation complète de vos données scolaires actuelles depuis vos fichiers Excel (élèves, professeurs, classes).",
    },
    {
      q: "SnapSchool est-il adapté aux normes éducatives tunisiennes ?",
      a: "Oui, parfaitement. La plateforme intègre le découpage en 3 trimestres, la distinction devoirs de contrôle (DC) et devoirs de synthèse (DS), la pondération par coefficient officiel et les bulletins conformes au modèle ministériel.",
    },
    {
      q: "Comment les parents accèdent-ils aux informations ?",
      a: "Les parents disposent d'une application mobile dédiée (iOS et Android) leur permettant de recevoir des alertes instantanées lors d'absences, de consulter les notes et bulletins dès publication, et de suivre les paiements.",
    },
    {
      q: "Quel accompagnement et support proposez-vous ?",
      a: "Chaque établissement bénéficie d'une assistance directe via WhatsApp disponible 7j/7, ainsi que d'une formation guidée pour la direction et l'équipe pédagogique lors de la mise en place.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* ═══════════ HERO ═══════════ */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 bg-gradient-to-b from-blue-50/70 via-blue-50/30 to-white relative overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-purple-100 rounded-full blur-3xl opacity-20 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center mb-14"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" />
              Plateforme de gestion scolaire complète
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-3xl sm:text-5xl lg:text-[3.5rem] font-bold leading-tight tracking-tight text-gray-900 mb-6">
              Gérez votre école privée <br className="hidden sm:block" />
              avec{" "}
              <span className="text-blue-600 relative">
                simplicité et efficacité
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                  <path d="M0 3C50 0.5 150 0.5 200 3" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
              Absences, notes, bulletins officiels tunisiens, paiements en DT, emploi du temps et communication avec les parents — le tout centralisé dans un seul espace sécurisé.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-lg transition-all hover:shadow-lg hover:shadow-blue-600/25 flex items-center justify-center gap-2 group cursor-pointer"
              >
                Commencer gratuitement
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20de%20SnapSchool"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-[15px] rounded-lg border border-gray-200 transition-all hover:border-gray-300 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-green-600" />
                Demander une démo WhatsApp
              </a>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview (Authentic App Mockup) */}
          <Section id="apercu">
            <div className="max-w-5xl mx-auto">
              <motion.div
                className="rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-2xl bg-white"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.3 }}
              >
                <div className="h-10 bg-gray-50 border-b border-gray-200 px-4 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-300" />
                    <div className="w-3 h-3 rounded-full bg-amber-300" />
                    <div className="w-3 h-3 rounded-full bg-green-300" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-mono text-gray-400 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-green-500" />
                      app.snapschool.io
                    </div>
                  </div>
                </div>

                <div className="bg-slate-100 p-2 sm:p-4 text-left text-xs font-sans select-none overflow-hidden">
                  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xl flex flex-col">
                    {/* Top App Header Bar */}
                    <div className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-800 text-base tracking-tight">Admin</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 text-xs">
                          <Bell className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium bg-slate-50">
                          <span>🇫🇷 Français</span>
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            A
                          </div>
                          <span className="text-red-500 font-semibold cursor-pointer hidden sm:inline">Déconnexion</span>
                        </div>
                      </div>
                    </div>

                    {/* App Main Body */}
                    <div className="flex min-h-[440px] sm:min-h-[500px]">
                      {/* Left Navigation Sidebar */}
                      <div className="w-48 bg-[#1e293b] text-slate-300 p-3 hidden md:flex flex-col justify-between shrink-0 text-xs">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between bg-slate-800/80 rounded-lg p-2 border border-slate-700/60">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="w-6 h-6 rounded bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-[10px] shrink-0">SS</div>
                              <span className="font-medium text-white truncate text-[11px]">Direction Lycée</span>
                            </div>
                            <span className="text-slate-400 text-[10px]">«</span>
                          </div>

                          {/* MAIN */}
                          <div>
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">MAIN</div>
                            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-blue-600 text-white font-semibold">
                              <LayoutDashboard className="w-4 h-4" />
                              <span>Accueil</span>
                            </div>
                          </div>

                          {/* ACADEMIQUE */}
                          <div>
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">ACADÉMIQUE</div>
                            <div className="space-y-0.5 text-slate-400">
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <Calendar className="w-3.5 h-3.5" /> <span>Emploi du temps</span>
                              </div>
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <FileText className="w-3.5 h-3.5" /> <span>Bulletins & Notes</span>
                              </div>
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <Building2 className="w-3.5 h-3.5" /> <span>Classes</span>
                              </div>
                            </div>
                          </div>

                          {/* COMMUNAUTÉ */}
                          <div>
                            <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">COMMUNAUTÉ</div>
                            <div className="space-y-0.5 text-slate-400">
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <Users className="w-3.5 h-3.5" /> <span>Élèves</span>
                              </div>
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <Smartphone className="w-3.5 h-3.5" /> <span>Parents</span>
                              </div>
                              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-800 hover:text-slate-200">
                                <GraduationCap className="w-3.5 h-3.5" /> <span>Enseignants</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Main Dashboard Content Area */}
                      <div className="flex-1 p-4 sm:p-6 bg-slate-50/60 space-y-5 overflow-hidden relative">
                        {/* Title & Action Bar */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Centre de Commandement</h2>
                            <p className="text-xs text-slate-500">Supervision financière & académique en temps réel</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-semibold hover:bg-slate-50 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-slate-500" /> Exporter PDF
                            </button>
                            <button className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1">
                              + Encaisser Écolage
                            </button>
                          </div>
                        </div>

                        {/* 5 Financial Metric Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                          {[
                            { label: "Solde Net", val: "38 450 DT", badge: "↑ +14%", color: "bg-emerald-100 text-emerald-700" },
                            { label: "Recettes Totales", val: "52 100 DT", badge: "↑ +12%", color: "bg-emerald-100 text-emerald-700" },
                            { label: "Dépenses & Salaires", val: "13 650 DT", badge: "↑ +3%", color: "bg-rose-100 text-rose-700" },
                            { label: "Marge de Profit", val: "73.8%", badge: "↑ +5%", color: "bg-emerald-100 text-emerald-700" },
                            { label: "Reste à Recouvrer", val: "2 400 DT", badge: "↓ -8%", color: "bg-amber-100 text-amber-700" },
                          ].map((card, i) => (
                            <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-semibold text-slate-500">{card.label}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${card.color}`}>{card.badge}</span>
                              </div>
                              <div className="text-base font-bold text-slate-900">{card.val}</div>
                              <span className="text-[10px] text-slate-400">vs période précédente</span>
                            </div>
                          ))}
                        </div>

                        {/* Operational Snapshot */}
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5">APERÇU OPÉRATIONNEL</div>
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            {[
                              { label: "Élèves Inscrits", val: "485", icon: GraduationCap, bg: "bg-blue-50 text-blue-600" },
                              { label: "Enseignants Actifs", val: "38", icon: Users, bg: "bg-purple-50 text-purple-600" },
                              { label: "Bulletins Validés", val: "485 / 485", icon: FileText, bg: "bg-emerald-50 text-emerald-600" },
                              { label: "Classes Actives", val: "14", icon: Building2, bg: "bg-indigo-50 text-indigo-600" },
                            ].map((op, i) => (
                              <div key={i} className="bg-white border border-slate-200 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${op.bg}`}>
                                    <op.icon className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <div className="text-lg font-bold text-slate-900 leading-none mb-1">{op.val}</div>
                                    <div className="text-[11px] text-slate-500 font-medium">{op.label}</div>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Growth Analytics Card */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                              <h3 className="font-bold text-slate-900 text-sm">Analyse de Recouvrement & Trésorerie</h3>
                              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">ANNÉE SCOLAIRE 2026/2027 EN DINARS (DT)</p>
                            </div>
                            <div className="flex items-center gap-6 text-xs font-semibold">
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Recettes: 52 100 DT
                              </span>
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Dépenses: 13 650 DT
                              </span>
                            </div>
                          </div>

                          <div className="h-20 flex items-end justify-between gap-2 pt-2 border-t border-slate-100">
                            {[40, 55, 65, 75, 85, 90, 95, 88, 92, 98, 100, 105].map((h, i) => (
                              <div key={i} className="flex-1 flex items-end gap-0.5 h-full">
                                <div className="w-full bg-emerald-500 rounded-t-xs" style={{ height: `${h * 0.7}%` }} />
                                <div className="w-full bg-rose-400/80 rounded-t-xs" style={{ height: `${h * 0.25}%` }} />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Floating Assistant Bot */}
                        <div className="absolute bottom-4 right-4 bg-white border border-blue-200 rounded-full p-2 shadow-xl flex items-center gap-2 cursor-pointer hover:scale-105 transition-transform">
                          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md">
                            🤖
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -top-0.5 -right-0.5 border-2 border-white" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          </Section>
        </div>
      </section>

      {/* ═══════════ TRUST BAR (animated counters) ═══════════ */}
      <section className="py-14 border-y border-gray-100 bg-slate-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { value: <><CountUp target={99} suffix=".9%" /></>, label: "Disponibilité garantie", icon: Zap },
              { value: <><CountUp target={10} suffix="x" /></>, label: "Saisie plus rapide", icon: Clock },
              { value: <>{'<'} 1s</>, label: "Alertes aux parents", icon: Bell },
              { value: <><CountUp target={100} suffix="%" /></>, label: "Adapté écoles privées", icon: CheckCircle2 },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center group">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 transition-colors">
                  <s.icon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1 font-medium">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ SYSTÈME TUNISIEN (Core Focus) ═══════════ */}
      <section id="tunisie" className="py-20 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
            <Section className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
                <Globe className="w-3.5 h-3.5" /> Adapté à la Tunisie
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
                Conçu pour le système éducatif tunisien
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-6">
                Fini les feuilles de calcul complexes : SnapSchool intègre nativement toutes les spécificités des établissements privés en Tunisie (Primaire, Collège et Lycée).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { title: "Trimestres", desc: "Découpage en 3 trimestres avec moyennes séparées et moyenne annuelle.", icon: Calendar },
                  { title: "DC et DS", desc: "Pondération exacte : Devoirs de contrôle (DC) et Devoirs de synthèse (DS).", icon: FileText },
                  { title: "Coefficients", desc: "Coefficients officiels par niveau pour un calcul automatisé des moyennes.", icon: BarChart3 },
                  { title: "Bulletins officiels", desc: "Édition en 1 clic de bulletins PDF aux normes du Ministère de l'Éducation.", icon: Award },
                  { title: "Bilingue FR / AR", desc: "Interface et documents disponibles en français et en arabe avec support RTL.", icon: Globe },
                  { title: "Vacances officielles", desc: "Calendrier scolaire synchronisé avec les vacances et jours fériés tunisiens.", icon: Clock },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 rounded-xl bg-white border border-gray-100 shadow-xs">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-xs">{item.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Bulletin Preview Mockup */}
            <Section className="flex-1 w-full" delay={0.15}>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xl overflow-hidden">
                <div className="bg-gray-50 border-b border-gray-200 px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Bulletin Trimestriel Conforme
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                    Prêt pour impression
                  </span>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div className="flex justify-between text-[11px] text-gray-400 font-semibold border-b border-gray-100 pb-2">
                    <span>Matière</span>
                    <div className="flex gap-5">
                      <span className="w-6 text-center">DC</span>
                      <span className="w-6 text-center">DS</span>
                      <span className="w-6 text-center">Coef</span>
                      <span className="w-10 text-center">Moy.</span>
                    </div>
                  </div>
                  {[
                    { matiere: "Mathématiques", dc: "14.5", ds: "16.0", coef: "4", moy: "15.5" },
                    { matiere: "Français", dc: "13.0", ds: "15.0", coef: "3", moy: "14.3" },
                    { matiere: "Arabe", dc: "16.0", ds: "17.0", coef: "3", moy: "16.7" },
                    { matiere: "Sciences Physiques", dc: "14.0", ds: "15.5", coef: "2", moy: "15.0" },
                    { matiere: "Anglais", dc: "15.0", ds: "16.0", coef: "2", moy: "15.7" },
                  ].map((row, i) => (
                    <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
                      <span className="font-semibold text-gray-800">{row.matiere}</span>
                      <div className="flex gap-5">
                        <span className="text-gray-600 w-6 text-center">{row.dc}</span>
                        <span className="text-gray-600 w-6 text-center">{row.ds}</span>
                        <span className="text-gray-400 w-6 text-center">{row.coef}</span>
                        <span className="font-bold text-blue-600 w-10 text-center">{row.moy}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-xs font-bold text-gray-900">Moyenne Générale</span>
                    <span className="text-base font-extrabold text-blue-600">15.44 / 20</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">Rang</div>
                      <div className="text-xs font-bold text-gray-900">2ème / 28</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">Mention</div>
                      <div className="text-xs font-bold text-emerald-600">Très Bien</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">Décision</div>
                      <div className="text-xs font-bold text-purple-600">Admis</div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* ═══════════ MODULES ESSENTIELS (6 cards) ═══════════ */}
      <section id="modules" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-3">
                <Layers className="w-3.5 h-3.5" /> Modules intégrés
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Tout ce dont votre établissement a besoin
              </h2>
              <p className="text-gray-500 text-base">
                Une solution unifiée pour la direction, les enseignants et les familles.
              </p>
            </div>
          </Section>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {features.map((f, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${f.color}`}>
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ APPLICATION MOBILE PARENTS ═══════════ */}
      <section id="parents" className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12 lg:gap-16">
          <Section className="flex-1 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-8 bg-blue-200/50 rounded-[56px] blur-3xl opacity-40 pointer-events-none" />
              <motion.div whileHover={{ y: -6 }} transition={{ duration: 0.3 }}>
                <Image
                  src="/landing/mobile.png"
                  alt="Application mobile parents SnapSchool"
                  width={280}
                  height={580}
                  className="w-[240px] sm:w-[270px] h-auto rounded-[36px] border-[6px] border-gray-800 shadow-2xl relative z-10"
                />
              </motion.div>
            </div>
          </Section>

          <Section className="flex-1" delay={0.15}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4">
              <Smartphone className="w-3.5 h-3.5" /> Espace Parents Dédié
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
              Les parents restent connectés à l&apos;école
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-6">
              Une application intuitive pour que les familles suivent la scolarité de leurs enfants en temps réel.
            </p>

            <div className="space-y-4">
              {[
                { icon: Bell, title: "Alertes d'absence instantanées", desc: "Notification sur smartphone dès qu'une absence ou un retard est constaté en classe." },
                { icon: Award, title: "Consultation des notes et bulletins", desc: "Accès immédiat aux résultats, coefficients et bulletins trimestriels téléchargeables." },
                { icon: MessageSquare, title: "Communication directe", desc: "Réception des circulaires, annonces officielles de la direction et réunions parents-profs." },
                { icon: CreditCard, title: "Suivi des frais de scolarité", desc: "État clair des tranches réglées, dates d'échéances et reçus officiels." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3.5 items-start">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">{item.title}</h4>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ═══════════ TARIFS (en DT) ═══════════ */}
      <section id="tarifs" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Tarifs simples et transparents
              </h2>
              <p className="text-gray-500 text-base">
                Formules adaptées à la taille de votre école en Dinars Tunisiens (DT). Sans engagement.
              </p>
            </div>
          </Section>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              {
                name: "Essentiel", price: "120 DT", period: "/ mois",
                desc: "Pour les centres scolaires et petites structures.",
                features: ["Jusqu'à 150 élèves", "3 comptes administrateur", "Notes et examens", "Application mobile parents", "Support WhatsApp"],
                featured: false, btnText: "Essayer gratuitement",
              },
              {
                name: "Pro Académie", price: "290 DT", period: "/ mois",
                desc: "Pour les écoles primaires, collèges et lycées privés.",
                features: ["Jusqu'à 600 élèves", "Enseignants illimités", "Emploi du temps automatique", "Statistiques & Finances en DT", "Support WhatsApp prioritaire 7j/7", "Import Excel gratuit"],
                featured: true, btnText: "Essai gratuit 14 jours",
              },
              {
                name: "Sur mesure", price: "Sur devis", period: "",
                desc: "Pour les groupes scolaires et réseaux multi-sites.",
                features: ["Élèves et campus illimités", "Serveur dédié & sauvegardes", "Intégration sur mesure", "Formation sur place", "Interlocuteur dédié"],
                featured: false, btnText: "Contacter l'équipe",
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className={`bg-white rounded-2xl p-7 flex flex-col relative transition-all ${
                  plan.featured
                    ? "border-2 border-blue-600 shadow-xl ring-1 ring-blue-100"
                    : "border border-gray-200"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold uppercase tracking-wider">
                    Recommandé
                  </div>
                )}
                <div>
                  <span className={`text-xs font-bold uppercase tracking-wider ${plan.featured ? "text-blue-600" : "text-gray-500"}`}>
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1 mt-2 mb-3">
                    <span className="text-3xl font-extrabold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-400 text-xs">{plan.period}</span>}
                  </div>
                  <p className="text-xs text-gray-500 mb-6">{plan.desc}</p>
                  <div className="h-px bg-gray-100 mb-6" />
                  <ul className="space-y-3 text-xs text-gray-600 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${plan.featured ? "text-blue-600" : "text-emerald-500"}`} />
                        <span className={plan.featured ? "font-semibold text-gray-900" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => router.push(plan.featured || i === 0 ? "/sign-up" : "/sign-in")}
                  className={`mt-auto w-full py-3 font-semibold text-xs rounded-lg transition-all cursor-pointer ${
                    plan.featured
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-800"
                  }`}
                >
                  {plan.btnText}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ FAQ ═══════════ */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Questions fréquentes
              </h2>
              <p className="text-gray-500 text-sm">
                Tout ce que vous devez savoir pour démarrer avec SnapSchool.
              </p>
            </div>
          </Section>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200/80 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <span className="font-semibold text-gray-900 text-sm">{faq.q}</span>
                  <Plus className={`w-4 h-4 shrink-0 transition-transform ${openFaq === i ? "rotate-45 text-blue-600" : "text-gray-400"}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-xs text-gray-500 leading-relaxed border-t border-gray-50 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <Section>
        <section className="py-16 sm:py-20 bg-blue-600 relative overflow-hidden text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-2xl sm:text-4xl font-bold mb-3 tracking-tight">
              Prêt à simplifier la gestion de votre école ?
            </h2>
            <p className="text-blue-100 text-base mb-8 max-w-xl mx-auto">
              Rejoignez les écoles qui font confiance à SnapSchool. Essai gratuit de 14 jours, sans engagement.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="px-7 py-3.5 bg-white text-blue-600 font-bold text-sm rounded-lg hover:bg-blue-50 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                Commencer maintenant
                <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20de%20SnapSchool"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm rounded-lg border border-blue-500 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Discuter sur WhatsApp (+216 23 889 444)
              </a>
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-gray-900 text-gray-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-lg font-bold text-white">SnapSchool</span>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">
                Plateforme intégrée de gestion scolaire pour les écoles privées, collèges et lycées en Tunisie.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Navigation</h4>
              <ul className="space-y-2">
                <li><a href="#apercu" className="hover:text-white transition-colors">Aperçu du système</a></li>
                <li><a href="#tunisie" className="hover:text-white transition-colors">Système Tunisien</a></li>
                <li><a href="#modules" className="hover:text-white transition-colors">Modules</a></li>
                <li><a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Espaces</h4>
              <ul className="space-y-2">
                <li><Link href="/sign-in" className="hover:text-white transition-colors">Connexion Établissement</Link></li>
                <li><Link href="/sign-up" className="hover:text-white transition-colors">Créer un compte</Link></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Contact & Support</h4>
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                  <a href="https://wa.me/21623889444" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                    WhatsApp: +216 23 889 444
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5" />
                  <span>support@snapschool.io</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-gray-500">
            <span>© {new Date().getFullYear()} SnapSchool. Conçu pour l&apos;éducation privée en Tunisie.</span>
            <span>Tous droits réservés.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}