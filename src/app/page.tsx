"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { 
  BarChart3, 
  ShieldCheck, 
  Users, 
  Calendar, 
  LineChart, 
  Smartphone, 
  Bell, 
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Check,
  Building2,
  Lock,
  Globe,
  Zap,
  Star,
  ChevronDown,
  Plus,
  Minus,
  MessageSquare,
  Award,
  GraduationCap
} from "lucide-react";

// --- Navbar ---
const Navbar = ({ isSignedIn, handleLoginClick, router }: { isSignedIn: boolean; handleLoginClick: () => void; router: any }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 pt-4 transition-all duration-300">
      <nav className={`max-w-7xl mx-auto h-[64px] rounded-full px-6 flex items-center justify-between transition-all duration-300 ${
        scrolled 
          ? "bg-slate-950/85 backdrop-blur-xl border border-slate-800/80 shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/10" 
          : "bg-slate-900/60 backdrop-blur-md border border-white/10 shadow-lg"
      }`}>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <span className="text-white font-black text-xl leading-none tracking-tighter">S</span>
            </div>
            <span className="text-[19px] font-extrabold text-white tracking-tight flex items-center gap-1.5">
              SnapSchool <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">v2.0</span>
            </span>
          </div>
          
          <div className="hidden lg:flex items-center gap-7 font-medium text-[14px] text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">Plateforme</a>
            <a href="#analytics" className="hover:text-white transition-colors">Analytiques</a>
            <a href="#mobile" className="hover:text-white transition-colors">App Mobile</a>
            <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
              <button 
                onClick={handleLoginClick}
                className="text-slate-300 font-medium text-[14px] hover:text-white px-3 py-1.5 transition-colors hidden sm:block"
              >
                Connexion
              </button>
              <button 
                onClick={() => router.push("/sign-up")}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[14px] rounded-full hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all flex items-center gap-1.5"
              >
                Commencer <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button 
              onClick={() => router.push("/admin")}
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold text-[14px] rounded-full hover:shadow-lg hover:shadow-indigo-500/25 active:scale-95 transition-all"
            >
              Accéder au Dashboard
            </button>
          )}
        </div>
      </nav>
    </div>
  );
};

// --- Page Main ---

export default function Homepage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<"admin" | "teacher" | "parent">("admin");
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setIsSignedIn(true);
        const role = user.user_metadata?.role as string | undefined;
        if (role === "admin") router.push("/admin");
        else if (role === "superadmin") router.push("/superadmin");
        else if (role === "teacher") router.push("/teacher");
        else if (role === "student") router.push("/student");
        else if (role === "parent") router.push("/parent");
      }
      setIsLoaded(true);
    };
    fetchUser();
  }, [router, supabase]);

  const handleLoginClick = () => {
    if (isSignedIn) {
      router.push("/admin");
    } else {
      router.push("/sign-in");
    }
  };

  const fadeUpVariant: Variants = {
    hidden: { opacity: 0, y: 25 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  };

  const faqs = [
    {
      q: "Qadech ya5ou wqt bech n'installiw SnapSchool f'écoletna ?",
      a: "Installation instantanée ! Votre espace école w sous-domaine sont créés en quelques minutes. Vous pouvez importer vos élèves, profs et classes depuis Excel ou CSV très facilement."
    },
    {
      q: "Est-ce que SnapSchool est adapté au système d'enseignement tunisien 🇹🇳 ?",
      a: "Oui 100% ! SnapSchool est conçu spécifiquement pour le système éducatif tunisien (Trimestres, devoirs de contrôle w de synthèse, coefficients, bulletins officiels, et gestion en Français / Arabe)."
    },
    {
      q: "Les parents peuvent-ils télécharger l'application 3la Android w iPhone ?",
      a: "Absolument. Les parents reçoivent l'application mobile SnapSchool (sur iOS et Android) pour recevoir des notifications push instantanées d'absences, notes, devoirs, et annonces officielles."
    },
    {
      q: "Kifech les données mta3 les élèves w les paiements sont sécurisées ?",
      a: "Vos données sont hébergées sur une infrastructure cloud ultra-sécurisée avec sauvegardes quotidiennes automatiques, journalisation d'audit (Audit Trail) pour chaque action administrative, et encodage conforme RLS."
    },
    {
      q: "Quel accompagnement est fourni avec l'abonnement ?",
      a: "Un support dédié 3la WhatsApp, une assistance pour la prise en main de l'équipe administrative w les profs, et des mises à jour régulières gratuites."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans overflow-x-hidden">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* 🚀 HERO SECTION */}
      <section className="relative pt-32 sm:pt-40 pb-20 overflow-hidden">
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />
        
        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-tr from-indigo-600/30 via-purple-600/20 to-pink-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none" />

        <motion.div 
          className="max-w-6xl mx-auto text-center px-4 sm:px-6 relative z-10"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.15 } }
          }}
        >
          {/* Live Trust Pill */}
          <motion.div variants={fadeUpVariant} className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/60 shadow-lg shadow-black/40">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[13px] font-semibold text-slate-300">
              Plateforme N°1 pour les Écoles & Académies Privées f'Tunisie 🇹🇳
            </span>
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 ml-0.5" />
          </motion.div>

          {/* Hero Main Heading */}
          <motion.h1 variants={fadeUpVariant} className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.05] tracking-tight mb-8 text-white">
            Simplifie la gestion mta3 ton école. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400">
              Focus 3la tes élèves w tes profs.
            </span>
          </motion.h1>

          <motion.p variants={fadeUpVariant} className="text-lg sm:text-xl md:text-2xl font-normal leading-relaxed text-slate-400 max-w-3xl mx-auto mb-10">
            SnapSchool houwa le système complet pour les écoles et académies privées. Gère l&apos;absence, les notes, le paiement, w ab3ath des notifications instantanées aux parents f&apos;un seul endroit.
          </motion.p>
          
          {/* CTA Group */}
          <motion.div variants={fadeUpVariant} className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button 
              onClick={() => router.push("/sign-up")}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-[16px] rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:shadow-[0_0_50px_rgba(79,70,229,0.6)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2.5"
            >
              Commencer gratuitement <ArrowRight className="w-5 h-5" />
            </button>
            <a 
              href="https://wa.me/23889444" 
              target="_blank" 
              rel="noreferrer"
              className="w-full sm:w-auto px-8 py-4 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-semibold text-[16px] rounded-full border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" /> Démo 3la WhatsApp
            </a>
          </motion.div>

          {/* Social Proof Metrics */}
          <motion.div variants={fadeUpVariant} className="pt-6 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-16">
            {[
              { num: "99.9%", label: "Disponibilité Garantie" },
              { num: "10x", label: "Saisie des Notes Plus Rapide" },
              { num: "< 1s", label: "Alertes Push aux Parents" },
              { num: "100%", label: "Conforme Écoles Privées TN" }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center">
                <span className="text-2xl sm:text-3xl font-black text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">{stat.num}</span>
                <span className="text-xs sm:text-sm font-medium text-slate-400 mt-1">{stat.label}</span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Interactive Workspace Mockup Showcase */}
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          className="w-full max-w-6xl mx-auto px-4 sm:px-6 relative z-10"
        >
          {/* Role Switcher Tabs */}
          <div className="flex justify-center mb-4">
            <div className="p-1.5 bg-slate-900/90 backdrop-blur-md rounded-full border border-slate-800 flex items-center gap-2 shadow-2xl">
              <button 
                onClick={() => setActiveTab("admin")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === "admin" 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Building2 className="w-4 h-4" /> Espace Admin
              </button>
              <button 
                onClick={() => setActiveTab("teacher")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === "teacher" 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Portail Profs
              </button>
              <button 
                onClick={() => setActiveTab("parent")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  activeTab === "parent" 
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" 
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Smartphone className="w-4 h-4" /> Application Parents
              </button>
            </div>
          </div>

          <div className="rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)] ring-1 ring-white/10 group relative">
            <div className="h-10 bg-slate-950/80 px-4 flex items-center justify-between border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="px-4 py-1 rounded-full bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <Lock className="w-3 h-3 text-emerald-400" />
                <span>app.snapschool.io/dashboard</span>
              </div>
              <div className="w-12" />
            </div>
            
            <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden">
              <Image 
                src="/landing/dashboard.png" 
                alt="SnapSchool Workspace Preview" 
                width={1400} 
                height={875} 
                className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-[1.01]"
                priority
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-40 pointer-events-none" />
            </div>
          </div>
        </motion.div>
      </section>

      {/* 📦 BENTO GRID FEATURES SECTION */}
      <section id="features" className="py-24 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }}
            variants={fadeUpVariant}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Zap className="w-3.5 h-3.5" /> Modules Complets
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              Balaahi oublie Excel w les papiers. <br />
              <span className="text-slate-400 font-normal">Kolayeb connecté f'un seul endroit.</span>
            </h2>
            <p className="text-slate-400 text-lg">
              Fini la gestion éparpillée. SnapSchool rassemble l&apos;administration, les profs, et les parents dans un système intelligent w moderne.
            </p>
          </motion.div>

          {/* Bento Box Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1: Financial (Large 2 Cols) */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-8 rounded-3xl relative overflow-hidden group shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Gestion Financière & Suivi mta3 les Paiements</h3>
              <p className="text-slate-400 text-base max-w-xl mb-6">
                Suivez les frais de scolarité, tranches de paiement, dépenses w caisse en temps réel avec des graphiques clairs et prévisions de rentabilité.
              </p>

              {/* Mini Widget */}
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-medium">Revenu Mensuel Net</span>
                  <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                    +48,250 TND <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">+14.2%</span>
                  </div>
                </div>
                <div className="flex gap-1.5 items-end h-9">
                  {[30, 50, 45, 80, 65, 95].map((val, i) => (
                    <div key={i} style={{ height: `${val}%` }} className="w-2.5 rounded-full bg-emerald-500/60" />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Feature 2: Audit Trail */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-8 rounded-3xl relative overflow-hidden group shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Historique & Sécurité (Audit Trail)</h3>
              <p className="text-slate-400 text-base mb-6">
                Chaque modification de note, paiement w compte est enregistrée avec date w heure pour une transparence totale.
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 font-mono text-xs text-slate-300 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="truncate">[AUDIT] Note validée par Directeur #104</span>
              </div>
            </motion.div>

            {/* Feature 3: Smart Timetable */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-8 rounded-3xl relative overflow-hidden group shadow-2xl"
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Emploi du Temps Intelligent</h3>
              <p className="text-slate-400 text-base mb-6">
                Génération d&apos;emploi du temps sans conflit de salles ni de profs, avec possibilité d&apos;ajustement rapide.
              </p>
              <div className="flex gap-2">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">Zéro Chevauchement</span>
              </div>
            </motion.div>

            {/* Feature 4: Grade & Results (Large 2 Cols) */}
            <motion.div 
              whileHover={{ y: -5 }}
              className="md:col-span-2 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 p-8 rounded-3xl relative overflow-hidden group shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all pointer-events-none" />
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-6">
                <LineChart className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3">Bulletins de Notes & Calcul Automatique</h3>
              <p className="text-slate-400 text-base max-w-xl mb-6">
                Saisie unique des devoirs w examens. Calcul automatique des moyennes trimestrielles, rangs, et génération des bulletins PDF prêts à imprimer.
              </p>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { term: "Moyenne Trimestre 1", val: "17.8/20", color: "text-purple-400" },
                  { term: "Rang Classe", val: "2ème / 28", color: "text-indigo-400" },
                  { term: "Taux de Réussite", val: "96.4%", color: "text-emerald-400" },
                ].map((card, i) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-center">
                    <span className="text-[11px] text-slate-400 font-medium block">{card.term}</span>
                    <span className={`text-base font-extrabold ${card.color}`}>{card.val}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* 📱 MOBILE PARENT EXPERIENCE SECTION */}
      <section id="mobile" className="py-24 px-4 sm:px-6 bg-slate-900/60 border-y border-slate-800/80 relative overflow-hidden">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row-reverse items-center gap-16 relative z-10">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
            className="flex-1"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-wider mb-4">
              <Smartphone className="w-3.5 h-3.5" /> Écosystème Mobile
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              Rapprochez les parents d&apos;l&apos;école, <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                f&apos;chaque instant.
              </span>
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Une application mobile dédiée aux parents pour suivre la scolarité de leurs enfants f&apos;téléphone avec notifications push en temps réel.
            </p>

            <div className="space-y-6">
              {[
                { icon: Bell, title: "Alertes d'Absence en Direct", desc: "Notification immédiate f'téléphone dès qu'un élève est absent ou en retard.", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
                { icon: Award, title: "Notes & Bulletins Instantanés", desc: "Consultation des notes d'examens w devoirs dès publication par le prof.", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
                { icon: ShieldCheck, title: "Justification d'Absence en Ligne", desc: "Les parents peuvent envoyer les justifications w certificats directement.", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                    <item.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-1">{item.title}</h4>
                    <p className="text-slate-400 text-sm">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            whileInView={{ opacity: 1, scale: 1 }} 
            viewport={{ once: true }} 
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="flex-1 flex justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-tr from-purple-600/30 to-indigo-600/30 rounded-[50px] blur-3xl transform scale-110 pointer-events-none" />
              <Image 
                src="/landing/mobile.png" 
                alt="SnapSchool Mobile App Preview" 
                width={330} 
                height={670} 
                className="w-[300px] sm:w-[320px] h-auto border-[8px] border-slate-800 rounded-[48px] shadow-[0_30px_90px_rgba(0,0,0,0.9)] relative z-10"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* 🏷️ PRICING SECTION */}
      <section id="pricing" className="py-24 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
              Tarifs Clairs & Transparents
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-6">
              Des tarifs adaptés à la taille <br />
              <span className="text-slate-400 font-normal">mta3 ton école.</span>
            </h2>

            {/* Billing Toggle */}
            <div className="inline-flex items-center p-1 bg-slate-900 border border-slate-800 rounded-full">
              <button 
                onClick={() => setBillingCycle("monthly")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all ${
                  billingCycle === "monthly" ? "bg-slate-800 text-white shadow-md" : "text-slate-400 hover:text-white"
                }`}
              >
                Paiement Mensuel
              </button>
              <button 
                onClick={() => setBillingCycle("annual")}
                className={`px-5 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  billingCycle === "annual" ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                Paiement Annuel <span className="text-[10px] bg-emerald-400 text-slate-950 font-extrabold px-2 py-0.5 rounded-full uppercase">-20% Remise</span>
              </button>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Starter Plan */}
            <motion.div whileHover={{ y: -6 }} className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between shadow-xl relative">
              <div>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider block mb-2">Débutant / Centre</span>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white">{billingCycle === "annual" ? "120 DT" : "150 DT"}</span>
                  <span className="text-slate-400 text-sm">/ mois</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Parfait pour les petits établissements w centres de soutien (jusqu&apos;à 150 élèves).</p>
                <div className="h-px bg-slate-800 mb-6" />
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  {["Jusqu'à 150 Élèves", "3 Comptes Admin", "Module Notes & Examens", "Accès App Mobile Parents", "Support Email w WhatsApp"].map((feat, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button 
                onClick={() => router.push("/sign-up")}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all"
              >
                Essayer Gratuitement
              </button>
            </motion.div>

            {/* Pro Plan (Featured) */}
            <motion.div whileHover={{ y: -6 }} className="bg-gradient-to-b from-indigo-950/80 via-slate-900 to-slate-900 border-2 border-indigo-500/80 p-8 rounded-3xl flex flex-col justify-between shadow-2xl shadow-indigo-500/10 relative ring-1 ring-indigo-500/30">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] font-black uppercase tracking-wider shadow-lg">
                Recommandé
              </div>
              <div>
                <span className="text-sm font-bold text-indigo-400 uppercase tracking-wider block mb-2">Pro Académie</span>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white">{billingCycle === "annual" ? "290 DT" : "350 DT"}</span>
                  <span className="text-slate-400 text-sm">/ mois</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Conçu pour les écoles primaires, collèges w lycées privés (jusqu&apos;à 600 élèves).</p>
                <div className="h-px bg-slate-800 mb-6" />
                <ul className="space-y-3.5 text-sm text-slate-200 mb-8">
                  {["Jusqu'à 600 Élèves", "Profs & Admins Illimités", "Générateur Emploi du Temps AI", "Analytiques Financières & Profitabilité", "Support WhatsApp Prioritaire", "Historique Audit & Sécurité"].map((feat, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="font-medium">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button 
                onClick={() => router.push("/sign-up")}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all"
              >
                Commencer l&apos;essai 14 jours
              </button>
            </motion.div>

            {/* Enterprise Plan */}
            <motion.div whileHover={{ y: -6 }} className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl flex flex-col justify-between shadow-xl relative">
              <div>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-wider block mb-2">Sur Mesure</span>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-4xl font-black text-white">Sur Devise</span>
                </div>
                <p className="text-slate-400 text-sm mb-6">Pour les groupes d&apos;écoles et réseaux multi-sites.</p>
                <div className="h-px bg-slate-800 mb-6" />
                <ul className="space-y-3.5 text-sm text-slate-300 mb-8">
                  {["Élèves & Campus Illimités", "Serveur Dedié Supabase", "Intégration sur-mesure", "Accompagnement w Formation sur place", "SLA & Manager Dédié"].map((feat, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <a 
                href="https://wa.me/23889444" 
                target="_blank" 
                rel="noreferrer"
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl transition-all text-center block"
              >
                Contacter l&apos;équipe commercial
              </a>
            </motion.div>

          </div>
        </div>
      </section>

      {/* ❓ FAQ ACCORDION SECTION */}
      <section id="faq" className="py-24 px-4 sm:px-6 bg-slate-900/40 border-t border-slate-800/80 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight mb-4">
              Questions Fréquentes (FAQ)
            </h2>
            <p className="text-slate-400 text-base">Tout ce que vous devez savoir pour démarrer avec SnapSchool f&apos;écoletkoum.</p>
          </motion.div>

          <div className="space-y-4">
            {faqs.map((faq, i) => {
              const isOpen = openFaq === i;
              return (
                <div key={i} className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-all">
                  <button 
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full p-6 text-left font-bold text-base sm:text-lg text-white flex items-center justify-between gap-4 hover:text-indigo-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <Minus className="w-5 h-5 text-indigo-400 shrink-0" /> : <Plus className="w-5 h-5 text-slate-400 shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="px-6 pb-6 text-slate-400 text-sm leading-relaxed"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 🏁 FINAL CTA BANNER */}
      <section className="relative py-28 px-4 sm:px-6 bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden border-t border-slate-800/80">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-indigo-600/20 rounded-full blur-[140px] pointer-events-none" />
        
        <motion.div 
          initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUpVariant}
          className="max-w-4xl mx-auto text-center relative z-10"
        >
          <h2 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight mb-6">
            Prêt à moderniser ton école ?
          </h2>
          <p className="text-lg sm:text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Crée l&apos;espace de ton établissement f&apos;quelques minutes. Essai gratuit sans carte bancaire.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button 
              onClick={() => router.push("/sign-up")}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-base rounded-full shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              Commencer maintenant <ChevronRight className="w-5 h-5" />
            </button>
            <a 
              href="https://wa.me/23889444" 
              target="_blank"
              rel="noreferrer"
              className="px-8 py-4 bg-slate-900 text-slate-200 font-semibold text-base rounded-full border border-slate-700 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" /> Parler avec un expert
            </a>
          </div>
        </motion.div>
      </section>

      {/* 🦶 FOOTER */}
      <footer className="bg-slate-950 px-6 py-16 border-t border-slate-800/80 text-slate-400 text-sm">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-12 mb-12">
          
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-tr from-indigo-600 to-purple-500 rounded-xl flex items-center justify-center shadow-md">
                <span className="text-white font-black text-lg leading-none">S</span>
              </div>
              <span className="text-lg font-bold text-white tracking-tight">SnapSchool</span>
            </div>
            <p className="text-slate-400 leading-relaxed max-w-sm">
              La plateforme visuelle moderne pour les écoles privées, lycées et académies en Tunisie 🇹🇳.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold text-white mb-4">Plateforme</h4>
            <ul className="space-y-2.5">
              <li><a href="#features" className="hover:text-white transition-colors">Modules</a></li>
              <li><a href="#analytics" className="hover:text-white transition-colors">Analytiques</a></li>
              <li><a href="#mobile" className="hover:text-white transition-colors">App Mobile</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Ressources</h4>
            <ul className="space-y-2.5">
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              <li><Link href="/sign-in" className="hover:text-white transition-colors">Espace Connexion</Link></li>
              <li><Link href="/sign-up" className="hover:text-white transition-colors">Inscription École</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white mb-4">Contact</h4>
            <ul className="space-y-2.5">
              <li><a href="https://wa.me/23889444" className="hover:text-white transition-colors flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5 text-emerald-400" /> WhatsApp</a></li>
              <li><span className="text-slate-500">support@snapschool.io</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} SnapSchool Platform. Tous droits réservés.</div>
          <div className="flex gap-6">
            <span>Politique de Confidentialité</span>
            <span>Conditions d&apos;Utilisation</span>
          </div>
        </div>
      </footer>
    </div>
  );
}