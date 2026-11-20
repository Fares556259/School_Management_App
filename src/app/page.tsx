"use client";

import { createClient } from "@lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  ShieldCheck,
  Calendar,
  Smartphone,
  Bell,
  CheckCircle2,
  ArrowRight,
  Lock,
  Zap,
  MessageSquare,
  Award,
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
  TrendingUp,
  Wallet,
  Calculator,
  UserCheck,
  Receipt,
  Sparkles,
  ChevronRight,
  Users,
  Mic,
  Camera,
  CheckCheck,
  Bot,
} from "lucide-react";

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ANIMATION HELPERS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ ANIMATED COUNTER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ NAVBAR â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
    { label: "AperÃ§u de l'app", href: "#apercu" },
    { label: "SystÃ¨me Tunisien", href: "#tunisie" },
    { label: "Paiements Flexibles", href: "#finances-flexibles" },
    { label: "Hnia IA Telegram", href: "#hnia-ia" },
    { label: "Modules", href: "#modules" },
    { label: "Apps Mobiles", href: "#parents" },
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ MAIN PAGE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
export default function Homepage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"command" | "finance" | "timetable" | "analytics">("command");
  const [activeFinanceTab, setActiveFinanceTab] = useState<"students" | "recovery" | "teachers">("students");
  const [activeMobileTab, setActiveMobileTab] = useState<"parents" | "teachers" | "school">("parents");

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

  /* â”€â”€ Screenshots Showcase Data â”€â”€ */
  const tabScreens = {
    command: {
      title: "Centre de Commandement",
      badge: "Vue Direction en Direct",
      desc: "Supervision complÃ¨te : effectifs en direct (Ã©lÃ¨ves, enseignants, classes), chiffre d'affaires en TND et indicateurs de rentabilitÃ©.",
      src: "/landing/dashboard-command-center.png",
      alt: "Tableau de bord de gestion scolaire SnapSchool Academy",
    },
    finance: {
      title: "Recouvrement & RÃ©munÃ©rations",
      badge: "ZÃ©ro ImpayÃ© OubliÃ©",
      desc: "Suivi en Dinars des scolaritÃ©s en souffrance avec bouton d'encaissement direct et gestion des salaires des enseignants.",
      src: "/landing/finance-recovery.png",
      alt: "Module de recouvrement des frais scolaires et salaires en dinars tunisiens",
    },
    timetable: {
      title: "Emploi du Temps AcadÃ©mique",
      badge: "Grille Officielle Bilingue",
      desc: "Emploi du temps par classe avec matiÃ¨res bilingues en Arabe et FranÃ§ais, affectation des salles et des enseignants sans conflit.",
      src: "/landing/timetable-grid.png",
      alt: "Emploi du temps bilingue tunisien SnapSchool",
    },
    analytics: {
      title: "TrÃ©sorerie & Analyse 12 Mois",
      badge: "ClartÃ© FinanciÃ¨re",
      desc: "Comparatif en temps rÃ©el des recettes et des dÃ©penses sur l'annÃ©e scolaire 2026/2027 avec ventilation dÃ©taillÃ©e par catÃ©gorie.",
      src: "/landing/analytics-cashflow.png",
      alt: "Analyse de trÃ©sorerie sur 12 mois SnapSchool",
    },
  };

  const tabs = [
    { id: "command" as const, label: "Centre de Commandement", icon: LayoutDashboard },
    { id: "finance" as const, label: "Recouvrement & Salaires", icon: CreditCard },
    { id: "timetable" as const, label: "Emploi du Temps Bilingue", icon: Calendar },
    { id: "analytics" as const, label: "TrÃ©sorerie 12 Mois", icon: TrendingUp },
  ];

  /* â”€â”€ Essential Modules â”€â”€ */
  const features = [
    {
      icon: FileText,
      title: "Notes et bulletins officiels",
      description: "Saisie rapide par les enseignants, calcul automatique des moyennes trimestrielles avec coefficients officiels et Ã©dition de bulletins prÃªts Ã  imprimer.",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: ClipboardList,
      title: "Gestion des absences & appel",
      description: "Appel numÃ©rique en 45 secondes par classe. Les familles reÃ§oivent une alerte immÃ©diate sur leur smartphone en cas d'absence ou de retard.",
      color: "bg-red-50 text-red-600",
    },
    {
      icon: CreditCard,
      title: "Paiements & finances en DT",
      description: "Suivi des Ã©colages par tranche, alertes automatiques des impayÃ©s, reÃ§us numÃ©rotÃ©s et gestion des salaires et avances des professeurs.",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Calendar,
      title: "Emploi du temps anti-conflit",
      description: "CrÃ©ation intuitive des grilles horaires. DÃ©tection automatique des collisions de salles ou d'enseignants, avec crÃ©neaux flexibles de 1h ou 2h.",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: Smartphone,
      title: "Application mobile parents",
      description: "Application intuitive pour iOS et Android : suivi des notes en direct, notifications des absences, devoirs et annonces officielles de l'Ã©cole.",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: ShieldCheck,
      title: "SÃ©curitÃ© & Audit horodatÃ©",
      description: "Chaque action administrative est tracÃ©e. Chiffrement complet des donnÃ©es scolaires et sauvegardes cloud quotidiennes automatiques.",
      color: "bg-gray-100 text-gray-700",
    },
  ];

  /* â”€â”€ Essential FAQs â”€â”€ */
  const faqs = [
    {
      q: "Combien de temps faut-il pour dÃ©marrer avec SnapSchool ?",
      a: "Votre espace est opÃ©rationnel en 48 heures. Nous prenons en charge gratuitement l'importation complÃ¨te de vos donnÃ©es scolaires actuelles depuis vos fichiers Excel (Ã©lÃ¨ves, professeurs, classes).",
    },
    {
      q: "SnapSchool est-il adaptÃ© aux normes Ã©ducatives tunisiennes ?",
      a: "Oui, Ã  100%. La plateforme intÃ¨gre le dÃ©coupage en 3 trimestres, la distinction devoirs de contrÃ´le (DC) et devoirs de synthÃ¨se (DS), la pondÃ©ration par coefficient officiel et les bulletins conformes au modÃ¨le ministÃ©riel.",
    },
    {
      q: "Comment fonctionne la gestion flexible des paiements ?",
      a: "SnapSchool s'adapte Ã  la rÃ©alitÃ© : paiement partiel d'un parent (ex: 40 DT sur 123 DT), versement libre multi-mois (1 000 DT ventilÃ©s automatiquement sans calculatrice), et gestion des acomptes/avances des professeurs avec dÃ©duction d'heures d'absence.",
    },
    {
      q: "Quel accompagnement et support proposez-vous ?",
      a: "Chaque Ã©tablissement bÃ©nÃ©ficie d'une assistance directe via WhatsApp disponible 7j/7, ainsi que d'une formation guidÃ©e pour la direction et l'Ã©quipe pÃ©dagogique lors de la mise en place.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* â•â•â•â•â•â•â•â•â•â•â• HERO â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 bg-gradient-to-b from-blue-50/70 via-blue-50/30 to-white relative overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-30 animate-pulse pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-purple-100 rounded-full blur-3xl opacity-20 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <motion.div
            className="max-w-3xl mx-auto text-center mb-12"
            initial="hidden"
            animate="visible"
            variants={stagger}
          >
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" />
              Plateforme de gestion scolaire pour Ã©coles privÃ©es en Tunisie
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-3xl sm:text-5xl lg:text-[3.4rem] font-bold leading-tight tracking-tight text-gray-900 mb-6">
              GÃ©rez votre Ã©cole privÃ©e <br className="hidden sm:block" />
              avec{" "}
              <span className="text-blue-600 relative">
                simplicitÃ© et efficacitÃ©
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none">
                  <path d="M0 3C50 0.5 150 0.5 200 3" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-9">
              Bulletins officiels aux normes tunisiennes, recouvrement des Ã©colages en Dinars (DT), emplois du temps sans conflits et portail parents direct.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-xl transition-all hover:shadow-lg hover:shadow-blue-600/25 flex items-center justify-center gap-2 group cursor-pointer"
              >
                Commencer gratuitement
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20de%20SnapSchool"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-[15px] rounded-xl border border-gray-200 transition-all hover:border-gray-300 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-green-600" />
                Demander une dÃ©mo WhatsApp
              </a>
            </motion.div>
          </motion.div>

          {/* â”€â”€ REAL APP SCREENSHOTS SHOWCASE (Eliminates AI Slop) â”€â”€ */}
          <Section id="apercu">
            <div className="max-w-5xl mx-auto">
              {/* Interactive Tabs */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isCurrent = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                        isCurrent
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25 scale-[1.02]"
                          : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Browser Shell with Real App Screenshot */}
              <motion.div
                className="rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xl bg-white"
                whileHover={{ y: -2 }}
                transition={{ duration: 0.2 }}
              >
                {/* Browser top chrome */}
                <div className="h-10 bg-gray-50 border-b border-gray-200 px-4 flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-mono text-gray-500 flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-green-600" />
                      app.snapschool.io/{activeTab === "command" ? "admin" : activeTab === "finance" ? "finance/recovery" : activeTab === "timetable" ? "admin/timetable" : "admin/analytics"}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      SnapSchool OS
                    </span>
                  </div>
                </div>

                {/* Screenshot view with smooth transition */}
                <div className="relative bg-slate-100 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, scale: 0.99 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Image
                        src={tabScreens[activeTab].src}
                        alt={tabScreens[activeTab].alt}
                        width={1440}
                        height={760}
                        priority
                        className="w-full h-auto object-cover select-none"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {/* Caption Bar */}
                  <div className="border-t border-gray-200 bg-white/95 backdrop-blur-sm p-4 sm:px-6 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {tabScreens[activeTab].badge}
                        </span>
                        <h3 className="font-bold text-sm text-gray-900">
                          {tabScreens[activeTab].title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {tabScreens[activeTab].desc}
                      </p>
                    </div>
                    <Link
                      href="/sign-in"
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap self-start sm:self-center"
                    >
                      Tester l&apos;interface rÃ©elle <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </Section>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â• TRUST BAR (animated counters) â•â•â•â•â•â•â•â•â•â•â• */}
      <section className="py-14 border-y border-gray-100 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { value: <><CountUp target={99} suffix=".9%" /></>, label: "DisponibilitÃ© garantie", icon: Zap },
              { value: <><CountUp target={10} suffix="x" /></>, label: "Saisie plus rapide", icon: Clock },
              { value: <>{'<'} 1s</>, label: "Alertes aux parents", icon: Bell },
              { value: <><CountUp target={100} suffix="%" /></>, label: "AdaptÃ© Ã©coles privÃ©es", icon: CheckCircle2 },
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

      {/* â•â•â•â•â•â•â•â•â•â•â• SYSTÃˆME TUNISIEN (Core Focus) â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="tunisie" className="py-20 bg-gradient-to-b from-blue-50/40 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-16">
            <Section className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-4">
                <Globe className="w-3.5 h-3.5" /> AdaptÃ© Ã  la Tunisie
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4 tracking-tight">
                ConÃ§u pour le systÃ¨me Ã©ducatif tunisien
              </h2>
              <p className="text-gray-500 text-base leading-relaxed mb-6">
                Fini les feuilles de calcul complexes : SnapSchool intÃ¨gre nativement toutes les spÃ©cificitÃ©s des Ã©tablissements privÃ©s en Tunisie (Primaire, CollÃ¨ge et LycÃ©e).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {[
                  { title: "Trimestres", desc: "DÃ©coupage en 3 trimestres avec moyennes sÃ©parÃ©es et moyenne annuelle.", icon: Calendar },
                  { title: "DC et DS", desc: "PondÃ©ration exacte : Devoirs de contrÃ´le (DC) et Devoirs de synthÃ¨se (DS).", icon: FileText },
                  { title: "Coefficients", desc: "Coefficients officiels par niveau pour un calcul automatisÃ© des moyennes.", icon: BarChart3 },
                  { title: "Bulletins officiels", desc: "Ã‰dition en 1 clic de bulletins PDF aux normes du MinistÃ¨re de l'Ã‰ducation.", icon: Award },
                  { title: "Bilingue FR / AR", desc: "Interface et documents disponibles en franÃ§ais et en arabe avec support RTL.", icon: Globe },
                  { title: "Vacances officielles", desc: "Calendrier scolaire synchronisÃ© avec les vacances et jours fÃ©riÃ©s tunisiens.", icon: Clock },
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
                    PrÃªt pour impression
                  </span>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div className="flex justify-between text-[11px] text-gray-400 font-semibold border-b border-gray-100 pb-2">
                    <span>MatiÃ¨re</span>
                    <div className="flex gap-5">
                      <span className="w-6 text-center">DC</span>
                      <span className="w-6 text-center">DS</span>
                      <span className="w-6 text-center">Coef</span>
                      <span className="w-10 text-center">Moy.</span>
                    </div>
                  </div>
                  {[
                    { matiere: "MathÃ©matiques", dc: "14.5", ds: "16.0", coef: "4", moy: "15.5" },
                    { matiere: "FranÃ§ais", dc: "13.0", ds: "15.0", coef: "3", moy: "14.3" },
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
                    <span className="text-xs font-bold text-gray-900">Moyenne GÃ©nÃ©rale</span>
                    <span className="text-base font-extrabold text-blue-600">15.44 / 20</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">Rang</div>
                      <div className="text-xs font-bold text-gray-900">2Ã¨me / 28</div>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">Mention</div>
                      <div className="text-xs font-bold text-emerald-600">TrÃ¨s Bien</div>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-gray-500">DÃ©cision</div>
                      <div className="text-xs font-bold text-purple-600">Admis</div>
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â• PAIEMENTS & SALAIRES ULTRA-FLEXIBLES (Flagship Feature) â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="finances-flexibles" className="py-20 bg-[#F5F6F8] border-y border-slate-200/80 relative overflow-hidden">
        {/* Subtle decorative tint */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(59,130,246,0.06),transparent)] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Section>
            <div className="max-w-3xl mx-auto text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-4 border border-blue-200/80">
                <Wallet className="w-3.5 h-3.5" /> Fini les calculs manuels et les cahiers
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
                Paiements & Salaires : Une flexibilitÃ© totale pour votre Ã©cole
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                Dans la rÃ©alitÃ© d&apos;une Ã©cole privÃ©e en Tunisie, les parents paient en tranches imprÃ©vues et les professeurs demandent des avances ou ont des heures Ã  dÃ©duire. SnapSchool s&apos;adapte Ã  chaque cas sans risque d&apos;erreur.
              </p>

              {/* Mode Switcher */}
              <div className="inline-flex flex-wrap items-center justify-center p-1.5 rounded-2xl bg-white border border-slate-200 shadow-sm mt-6 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveFinanceTab("students")}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeFinanceTab === "students"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Users className="w-4 h-4" /> 1. Ã‰colages & Tranches
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFinanceTab("recovery")}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeFinanceTab === "recovery"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Receipt className="w-4 h-4" /> 2. File de Recouvrement & ImpayÃ©s
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFinanceTab("teachers")}
                  className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center gap-2 ${
                    activeFinanceTab === "teachers"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> 3. Salaires, Avances & DÃ©penses
                </button>
              </div>
            </div>
          </Section>

          {/* Tab 1: CÃ´tÃ© Ã‰lÃ¨ves */}
          {activeFinanceTab === "students" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Key Superpowers */}
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Versement Libre & Ventilation Multi-Mois</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Un parent arrive avec <strong className="text-slate-900 font-semibold">1 000 DT</strong> ? Tapez le montant : SnapSchool cascade automatiquement la somme sur chaque mois impayÃ© (ex: 8 mois soldÃ©s Ã  123 DT, 9Ã¨me mois partiel Ã  16 DT avec 107 DT restant dÃ»). ZÃ©ro calculatrice !
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Paiement Partiel & Acomptes</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Le parent ne peut verser que 40 DT aujourd&apos;hui ? Enregistrez le paiement partiel : le mois est marquÃ© <span className="inline-block px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">[PARTIEL]</span> et le reliquat exact (83 DT) est suivi jusqu&apos;Ã  son solde complet.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Suivi Annuel des 10 Mois en 1 Coup d&apos;Å’il</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Chaque Ã©lÃ¨ve dispose d&apos;une barre chronologique claire (Sept Ã  Juin) avec le total versÃ©, le reste annuel et un bouton pour imprimer un reÃ§u officiel horodatÃ©.
                  </p>
                </div>
              </div>

              {/* Right Column: Real Screenshots Carousel/Stack */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-100">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      </div>
                      <span className="font-semibold text-slate-700 flex items-center gap-2 ml-1">
                        <Receipt className="w-3.5 h-3.5 text-blue-600" /> Modal rÃ©elle de versement libre (1 000 DT ventilÃ©s automatiquement)
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                      Calcul automatique
                    </span>
                  </div>
                  <Image
                    src="/landing/student-multi-month-split.png"
                    alt="Ventilation automatique multi-mois des frais de scolaritÃ©"
                    width={1000}
                    height={600}
                    className="w-full h-auto object-cover select-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs p-2">
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5 px-2">Acompte / Paiement Partiel</p>
                    <Image
                      src="/landing/student-partial-payment.png"
                      alt="Paiement partiel Ã©colage"
                      width={600}
                      height={350}
                      className="w-full h-auto rounded-lg object-cover select-none border border-slate-100"
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs p-2">
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5 px-2">Suivi Annuel de l&apos;Ã‰lÃ¨ve (10 Mois)</p>
                    <Image
                      src="/landing/student-tuition-profile.png"
                      alt="Suivi annuel scolaritÃ© Ã©lÃ¨ve"
                      width={600}
                      height={350}
                      className="w-full h-auto rounded-lg object-cover select-none border border-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: File de Recouvrement & ImpayÃ©s */}
          {activeFinanceTab === "recovery" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Key Superpowers */}
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h3 className="text-base font-bold text-slate-900">File Active de Recouvrement</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Visualisez en un instant l&apos;ensemble des scolaritÃ©s en souffrance. Chaque dossier affiche l&apos;Ã©lÃ¨ve, le mois concernÃ©, le montant dÃ©jÃ  rÃ©glÃ© et le <strong className="text-rose-600 font-semibold">reste dÃ» exact en rouge</strong>.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Encaissement & Relance en 1 Clic</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Un parent se prÃ©sente ? Cliquez sur <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">[RECOUVRER]</span> pour solder le dossier et gÃ©nÃ©rer le reÃ§u. PossibilitÃ© d&apos;exporter la liste ou d&apos;envoyer des rappels par notification mobile.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Grand Livre des Recettes de l&apos;Ã‰cole</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Toutes les entrÃ©es sont classÃ©es et traÃ§ables par catÃ©gorie : Frais de scolaritÃ©, Paiements partiels, Recouvrement, Transport / Bus, avec preuve de paiement jointe.
                  </p>
                </div>
              </div>

              {/* Right Column: Real Screenshots */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-100">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      </div>
                      <span className="font-semibold text-slate-700 flex items-center gap-2 ml-1">
                        <Receipt className="w-3.5 h-3.5 text-amber-600" /> File de Recouvrement rÃ©elle des frais de scolaritÃ©
                      </span>
                    </div>
                    <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
                      Reste dÃ» suivi au dinar prÃ¨s
                    </span>
                  </div>
                  <Image
                    src="/landing/recovery-queue.png"
                    alt="File de recouvrement des frais de scolaritÃ© partiels SnapSchool"
                    width={1000}
                    height={600}
                    className="w-full h-auto object-cover select-none"
                  />
                </div>

                <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs p-2">
                  <p className="text-[11px] font-bold text-slate-700 mb-1.5 px-2">Grand Livre des Recettes de l&apos;Ã‰cole (Par CatÃ©gorie & Date)</p>
                  <Image
                    src="/landing/incomes-ledger.png"
                    alt="Journal des recettes SnapSchool"
                    width={1000}
                    height={450}
                    className="w-full h-auto rounded-lg object-cover select-none border border-slate-100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: CÃ´tÃ© Enseignants & DÃ©penses */}
          {activeFinanceTab === "teachers" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Key Superpowers */}
              <div className="lg:col-span-5 space-y-4 text-left">
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs">
                      1
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Avances sur Salaire InstantanÃ©es</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Un enseignant demande un acompte en milieu de mois ? Versez l&apos;avance en 1 clic (ex: 100 DT). Le systÃ¨me met immÃ©diatement Ã  jour le solde restant sans risque d&apos;oubli lors de la paie finale.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-rose-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                      2
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Compteur d&apos;Absences & Retenues au Taux Horaire</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    2 heures manquÃ©es ? SnapSchool calcule automatiquement la dÃ©duction au tarif horaire de l&apos;enseignant (ex: 2h Ã— 15 DT/h = -30 DT). Vous pouvez appliquer la retenue ou la mettre en rÃ©serve si le cours est rattrapÃ©.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Formule Nette Transparente</h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mb-2">
                    DÃ©composition claire pour chaque membre du personnel enseignant :
                  </p>
                  <code className="inline-block text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg font-mono text-[11px] border border-blue-200/70 font-semibold">
                    Base (360 DT) - Retenue (-30 DT) - Avance (-100 DT) = 230 DT Net
                  </code>
                </div>
              </div>

              {/* Right Column: Real Teacher Screenshots */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-2xl overflow-hidden border border-slate-200/90 bg-white shadow-xl ring-1 ring-slate-100">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                      </div>
                      <span className="font-semibold text-slate-700 flex items-center gap-2 ml-1">
                        <Calculator className="w-3.5 h-3.5 text-rose-600" /> Compteur d&apos;heures d&apos;absence & dÃ©cision sur la paie
                      </span>
                    </div>
                    <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-bold border border-rose-200">
                      DÃ©duction en direct
                    </span>
                  </div>
                  <Image
                    src="/landing/teacher-deduction-modal.png"
                    alt="Compteur heures absence et retenue sur salaire enseignant"
                    width={1000}
                    height={600}
                    className="w-full h-auto object-cover select-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs p-2">
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5 px-2">Suivi Annuel de RÃ©munÃ©ration Enseignant</p>
                    <Image
                      src="/landing/teacher-salary-tracker.png"
                      alt="Suivi salaire enseignant et avances"
                      width={600}
                      height={350}
                      className="w-full h-auto rounded-lg object-cover select-none border border-slate-100"
                    />
                  </div>
                  <div className="rounded-xl overflow-hidden border border-slate-200/90 bg-white shadow-xs p-2">
                    <p className="text-[11px] font-bold text-slate-700 mb-1.5 px-2">Modal Versement d&apos;Avance sur Salaire</p>
                    <Image
                      src="/landing/teacher-advance-modal.png"
                      alt="Versement avance enseignant"
                      width={600}
                      height={350}
                      className="w-full h-auto rounded-lg object-cover select-none border border-slate-100"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â• MODULES ESSENTIELS (6 cards) â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="modules" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-3">
                <Layers className="w-3.5 h-3.5" /> Modules intÃ©grÃ©s
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Tout ce dont votre Ã©tablissement a besoin
              </h2>
              <p className="text-gray-500 text-base">
                Une solution unifiÃ©e pour la direction, les enseignants et les familles.
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

      {/* â•â•â•â•â•â•â•â•â•â•â• APPLICATIONS MOBILES (PARENTS & PROFS) â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="parents" className="py-20 bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-3xl mx-auto text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-3">
                <Smartphone className="w-3.5 h-3.5" /> Applications Mobiles iOS & Android
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                L&apos;Ã©tablissement connectÃ© en direct dans la poche
              </h2>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed">
                Des interfaces mobiles conÃ§ues pour le terrain : les parents suivent prÃ©sences et paiements en direct, tandis que les enseignants font l&apos;appel et dÃ©posent leurs cours en 30 secondes.
              </p>

              {/* Mobile Tab Switcher */}
              <div className="mt-8 inline-flex p-1 rounded-2xl bg-white border border-gray-200 shadow-sm max-w-full overflow-x-auto">
                <button
                  onClick={() => setActiveMobileTab("parents")}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeMobileTab === "parents"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <Smartphone className="w-4 h-4" /> 1. Parents & Ã‰lÃ¨ves (Badges & ReÃ§us)
                </button>
                <button
                  onClick={() => setActiveMobileTab("teachers")}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeMobileTab === "teachers"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <UserCheck className="w-4 h-4" /> 2. Enseignants (Appel & Devoirs)
                </button>
                <button
                  onClick={() => setActiveMobileTab("school")}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeMobileTab === "school"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  <FileText className="w-4 h-4" /> 3. Vie Scolaire & Documents
                </button>
              </div>
            </div>
          </Section>

          {/* TAB 1: Parents & Ã‰lÃ¨ves */}
          {activeMobileTab === "parents" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Espace Famille</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3">
                    Transparence totale pour les familles
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Les parents ne sont plus dans le doute. Chaque information clÃ© arrive instantanÃ©ment sur leur smartphone.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Badge Â« PRÃ‰SENT Â» en direct</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        L&apos;appel validÃ© en cours s&apos;affiche en temps rÃ©el sur l&apos;emploi du temps de l&apos;Ã©lÃ¨ve avec le badge vert officiel pour rassurer les parents.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Quittances & ReÃ§us PDF tÃ©lÃ©chargeables</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Chaque tranche rÃ©glÃ©e (ex: 444 TND) est archivÃ©e avec dÃ©tail du mode de versement et bouton de tÃ©lÃ©chargement direct de la quittance officielle.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Emploi du temps quotidien & Salles</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Horaires, matiÃ¨res, enseignants et numÃ©ros de salles consultables en un coup d&apos;Å“il pour prÃ©parer les journÃ©es d&apos;Ã©tude.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Notes & Bulletins trimestriels</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        AccÃ¨s aux notes d&apos;Ã©valuation au fur et Ã  mesure et tÃ©lÃ©chargement du bulletin officiel validÃ© par la direction.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2 Phones Display */}
              <div className="lg:col-span-7 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                {/* Phone 1: Schedule */}
                <div className="text-center">
                  <span className="inline-block text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 mb-3">
                    Badge de prÃ©sence en direct
                  </span>
                  <div className="w-[220px] sm:w-[245px] rounded-[38px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl ring-1 ring-slate-700/60 relative">
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-full z-20" />
                    <div className="rounded-[30px] overflow-hidden bg-black border border-slate-800">
                      <Image
                        src="/landing/mobile-student-schedule.jpg"
                        alt="Emploi du temps avec badge de prÃ©sence vert sur l'app mobile SnapSchool"
                        width={472}
                        height={1024}
                        className="w-full h-auto object-cover object-top"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone 2: Payment Receipt */}
                <div className="text-center">
                  <span className="inline-block text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-3">
                    ReÃ§u payÃ© 444 TND (TÃ©lÃ©chargement PDF)
                  </span>
                  <div className="w-[220px] sm:w-[245px] rounded-[38px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl ring-1 ring-slate-700/60 relative">
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-full z-20" />
                    <div className="rounded-[30px] overflow-hidden bg-black border border-slate-800">
                      <Image
                        src="/landing/mobile-parent-payments.jpg"
                        alt="ReÃ§u de scolaritÃ© payÃ©e sur l'application mobile SnapSchool"
                        width={472}
                        height={1024}
                        className="w-full h-auto object-cover object-top"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Enseignants */}
          {activeMobileTab === "teachers" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Espace Enseignant</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3">
                    Toutes les actions du cours en 1 clic
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Une interface mobile conÃ§ue pour aller vite en salle de classe : l&apos;enseignant n&apos;a besoin d&apos;aucun ordinateur pour ses tÃ¢ches quotidiennes.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm mb-2">
                      <ClipboardList className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Faire l&apos;appel</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      PrÃ©sence cochÃ©e en 30 secondes chrono par sÃ©ance. Remonte directement Ã  la vie scolaire.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm mb-2">
                      <FileText className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">DÃ©poser un cours</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Partage de polycopiÃ©s et rÃ©sumÃ©s PDF instantanÃ©ment depuis le tÃ©lÃ©phone pour la classe.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm mb-2">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Ajouter un devoir</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Assignation d&apos;exercices avec date limite visible immÃ©diatement sur l&apos;app des Ã©lÃ¨ves.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm mb-2">
                      <Award className="w-4 h-4" />
                    </div>
                    <h4 className="font-semibold text-gray-900 text-sm">Saisir les notes</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Saisie fluide des notes de contrÃ´le continu directement synchronisÃ©es avec les bulletins.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/70 flex items-center gap-3 text-xs text-blue-900">
                  <Zap className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Protection de la vie privÃ©e :</strong> Le professeur communique via SnapSchool sans jamais avoir Ã  donner son numÃ©ro de tÃ©lÃ©phone personnel.
                  </span>
                </div>
              </div>

              {/* Single Phone Display: Teacher Home */}
              <div className="lg:col-span-6 flex flex-col items-center justify-center">
                <span className="inline-block text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-3">
                  Ã‰cran d&apos;accueil Enseignant avec 4 actions rapides
                </span>
                <div className="w-[230px] sm:w-[260px] rounded-[38px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl ring-1 ring-slate-700/60 relative">
                  <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-full z-20" />
                  <div className="rounded-[30px] overflow-hidden bg-black border border-slate-800">
                    <Image
                      src="/landing/mobile-teacher-home.jpg"
                      alt="Accueil mobile de l'application enseignant SnapSchool avec boutons Faire l'appel et DÃ©poser un cours"
                      width={472}
                      height={1024}
                      className="w-full h-auto object-cover object-top"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Vie Scolaire & Documents */}
          {activeMobileTab === "school" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Vie Scolaire & Campus</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 mb-3">
                    Circulaires officielles et supports pÃ©dagogiques
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Fini les photocopies perdues et les annonces noyÃ©es dans les groupes WhatsApp. Toute l&apos;information officielle est archivÃ©e au mÃªme endroit.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Bell className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Circulaires officielles & Ã‰vÃ©nements</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Annonces administratives certifiÃ©es avec photos du campus et avis importants consultables en permanence par les familles.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">BibliothÃ¨que de cours par matiÃ¨re</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        SÃ©ries d&apos;exercices, fiches de rÃ©vision et cours complets tÃ©lÃ©chargeables sans publicitÃ© ni expiration de liens.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-gray-200/80 shadow-sm flex items-start gap-3.5">
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">Environnement sÃ©curisÃ© et cadrÃ©</h4>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        Chaque utilisateur accÃ¨de uniquement aux cours et avis de sa classe, avec une traÃ§abilitÃ© complÃ¨te pour l&apos;administration.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2 Phones Display: Announcements & Courses */}
              <div className="lg:col-span-7 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
                {/* Phone 1: Announcements */}
                <div className="text-center">
                  <span className="inline-block text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 mb-3">
                    Circulaires officielles & Campus
                  </span>
                  <div className="w-[220px] sm:w-[245px] rounded-[38px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl ring-1 ring-slate-700/60 relative">
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-full z-20" />
                    <div className="rounded-[30px] overflow-hidden bg-black border border-slate-800">
                      <Image
                        src="/landing/mobile-announcements.jpg"
                        alt="Circulaires officielles avec photo du campus sur l'app SnapSchool"
                        width={472}
                        height={1024}
                        className="w-full h-auto object-cover object-top"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone 2: Courses */}
                <div className="text-center">
                  <span className="inline-block text-[11px] font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 mb-3">
                    Documents & Cours par matiÃ¨re
                  </span>
                  <div className="w-[220px] sm:w-[245px] rounded-[38px] p-2 bg-gradient-to-b from-slate-800 via-slate-900 to-black shadow-2xl ring-1 ring-slate-700/60 relative">
                    <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-16 h-3 bg-black rounded-full z-20" />
                    <div className="rounded-[30px] overflow-hidden bg-black border border-slate-800">
                      <Image
                        src="/landing/mobile-courses.jpg"
                        alt="Supports pÃ©dagogiques et documents de cours sur l'app mobile SnapSchool"
                        width={472}
                        height={1024}
                        className="w-full h-auto object-cover object-top"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â• ASSISTANT IA TELEGRAM : HNIA â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="hnia-ia" className="py-24 bg-gradient-to-b from-white via-blue-50/40 to-white relative overflow-hidden border-b border-slate-200/70">
        <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 -right-20 w-96 h-96 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <Section>
            <div className="max-w-3xl mx-auto text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold mb-4 border border-blue-200/60 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>ExclusivitÃ© SnapSchool â€¢ Intelligence Artificielle & Telegram Bot</span>
              </div>
              <h2 className="text-3xl sm:text-5xl font-extrabold text-gray-900 tracking-tight mb-4">
                Rencontrez <span className="text-blue-600">Hnia</span>, l&apos;assistante IA de votre Ã©cole
              </h2>
              <p className="text-gray-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                Pourquoi allumer un PC pour chaque petite tÃ¢che ? Depuis votre smartphone sur Telegram, dictez un encaissement, scannez un reÃ§u par photo ou demandez la situation d&apos;une classe en dialecte tunisien ou en franÃ§ais.
              </p>
            </div>
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Mascot presentation & Feature cards */}
            <Section className="lg:col-span-6 space-y-6" delay={0.1}>
              {/* Mascot Spotlight Card */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden flex flex-col sm:flex-row items-center gap-6">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden shadow-2xl ring-4 ring-white/30 bg-white">
                    <Image
                      src="/hnia_mascot_icon.png"
                      alt="Mascotte Hnia AI SnapSchool"
                      width={112}
                      height={112}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-900 text-[10px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-900 animate-ping" />
                    En Ligne
                  </span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="text-xs font-semibold text-blue-200 uppercase tracking-wider">Votre Co-pilote 24h/7j</span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                    Hnia (@HniaSnapSchoolBot)
                  </h3>
                  <p className="text-xs sm:text-sm text-blue-100 mt-1.5 leading-relaxed">
                    ConnectÃ©e en direct Ã  la base de donnÃ©es SnapSchool de votre Ã©tablissement. Elle reconnaÃ®t vos Ã©lÃ¨ves, professeurs et finances en temps rÃ©el.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-[11px] font-medium bg-white/15 px-2.5 py-1 rounded-lg">
                      ðŸ‡¹ðŸ‡³ Dialecte Tunisien
                    </span>
                    <span className="text-[11px] font-medium bg-white/15 px-2.5 py-1 rounded-lg">
                      ðŸ‡«ðŸ‡· FranÃ§ais
                    </span>
                    <span className="text-[11px] font-medium bg-white/15 px-2.5 py-1 rounded-lg">
                      ðŸŽ™ï¸ Vocaux & Photos
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Feature Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm mb-2.5">
                    <Mic className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">DictÃ©e Vocale & Derja</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Â« Ø£Ù… Ø£Ø­Ù…Ø¯ Ø®Ù„ØµØª 500 Ø¯ÙŠÙ†Ø§Ø± Â» â€” Hnia comprend qui est l&apos;Ã©lÃ¨ve, calcule le reliquat et enregistre le paiement avec reÃ§u PDF.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm mb-2.5">
                    <Camera className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Scan de Factures par Photo</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Envoyez la photo d&apos;un ticket de caisse ou facture : l&apos;IA extrait montant, date et fournisseur et l&apos;enregistre dans vos dÃ©penses.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm mb-2.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">Validation SÃ©curisÃ©e en 1 Clic</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Chaque action critique (salaire, avance, dÃ©pense) gÃ©nÃ¨re une carte interactive avec boutons <code>[âœ… Confirmer]</code> et <code>[âŒ Annuler]</code>.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-sm mb-2.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-gray-900 text-sm">MÃ©moire Contextuelle</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Posez des questions courtes (Â« Et le reste ? Â», Â« Envoie un rappel aux autres Â») : Hnia garde le fil de la discussion sans rÃ©pÃ©tition.
                  </p>
                </div>
              </div>
            </Section>

            {/* Right Column: Realistic Telegram Mockup */}
            <Section className="lg:col-span-6 flex justify-center" delay={0.2}>
              <div className="w-full max-w-md bg-[#0e1621] rounded-[32px] p-3.5 shadow-2xl border border-slate-700/60 ring-1 ring-white/10">
                {/* Telegram App Header */}
                <div className="bg-[#17212b] rounded-2xl px-4 py-3 flex items-center justify-between border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Image
                        src="/hnia_mascot_full.png"
                        alt="Avatar Hnia"
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/50"
                      />
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#17212b]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-white">Hnia â€¢ SnapSchool</span>
                        <span className="text-[10px] font-bold bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">bot</span>
                      </div>
                      <span className="text-[11px] text-blue-400 font-medium">en ligne â€¢ assistant IA</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Telegram
                  </div>
                </div>

                {/* Telegram Messages Feed */}
                <div className="p-3 space-y-3.5 text-[12.5px] font-sans">
                  {/* User message (Derja) */}
                  <div className="flex justify-end">
                    <div className="bg-[#2b5278] text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] shadow-xs">
                      <p className="font-sans text-sm text-right" dir="rtl">
                        Ø£Ù… Ø£Ø­Ù…Ø¯ Ø®Ù„ØµØª 500 Ø¯ÙŠÙ†Ø§Ø± Ù†Ù‚Ø¯Ø§
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-blue-200 mt-1">
                        <span>10:42</span>
                        <CheckCheck className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Bot Reply: Card with action */}
                  <div className="flex justify-start">
                    <div className="bg-[#182533] text-slate-200 rounded-2xl rounded-tl-xs p-3.5 max-w-[92%] border border-slate-700/60 shadow-md space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs pb-1 border-b border-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Paiement EncaissÃ© avec SuccÃ¨s</span>
                      </div>
                      <div className="space-y-1 text-[12px]">
                        <p>ðŸ‘¤ <strong>Ã‰lÃ¨ve :</strong> Ahmed Ben Salah (7Ã¨me B)</p>
                        <p>ðŸ’µ <strong>Montant :</strong> <code className="bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-bold">500.000 DT</code></p>
                        <p>ðŸ“‰ <strong>Reliquat restant :</strong> <code className="bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded font-mono">150.000 DT</code></p>
                        <p className="text-[11px] text-slate-400 pt-0.5">ðŸ“„ Quittance nÂ° REC-2026-089 gÃ©nÃ©rÃ©e</p>
                      </div>

                      {/* Inline Buttons */}
                      <div className="pt-1 grid grid-cols-2 gap-1.5 text-[11px]">
                        <div className="bg-[#2b5278] text-white font-semibold py-1.5 px-2 rounded-lg text-center cursor-default">
                          ðŸ“„ ReÃ§u PDF
                        </div>
                        <div className="bg-[#2b5278] text-white font-semibold py-1.5 px-2 rounded-lg text-center cursor-default">
                          ðŸ’¬ ReÃ§u WhatsApp
                        </div>
                      </div>

                      <div className="text-right text-[10px] text-slate-400">10:42</div>
                    </div>
                  </div>

                  {/* User follow up message (context memory) */}
                  <div className="flex justify-end">
                    <div className="bg-[#2b5278] text-white rounded-2xl rounded-tr-xs px-3.5 py-2 max-w-[85%] shadow-xs">
                      <p className="font-sans text-sm text-right" dir="rtl">
                        ÙˆØ§Ù„Ø¨Ø§Ù‚ÙŠ ÙÙŠ Ø§Ù„Ù‚Ø³Ù… Ù…ØªØ§Ø¹Ùˆ Ù‚Ø¯Ø§Ø´ØŸ
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-blue-200 mt-1">
                        <span>10:43</span>
                        <CheckCheck className="w-3 h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Bot reply: synthesized data card */}
                  <div className="flex justify-start">
                    <div className="bg-[#182533] text-slate-200 rounded-2xl rounded-tl-xs p-3.5 max-w-[92%] border border-slate-700/60 shadow-md space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs pb-1 border-b border-slate-700">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>Situation FinanciÃ¨re â€¢ 7Ã¨me AnnÃ©e B</span>
                      </div>
                      <div className="space-y-1 text-[12px]">
                        <p>âœ… <strong>EncaissÃ© :</strong> 14 200 DT (86%)</p>
                        <p>âš ï¸ <strong>ImpayÃ©s restants :</strong> 2 300 DT (4 Ã©lÃ¨ves)</p>
                      </div>
                      <blockquote className="border-l-2 border-amber-400 pl-2 text-[11px] text-amber-200 bg-amber-950/30 py-1 rounded-r">
                        ðŸ’¡ <strong>Hnia :</strong> Voulez-vous prÃ©parer un rappel de paiement par SMS/WhatsApp pour ces 4 parents ?
                      </blockquote>
                      <div className="pt-1">
                        <div className="w-full bg-[#2b5278] text-white font-semibold py-1.5 px-3 rounded-lg text-center text-[11px] cursor-default">
                          ðŸ”” Envoyer Rappels aux 4 Parents
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400">10:43</div>
                    </div>
                  </div>
                </div>

                {/* Telegram Bottom Quick Reply Keyboard */}
                <div className="mt-2 bg-[#17212b] rounded-2xl p-2 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-slate-400 text-center font-medium">
                    Clavier de commandes rapides dans Telegram
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                    <div className="bg-[#202b36] text-slate-200 py-2 rounded-xl text-center border border-slate-700/50 flex items-center justify-center gap-1.5">
                      <span>ðŸ«</span> Mon Ã‰cole
                    </div>
                    <div className="bg-[#202b36] text-slate-200 py-2 rounded-xl text-center border border-slate-700/50 flex items-center justify-center gap-1.5">
                      <span>ðŸ’°</span> Finances
                    </div>
                    <div className="bg-[#202b36] text-slate-200 py-2 rounded-xl text-center border border-slate-700/50 flex items-center justify-center gap-1.5">
                      <span>ðŸ‘¨â€ðŸ«</span> Enseignants
                    </div>
                    <div className="bg-[#202b36] text-slate-200 py-2 rounded-xl text-center border border-slate-700/50 flex items-center justify-center gap-1.5">
                      <span>ðŸ“Š</span> Rapports
                    </div>
                  </div>
                </div>
              </div>
            </Section>
          </div>
        </div>
      </section>

      {/* â•â•â•â•â•â•â•â•â•â•â• TARIFS (en DT) â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="tarifs" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Tarifs simples et transparents
              </h2>
              <p className="text-gray-500 text-base">
                Formules adaptÃ©es Ã  la taille de votre Ã©cole en Dinars Tunisiens (DT). Sans engagement.
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
                features: ["Jusqu'Ã  150 Ã©lÃ¨ves", "3 comptes administrateur", "Notes et examens", "Application mobile parents", "Support WhatsApp"],
                featured: false, btnText: "Essayer gratuitement",
              },
              {
                name: "Pro AcadÃ©mie", price: "290 DT", period: "/ mois",
                desc: "Pour les Ã©coles primaires, collÃ¨ges et lycÃ©es privÃ©s.",
                features: ["Jusqu'Ã  600 Ã©lÃ¨ves", "Enseignants illimitÃ©s", "Assistant IA Hnia sur Telegram 24/7", "Emploi du temps automatique", "Statistiques & Finances en DT", "Support WhatsApp prioritaire 7j/7", "Import Excel gratuit"],
                featured: true, btnText: "Essai gratuit 14 jours",
              },
              {
                name: "Sur mesure", price: "Sur devis", period: "",
                desc: "Pour les groupes scolaires et rÃ©seaux multi-sites.",
                features: ["Ã‰lÃ¨ves et campus illimitÃ©s", "Assistant IA Hnia sur mesure", "Serveur dÃ©diÃ© & sauvegardes", "IntÃ©gration sur mesure", "Formation sur place", "Interlocuteur dÃ©diÃ©"],
                featured: false, btnText: "Contacter l'Ã©quipe",
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
                    RecommandÃ©
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

      {/* â•â•â•â•â•â•â•â•â•â•â• FAQ â•â•â•â•â•â•â•â•â•â•â• */}
      <section id="faq" className="py-20 bg-slate-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-3 tracking-tight">
                Questions frÃ©quentes
              </h2>
              <p className="text-gray-500 text-sm">
                Tout ce que vous devez savoir pour dÃ©marrer avec SnapSchool.
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

      {/* â•â•â•â•â•â•â•â•â•â•â• CTA FINAL â•â•â•â•â•â•â•â•â•â•â• */}
      <Section>
        <section className="py-16 sm:py-20 bg-blue-600 relative overflow-hidden text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-2xl sm:text-4xl font-bold mb-3 tracking-tight">
              PrÃªt Ã  simplifier la gestion de votre Ã©cole ?
            </h2>
            <p className="text-blue-100 text-base mb-8 max-w-xl mx-auto">
              Rejoignez les Ã©coles qui font confiance Ã  SnapSchool. Essai gratuit de 14 jours, sans engagement.
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

      {/* â•â•â•â•â•â•â•â•â•â•â• FOOTER â•â•â•â•â•â•â•â•â•â•â• */}
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
                Plateforme intÃ©grÃ©e de gestion scolaire pour les Ã©coles privÃ©es, collÃ¨ges et lycÃ©es en Tunisie.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Navigation</h4>
              <ul className="space-y-2">
                <li><a href="#apercu" className="hover:text-white transition-colors">AperÃ§u du systÃ¨me</a></li>
                <li><a href="#tunisie" className="hover:text-white transition-colors">SystÃ¨me Tunisien</a></li>
                <li><a href="#finances-flexibles" className="hover:text-white transition-colors">Paiements Flexibles</a></li>
                <li><a href="#hnia-ia" className="hover:text-white transition-colors">Assistant Hnia IA</a></li>
                <li><a href="#modules" className="hover:text-white transition-colors">Modules</a></li>
                <li><a href="#parents" className="hover:text-white transition-colors">Apps Mobiles</a></li>
                <li><a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3 text-xs uppercase tracking-wider">Espaces</h4>
              <ul className="space-y-2">
                <li><Link href="/sign-in" className="hover:text-white transition-colors">Connexion Ã‰tablissement</Link></li>
                <li><Link href="/sign-up" className="hover:text-white transition-colors">CrÃ©er un compte</Link></li>
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
            <span>Â© {new Date().getFullYear()} SnapSchool. ConÃ§u pour l&apos;Ã©ducation privÃ©e en Tunisie.</span>
            <span>Tous droits rÃ©servÃ©s.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
