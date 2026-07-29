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
  LineChart,
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
  BookOpen,
  ClipboardList,
  CreditCard,
  FileText,
  Phone,
  Mail,
  MapPin,
  Clock,
  UserCheck,
  LayoutDashboard,
  Menu as MenuIcon,
  X,
  Plus,
  Minus,
  ArrowUpRight,
  Layers,
  PieChart,
  Megaphone,
  Settings,
  Database,
  Globe,
  MonitorSmartphone,
} from "lucide-react";

/* ─────────── ANIMATION HELPERS ─────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.5 } },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

function Section({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
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
    { label: "Fonctionnalités", href: "#fonctionnalites" },
    { label: "Comment ça marche", href: "#etapes" },
    { label: "Parents", href: "#parents" },
    { label: "Tarifs", href: "#tarifs" },
    { label: "FAQ", href: "#faq" },
  ];

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
                className="text-[13px] font-medium text-gray-500 hover:text-blue-600 transition-colors"
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
                  className="text-sm font-medium text-gray-600 hover:text-blue-600 px-4 py-2 transition-colors"
                >
                  Connexion
                </button>
                <button
                  onClick={() => router.push("/sign-up")}
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg transition-all hover:shadow-md"
                >
                  Essai gratuit
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/admin")}
                className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg transition-colors"
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
                    onClick={() => setMobileOpen(false)}
                    className="block text-sm font-medium text-gray-700 hover:text-blue-600 py-2"
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

/* ─────────── PAGE ─────────── */
export default function Homepage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
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
    if (isSignedIn) router.push("/admin");
    else router.push("/sign-in");
  };

  /* ── data ── */
  const features = [
    { icon: ClipboardList, title: "Gestion des absences", description: "Suivi quotidien des présences par classe. Les parents reçoivent une notification instantanée en cas d'absence ou de retard de leur enfant.", color: "bg-red-50 text-red-600" },
    { icon: FileText, title: "Notes et bulletins", description: "Saisie des notes par les enseignants, calcul automatique des moyennes trimestrielles, classements et génération des bulletins PDF prêts à imprimer.", color: "bg-purple-50 text-purple-600" },
    { icon: CreditCard, title: "Paiements et finances", description: "Suivi complet des frais de scolarité, tranches de paiement, recettes et dépenses. Graphiques financiers en temps réel.", color: "bg-emerald-50 text-emerald-600" },
    { icon: Calendar, title: "Emploi du temps", description: "Création et gestion des emplois du temps par classe, enseignant et salle. Détection automatique des conflits.", color: "bg-amber-50 text-amber-600" },
    { icon: Bell, title: "Notifications push", description: "Notifications instantanées envoyées aux parents et enseignants pour les absences, notes, annonces et événements.", color: "bg-blue-50 text-blue-600" },
    { icon: ShieldCheck, title: "Sécurité et audit", description: "Chaque action est enregistrée dans un journal d'audit horodaté. Sauvegardes quotidiennes automatiques.", color: "bg-gray-100 text-gray-700" },
    { icon: Users, title: "Gestion des élèves", description: "Fiches élèves complètes avec informations personnelles, coordonnées des parents, historique scolaire et documents.", color: "bg-cyan-50 text-cyan-600" },
    { icon: BookOpen, title: "Ressources pédagogiques", description: "Partage de cours, devoirs et supports entre enseignants et élèves. Bibliothèque numérique de l'établissement.", color: "bg-pink-50 text-pink-600" },
    { icon: BarChart3, title: "Statistiques et rapports", description: "Tableaux de bord détaillés sur les performances scolaires, le taux de présence, les finances et les tendances.", color: "bg-indigo-50 text-indigo-600" },
  ];

  const steps = [
    { num: "01", title: "Créez votre espace", desc: "Inscrivez votre école en quelques minutes. Votre espace sécurisé est prêt immédiatement.", icon: Building2 },
    { num: "02", title: "Importez vos données", desc: "Importez vos classes, élèves et enseignants depuis un fichier Excel ou CSV. Aucune saisie manuelle nécessaire.", icon: Database },
    { num: "03", title: "Configurez vos paramètres", desc: "Personnalisez les trimestres, coefficients, types de devoirs et rôles des utilisateurs selon votre établissement.", icon: Settings },
    { num: "04", title: "Invitez votre équipe", desc: "Ajoutez vos administrateurs et enseignants. Les parents reçoivent un lien pour télécharger l'application mobile.", icon: Users },
  ];

  const details = [
    {
      title: "Suivi quotidien des présences",
      description: "Chaque matin, les enseignants effectuent l'appel depuis leur espace. En un clic, l'absence est enregistrée et les parents reçoivent une notification sur leur téléphone. Le directeur dispose d'un tableau récapitulatif avec les taux de présence par classe, par période et par élève.",
      icon: ClipboardList,
      color: "text-red-600 bg-red-50",
      stats: [
        { label: "Temps d'appel moyen", value: "45s" },
        { label: "Notification parent", value: "< 1s" },
      ],
    },
    {
      title: "Bulletins de notes automatisés",
      description: "Les enseignants saisissent les notes une seule fois. SnapSchool calcule automatiquement les moyennes par matière, la moyenne générale, le classement et génère un bulletin PDF conforme au format officiel tunisien — avec trimestres, devoirs de contrôle, devoirs de synthèse et coefficients.",
      icon: FileText,
      color: "text-purple-600 bg-purple-50",
      stats: [
        { label: "Moyenne Trim. 1", value: "14.8/20" },
        { label: "Rang classe", value: "3ème / 32" },
      ],
    },
    {
      title: "Gestion financière complète",
      description: "Suivez les frais de scolarité par élève, gérez les tranches de paiement et les retards. Visualisez les recettes, dépenses et la trésorerie avec des graphiques clairs. Exportez des rapports financiers mensuels ou trimestriels pour votre comptabilité.",
      icon: CreditCard,
      color: "text-emerald-600 bg-emerald-50",
      stats: [
        { label: "Revenu mensuel", value: "48 250 DT" },
        { label: "Taux recouvrement", value: "94%" },
      ],
    },
  ];

  const faqs = [
    { q: "Combien de temps faut-il pour démarrer avec SnapSchool ?", a: "Votre espace est créé en quelques minutes. Vous pouvez importer vos élèves, enseignants et classes depuis un fichier Excel ou CSV. La prise en main est rapide grâce à une interface simple." },
    { q: "SnapSchool est-il adapté aux écoles privées tunisiennes ?", a: "Oui. SnapSchool est conçu pour le système éducatif tunisien : trimestres, devoirs de contrôle et de synthèse, coefficients, bulletins officiels, et gestion bilingue Français / Arabe." },
    { q: "Les parents peuvent-ils utiliser l'application sur téléphone ?", a: "Oui. Les parents disposent d'une application mobile dédiée (iOS et Android) avec des notifications instantanées pour les absences, les notes, les devoirs et les annonces officielles." },
    { q: "Comment les données sont-elles sécurisées ?", a: "Vos données sont hébergées sur une infrastructure cloud sécurisée avec sauvegardes quotidiennes automatiques, un journal d'audit complet pour chaque action administrative, et un chiffrement conforme aux normes en vigueur." },
    { q: "Quel accompagnement est inclus ?", a: "Tous les abonnements incluent un support dédié par WhatsApp, une assistance à la prise en main pour votre équipe administrative et vos enseignants, ainsi que des mises à jour régulières gratuites." },
    { q: "Peut-on essayer gratuitement ?", a: "Oui. Tous les forfaits proposent un essai gratuit de 14 jours sans carte bancaire. Vous pouvez tester l'ensemble des fonctionnalités avec vos propres données." },
    { q: "SnapSchool fonctionne-t-il sur mobile et ordinateur ?", a: "Oui. L'espace administration et enseignants est accessible depuis un navigateur web sur ordinateur, tablette ou téléphone. Les parents utilisent l'application mobile dédiée." },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Navbar isSignedIn={!!isSignedIn} handleLoginClick={handleLoginClick} router={router} />

      {/* ═══════════ HERO ═══════════ */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-24 bg-gradient-to-b from-blue-50/70 via-blue-50/30 to-white relative overflow-hidden">
        {/* Subtle floating shapes */}
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
                <svg className="absolute -bottom-1 left-0 w-full" height="6" viewBox="0 0 200 6" fill="none"><path d="M0 3C50 0.5 150 0.5 200 3" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" /></svg>
              </span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-10">
              Absences, notes, bulletins, paiements, emploi du temps et communication avec les parents — le tout centralisé dans un seul espace sécurisé et facile à utiliser.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-lg transition-all hover:shadow-lg hover:shadow-blue-600/25 flex items-center justify-center gap-2 group"
              >
                Commencer gratuitement
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="https://wa.me/23889444"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-[15px] rounded-lg border border-gray-200 transition-all hover:border-gray-300 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-green-600" />
                Demander une démo
              </a>
            </motion.div>
          </motion.div>

          {/* Dashboard Preview */}
          <Section>
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
                <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden">
                  <Image
                    src="/landing/dashboard.png"
                    alt="Tableau de bord SnapSchool"
                    width={1400}
                    height={875}
                    className="w-full h-full object-cover object-top"
                    priority
                  />
                </div>
              </motion.div>
            </div>
          </Section>
        </div>
      </section>

      {/* ═══════════ TRUST BAR ═══════════ */}
      <Section className="py-14 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { value: "99.9%", label: "Disponibilité garantie" },
              { value: "10x", label: "Saisie plus rapide" },
              { value: "< 1s", label: "Alertes aux parents" },
              { value: "100%", label: "Adapté écoles privées" },
            ].map((s, i) => (
              <motion.div key={i} variants={fadeUp} className="text-center">
                <div className="text-3xl sm:text-4xl font-bold text-blue-600">{s.value}</div>
                <div className="text-sm text-gray-500 mt-1 font-medium">{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </Section>

      {/* ═══════════ FONCTIONNALITÉS (9 cards) ═══════════ */}
      <section id="fonctionnalites" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-4">
                <Layers className="w-3.5 h-3.5" /> 9 modules intégrés
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Tout ce dont votre école a besoin
              </h2>
              <p className="text-gray-500 text-base sm:text-lg">
                Une plateforme complète qui couvre l&apos;ensemble des besoins administratifs, pédagogiques et financiers de votre établissement.
              </p>
            </div>
          </Section>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ DETAILED FEATURES (alternating) ═══════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-16">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Des outils conçus pour le quotidien
              </h2>
              <p className="text-gray-500 text-base sm:text-lg">
                Découvrez en détail comment SnapSchool simplifie chaque aspect de la gestion de votre école.
              </p>
            </div>
          </Section>

          <div className="space-y-20">
            {details.map((d, i) => (
              <Section key={i}>
                <div className={`flex flex-col ${i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"} items-center gap-12 lg:gap-16`}>
                  {/* Content */}
                  <div className="flex-1">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${d.color}`}>
                      <d.icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">{d.title}</h3>
                    <p className="text-gray-500 text-[15px] leading-relaxed mb-6">{d.description}</p>
                    <div className="flex gap-6">
                      {d.stats.map((s, j) => (
                        <div key={j} className="bg-white rounded-xl border border-gray-100 px-5 py-3">
                          <div className="text-xs text-gray-400 font-medium mb-1">{s.label}</div>
                          <div className="text-lg font-bold text-gray-900">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Visual card */}
                  <motion.div
                    className="flex-1 w-full"
                    whileHover={{ scale: 1.02 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-lg p-8 relative overflow-hidden">
                      <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-10 ${d.color.split(" ")[1].replace("text-", "bg-")}`} />
                      {/* Mini dashboard mockup */}
                      <div className="space-y-4 relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${d.color}`}>
                            <d.icon className="w-4 h-4" />
                          </div>
                          <span className="font-semibold text-gray-800 text-sm">{d.title}</span>
                        </div>
                        {[1, 2, 3].map((row) => (
                          <div key={row} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100" />
                            <div className="flex-1 space-y-1.5">
                              <div className="h-2.5 bg-gray-100 rounded-full" style={{ width: `${70 + row * 8}%` }} />
                              <div className="h-2 bg-gray-50 rounded-full" style={{ width: `${40 + row * 12}%` }} />
                            </div>
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.color}`}>
                              {row === 1 ? "Actif" : row === 2 ? "En cours" : "Terminé"}
                            </div>
                          </div>
                        ))}
                        <div className="pt-4 border-t border-gray-50 flex gap-2">
                          {[60, 45, 80, 35, 90, 55, 70].map((h, idx) => (
                            <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                              <div
                                className={`w-full rounded-sm ${d.color.split(" ")[0]} opacity-60`}
                                style={{ height: `${h * 0.5}px` }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </Section>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ COMMENT ÇA MARCHE (Steps) ═══════════ */}
      <section id="etapes" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-4">
                <Clock className="w-3.5 h-3.5" /> Démarrage rapide
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Prêt en 4 étapes simples
              </h2>
              <p className="text-gray-500 text-base sm:text-lg">
                Pas besoin d&apos;installation ni de compétences techniques. Votre école est opérationnelle en moins d&apos;une journée.
              </p>
            </div>
          </Section>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
          >
            {steps.map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="relative bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-md transition-all"
              >
                <div className="text-4xl font-black text-blue-100 mb-3">{step.num}</div>
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-4">
                  <step.icon className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 z-10">
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ PORTAILS (3 roles) ═══════════ */}
      <section className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-xs font-semibold mb-4">
                <MonitorSmartphone className="w-3.5 h-3.5" /> Multi-portails
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Un espace dédié pour chaque utilisateur
              </h2>
              <p className="text-gray-500 text-base sm:text-lg">
                Administration, enseignants et parents accèdent chacun à leur propre interface adaptée.
              </p>
            </div>
          </Section>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
          >
            {[
              { icon: Building2, role: "Administration", desc: "Vue complète sur les classes, les enseignants, les élèves, la comptabilité et les statistiques de l'établissement.", items: ["Tableau de bord global", "Gestion financière", "Paramètres de l'école", "Journal d'audit"], color: "bg-blue-600" },
              { icon: GraduationCap, role: "Enseignants", desc: "Saisie des notes, suivi des absences et communication directe avec les parents.", items: ["Saisie des notes", "Appel quotidien", "Emploi du temps", "Ressources pédagogiques"], color: "bg-purple-600" },
              { icon: Smartphone, role: "Parents", desc: "Application mobile pour suivre la scolarité de leurs enfants en temps réel.", items: ["Notes et bulletins", "Alertes d'absence", "Paiements", "Messages de l'école"], color: "bg-emerald-600" },
            ].map((p, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className="bg-white rounded-2xl border border-gray-100 p-7 hover:shadow-md transition-all"
              >
                <div className={`w-11 h-11 ${p.color} rounded-xl flex items-center justify-center mb-5`}>
                  <p.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{p.role}</h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">{p.desc}</p>
                <ul className="space-y-2.5">
                  {p.items.map((item, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══════════ PARENTS / MOBILE ═══════════ */}
      <section id="parents" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <Section className="flex-1 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-8 bg-blue-100 rounded-[56px] blur-3xl opacity-30 pointer-events-none" />
              <motion.div whileHover={{ y: -8, rotate: 1 }} transition={{ duration: 0.4 }}>
                <Image
                  src="/landing/mobile.png"
                  alt="Application mobile parents SnapSchool"
                  width={300}
                  height={610}
                  className="w-[250px] sm:w-[280px] h-auto rounded-[36px] border-[6px] border-gray-200 shadow-2xl relative z-10"
                />
              </motion.div>
            </div>
          </Section>

          <Section className="flex-1" delay={0.15}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4">
              <Smartphone className="w-3.5 h-3.5" /> Application mobile
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Les parents restent connectés à l&apos;école
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8">
              Une application simple et intuitive pour que les parents suivent la scolarité de leurs enfants au quotidien. Disponible sur iOS et Android.
            </p>

            <div className="space-y-5">
              {[
                { icon: Bell, title: "Alertes d'absence en temps réel", desc: "Notification instantanée dès qu'un élève est absent ou en retard." },
                { icon: Award, title: "Notes et bulletins", desc: "Consultation des résultats dès leur publication par l'enseignant." },
                { icon: MessageSquare, title: "Messages et annonces", desc: "Réception des annonces officielles, rappels de réunions et événements." },
                { icon: CreditCard, title: "Suivi des paiements", desc: "Consultation de l'état des paiements de scolarité et des reçus." },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  className="flex gap-4 items-start group"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-100 transition-colors">
                    <item.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-[15px] mb-0.5">{item.title}</h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </Section>
        </div>
      </section>

      {/* ═══════════ TARIFS ═══════════ */}
      <section id="tarifs" className="py-20 sm:py-28 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="max-w-2xl mx-auto text-center mb-14">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Tarifs simples et transparents
              </h2>
              <p className="text-gray-500 text-base sm:text-lg">
                Des formules adaptées à la taille de votre établissement. Sans engagement, sans surprise.
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
                desc: "Pour les petits établissements et centres de soutien scolaire.",
                features: ["Jusqu'à 150 élèves", "3 comptes administrateur", "Notes et examens", "Application mobile parents", "Support par email"],
                featured: false, btnText: "Essayer gratuitement",
              },
              {
                name: "Pro Académie", price: "290 DT", period: "/ mois",
                desc: "Pour les écoles primaires, collèges et lycées privés.",
                features: ["Jusqu'à 600 élèves", "Enseignants illimités", "Emploi du temps automatique", "Statistiques financières", "Support WhatsApp prioritaire", "Sécurité avancée"],
                featured: true, btnText: "Essai gratuit 14 jours",
              },
              {
                name: "Sur mesure", price: "Sur devis", period: "",
                desc: "Pour les groupes d'écoles et réseaux multi-sites.",
                features: ["Élèves et campus illimités", "Serveur dédié", "Intégration sur mesure", "Formation sur place", "Interlocuteur dédié"],
                featured: false, btnText: "Contacter l'équipe",
              },
            ].map((plan, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                whileHover={{ y: -4 }}
                className={`bg-white rounded-2xl p-7 flex flex-col relative transition-all ${
                  plan.featured
                    ? "border-2 border-blue-600 shadow-lg ring-1 ring-blue-100"
                    : "border border-gray-200"
                }`}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider">
                    Recommandé
                  </div>
                )}
                <div>
                  <span className={`text-sm font-semibold uppercase tracking-wider ${plan.featured ? "text-blue-600" : "text-gray-500"}`}>
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1 mt-2 mb-3">
                    <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                    {plan.period && <span className="text-gray-400 text-sm">{plan.period}</span>}
                  </div>
                  <p className="text-sm text-gray-500 mb-6">{plan.desc}</p>
                  <div className="h-px bg-gray-100 mb-6" />
                  <ul className="space-y-3 text-sm text-gray-600 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2.5">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 ${plan.featured ? "text-blue-600" : "text-green-500"}`} />
                        <span className={plan.featured ? "font-medium" : ""}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => plan.featured || i === 0 ? router.push("/sign-up") : null}
                  className={`mt-auto w-full py-3 font-semibold text-sm rounded-lg transition-all ${
                    plan.featured
                      ? "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-md"
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
      <section id="faq" className="py-20 sm:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Section>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
                Questions fréquentes
              </h2>
              <p className="text-gray-500">
                Tout ce que vous devez savoir pour démarrer avec SnapSchool.
              </p>
            </div>
          </Section>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="border border-gray-100 rounded-xl overflow-hidden hover:border-gray-200 transition-colors"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <span className="font-medium text-gray-900 text-[15px]">{faq.q}</span>
                  <motion.div animate={{ rotate: openFaq === i ? 45 : 0 }} transition={{ duration: 0.2 }}>
                    <Plus className={`w-4 h-4 shrink-0 ${openFaq === i ? "text-blue-600" : "text-gray-400"}`} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">{faq.a}</div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA FINAL ═══════════ */}
      <Section>
        <section className="py-20 sm:py-24 bg-blue-600 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500 rounded-full blur-3xl opacity-30 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-700 rounded-full blur-3xl opacity-30 pointer-events-none" />

          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
            <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
              Prêt à simplifier la gestion de votre école ?
            </h2>
            <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
              Créez votre espace en quelques minutes. Essai gratuit de 14 jours, sans carte bancaire.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="px-7 py-3.5 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-all hover:shadow-lg flex items-center justify-center gap-2 group"
              >
                Commencer maintenant
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
              <a
                href="https://wa.me/23889444"
                target="_blank"
                rel="noreferrer"
                className="px-7 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg border border-blue-500 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" /> Parler avec un expert
              </a>
            </div>
          </div>
        </section>
      </Section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div>
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-lg font-bold text-white">SnapSchool</span>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">
                Plateforme de gestion scolaire pour les écoles privées, collèges, lycées et académies.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Plateforme</h4>
              <ul className="space-y-2.5">
                <li><a href="#fonctionnalites" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#etapes" className="hover:text-white transition-colors">Comment ça marche</a></li>
                <li><a href="#parents" className="hover:text-white transition-colors">Application parents</a></li>
                <li><a href="#tarifs" className="hover:text-white transition-colors">Tarifs</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Accès</h4>
              <ul className="space-y-2.5">
                <li><Link href="/sign-in" className="hover:text-white transition-colors">Connexion</Link></li>
                <li><Link href="/sign-up" className="hover:text-white transition-colors">Inscription</Link></li>
                <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Contact</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                  <a href="https://wa.me/23889444" className="hover:text-white transition-colors">WhatsApp</a>
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <span>© {new Date().getFullYear()} SnapSchool. Tous droits réservés.</span>
            <div className="flex gap-6">
              <span>Politique de confidentialité</span>
              <span>Conditions d&apos;utilisation</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}