"use client";

import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
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
  ChevronDown,
  Plus,
  Minus,
} from "lucide-react";

/* ──────────────────────── NAVBAR ──────────────────────── */
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
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Fonctionnalités", href: "#fonctionnalites" },
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
          {/* Logo */}
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

          {/* Desktop Links */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            {!isSignedIn ? (
              <>
                <button
                  onClick={handleLoginClick}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 px-4 py-2 transition-colors"
                >
                  Connexion
                </button>
                <button
                  onClick={() => router.push("/sign-up")}
                  className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-5 py-2.5 rounded-lg transition-colors"
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

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-gray-600"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-4 space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-sm font-medium text-gray-700 hover:text-blue-600 py-2"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
              <button
                onClick={() => { handleLoginClick(); setMobileOpen(false); }}
                className="text-sm font-medium text-gray-700 py-2"
              >
                Connexion
              </button>
              <button
                onClick={() => { router.push("/sign-up"); setMobileOpen(false); }}
                className="text-sm font-semibold text-white bg-blue-600 px-5 py-2.5 rounded-lg"
              >
                Essai gratuit
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

/* ──────────────────────── FEATURE CARD ──────────────────────── */
const FeatureCard = ({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: any;
  title: string;
  description: string;
  color: string;
}) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-lg hover:border-gray-200 transition-all duration-300 group">
    <div
      className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${color}`}
    >
      <Icon className="w-6 h-6" />
    </div>
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
    <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
  </div>
);

/* ──────────────────────── STAT CARD ──────────────────────── */
const StatCard = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl sm:text-4xl font-bold text-blue-600">{value}</div>
    <div className="text-sm text-gray-500 mt-1 font-medium">{label}</div>
  </div>
);

/* ──────────────────────── FAQ ITEM ──────────────────────── */
const FaqItem = ({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
}) => (
  <div className="border border-gray-100 rounded-xl overflow-hidden">
    <button
      onClick={onClick}
      className="w-full px-6 py-5 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
    >
      <span className="font-medium text-gray-900 text-[15px]">{question}</span>
      {isOpen ? (
        <Minus className="w-4 h-4 text-blue-600 shrink-0" />
      ) : (
        <Plus className="w-4 h-4 text-gray-400 shrink-0" />
      )}
    </button>
    {isOpen && (
      <div className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">
        {answer}
      </div>
    )}
  </div>
);

/* ──────────────────────── PAGE ──────────────────────── */
export default function Homepage() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

  const features = [
    {
      icon: ClipboardList,
      title: "Gestion des absences",
      description:
        "Suivi quotidien des présences par classe. Les parents reçoivent une notification instantanée en cas d'absence ou de retard.",
      color: "bg-red-50 text-red-600",
    },
    {
      icon: FileText,
      title: "Notes et bulletins",
      description:
        "Saisie des notes par les enseignants. Calcul automatique des moyennes trimestrielles, classements et bulletins PDF.",
      color: "bg-purple-50 text-purple-600",
    },
    {
      icon: CreditCard,
      title: "Paiements et finances",
      description:
        "Suivi des frais de scolarité, tranches de paiement, dépenses et recettes. Vue claire de la situation financière.",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Calendar,
      title: "Emploi du temps",
      description:
        "Création et gestion des emplois du temps par classe, enseignant et salle. Aucun conflit possible.",
      color: "bg-amber-50 text-amber-600",
    },
    {
      icon: Bell,
      title: "Notifications et annonces",
      description:
        "Envoi de notifications push aux parents et enseignants. Annonces officielles, rappels de réunions et événements.",
      color: "bg-blue-50 text-blue-600",
    },
    {
      icon: ShieldCheck,
      title: "Sécurité et historique",
      description:
        "Chaque action est enregistrée dans un journal d'audit. Données sécurisées avec sauvegardes quotidiennes automatiques.",
      color: "bg-gray-100 text-gray-700",
    },
  ];

  const faqs = [
    {
      q: "Combien de temps faut-il pour démarrer avec SnapSchool ?",
      a: "Votre espace est créé en quelques minutes. Vous pouvez importer vos élèves, enseignants et classes depuis un fichier Excel ou CSV.",
    },
    {
      q: "SnapSchool est-il adapté aux écoles privées tunisiennes ?",
      a: "Oui. SnapSchool est conçu pour le système éducatif tunisien : trimestres, devoirs de contrôle et de synthèse, coefficients, bulletins officiels, et gestion bilingue Français / Arabe.",
    },
    {
      q: "Les parents peuvent-ils utiliser l'application sur téléphone ?",
      a: "Oui. Les parents disposent d'une application mobile dédiée (iOS et Android) avec des notifications pour les absences, les notes et les annonces.",
    },
    {
      q: "Comment les données sont-elles sécurisées ?",
      a: "Vos données sont hébergées sur une infrastructure cloud sécurisée avec sauvegardes quotidiennes, journal d'audit pour chaque action, et chiffrement conforme aux normes.",
    },
    {
      q: "Quel accompagnement est inclus ?",
      a: "Tous les abonnements incluent un support dédié par WhatsApp, une assistance à la prise en main pour votre équipe, et des mises à jour régulières gratuites.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <Navbar
        isSignedIn={!!isSignedIn}
        handleLoginClick={handleLoginClick}
        router={router}
      />

      {/* ───────── HERO ───────── */}
      <section className="pt-24 pb-16 sm:pt-32 sm:pb-20 bg-gradient-to-b from-blue-50/80 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold mb-6">
              <Zap className="w-3.5 h-3.5" />
              Plateforme de gestion scolaire
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight text-gray-900 mb-6">
              La solution complète pour gérer votre{" "}
              <span className="text-blue-600">école privée</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 leading-relaxed max-w-2xl mx-auto mb-8">
              Absences, notes, paiements, emploi du temps et communication avec
              les parents. Tout est centralisé dans un seul espace simple et
              sécurisé.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => router.push("/sign-up")}
                className="w-full sm:w-auto px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[15px] rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Commencer gratuitement <ArrowRight className="w-4 h-4" />
              </button>
              <a
                href="https://wa.me/23889444"
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto px-7 py-3.5 bg-white hover:bg-gray-50 text-gray-700 font-semibold text-[15px] rounded-lg border border-gray-200 transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 text-green-600" /> Demander
                une démo
              </a>
            </div>
          </div>

          {/* Dashboard Preview */}
          <div className="max-w-5xl mx-auto">
            <div className="rounded-xl sm:rounded-2xl overflow-hidden border border-gray-200 shadow-xl bg-white">
              {/* Browser Bar */}
              <div className="h-10 bg-gray-50 border-b border-gray-200 px-4 flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
                  <div className="w-3 h-3 rounded-full bg-gray-300" />
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
            </div>
          </div>
        </div>
      </section>

      {/* ───────── TRUST BAR ───────── */}
      <section className="py-12 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8">
          <StatCard value="99.9%" label="Disponibilité garantie" />
          <StatCard value="10x" label="Saisie plus rapide" />
          <StatCard value="< 1s" label="Alertes aux parents" />
          <StatCard value="100%" label="Adapté écoles privées" />
        </div>
      </section>

      {/* ───────── FONCTIONNALITÉS ───────── */}
      <section id="fonctionnalites" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tout ce dont votre école a besoin
            </h2>
            <p className="text-gray-500 text-base sm:text-lg">
              Une plateforme complète qui couvre l&apos;ensemble des besoins
              administratifs, pédagogiques et financiers de votre établissement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <FeatureCard key={i} {...feature} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PORTAILS (3 roles) ───────── */}
      <section className="py-20 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Un espace dédié pour chaque utilisateur
            </h2>
            <p className="text-gray-500 text-base sm:text-lg">
              Administration, enseignants et parents accèdent chacun à leur
              propre interface adaptée à leurs besoins.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                role: "Administration",
                desc: "Vue complète sur les classes, les enseignants, les élèves, la comptabilité et les statistiques de l'établissement.",
                items: [
                  "Tableau de bord global",
                  "Gestion financière",
                  "Paramètres de l'école",
                  "Journal d'audit",
                ],
                color: "bg-blue-600",
              },
              {
                icon: GraduationCap,
                role: "Enseignants",
                desc: "Saisie des notes, suivi des absences et communication directe avec les parents de leurs classes.",
                items: [
                  "Saisie des notes",
                  "Appel quotidien",
                  "Emploi du temps",
                  "Ressources pédagogiques",
                ],
                color: "bg-purple-600",
              },
              {
                icon: Smartphone,
                role: "Parents",
                desc: "Application mobile pour suivre la scolarité de leurs enfants en temps réel depuis leur téléphone.",
                items: [
                  "Notes et bulletins",
                  "Alertes d'absence",
                  "Paiements en ligne",
                  "Messages de l'école",
                ],
                color: "bg-emerald-600",
              },
            ].map((portal, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-100 p-7 hover:shadow-md transition-shadow"
              >
                <div
                  className={`w-11 h-11 ${portal.color} rounded-xl flex items-center justify-center mb-5`}
                >
                  <portal.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {portal.role}
                </h3>
                <p className="text-sm text-gray-500 mb-5 leading-relaxed">
                  {portal.desc}
                </p>
                <ul className="space-y-2.5">
                  {portal.items.map((item, j) => (
                    <li
                      key={j}
                      className="flex items-center gap-2.5 text-sm text-gray-600"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PARENTS / MOBILE ───────── */}
      <section id="parents" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          {/* Phone mockup */}
          <div className="flex-1 flex justify-center">
            <div className="relative">
              <div className="absolute -inset-6 bg-blue-100 rounded-[48px] blur-2xl opacity-40" />
              <Image
                src="/landing/mobile.png"
                alt="Application mobile parents SnapSchool"
                width={300}
                height={610}
                className="w-[260px] sm:w-[280px] h-auto rounded-[36px] border-[6px] border-gray-200 shadow-2xl relative z-10"
              />
            </div>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold mb-4">
              <Smartphone className="w-3.5 h-3.5" /> Application mobile
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Les parents restent connectés à l&apos;école
            </h2>
            <p className="text-gray-500 text-base leading-relaxed mb-8">
              Une application simple et intuitive sur téléphone pour que les
              parents suivent la scolarité de leurs enfants au quotidien.
            </p>

            <div className="space-y-4">
              {[
                {
                  icon: Bell,
                  title: "Alertes d'absence en temps réel",
                  desc: "Notification instantanée dès qu'un élève est absent ou en retard.",
                },
                {
                  icon: Award,
                  title: "Notes et bulletins",
                  desc: "Consultation des résultats dès leur publication par l'enseignant.",
                },
                {
                  icon: MessageSquare,
                  title: "Messages et annonces",
                  desc: "Réception des annonces officielles, rappels de réunions et événements.",
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <item.icon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 text-[15px] mb-0.5">
                      {item.title}
                    </h4>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────── TARIFS ───────── */}
      <section id="tarifs" className="py-20 sm:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Tarifs simples et transparents
            </h2>
            <p className="text-gray-500 text-base sm:text-lg">
              Des formules adaptées à la taille de votre établissement. Sans
              engagement, sans surprise.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Essentiel */}
            <div className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col">
              <div>
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Essentiel
                </span>
                <div className="flex items-baseline gap-1 mt-2 mb-3">
                  <span className="text-3xl font-bold text-gray-900">
                    120 DT
                  </span>
                  <span className="text-gray-400 text-sm">/ mois</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Pour les petits établissements et centres de soutien scolaire.
                </p>
                <div className="h-px bg-gray-100 mb-6" />
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  {[
                    "Jusqu'à 150 élèves",
                    "3 comptes administrateur",
                    "Notes et examens",
                    "Application mobile parents",
                    "Support par email",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => router.push("/sign-up")}
                className="mt-auto w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm rounded-lg transition-colors"
              >
                Essayer gratuitement
              </button>
            </div>

            {/* Pro — featured */}
            <div className="bg-white rounded-2xl border-2 border-blue-600 p-7 flex flex-col relative shadow-md">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-blue-600 text-white text-[11px] font-bold uppercase tracking-wider">
                Recommandé
              </div>
              <div>
                <span className="text-sm font-semibold text-blue-600 uppercase tracking-wider">
                  Pro Académie
                </span>
                <div className="flex items-baseline gap-1 mt-2 mb-3">
                  <span className="text-3xl font-bold text-gray-900">
                    290 DT
                  </span>
                  <span className="text-gray-400 text-sm">/ mois</span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Pour les écoles primaires, collèges et lycées privés.
                </p>
                <div className="h-px bg-gray-100 mb-6" />
                <ul className="space-y-3 text-sm text-gray-700 mb-8">
                  {[
                    "Jusqu'à 600 élèves",
                    "Enseignants illimités",
                    "Emploi du temps automatique",
                    "Statistiques financières",
                    "Support WhatsApp prioritaire",
                    "Historique et sécurité avancée",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-medium">{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => router.push("/sign-up")}
                className="mt-auto w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg transition-colors"
              >
                Essai gratuit 14 jours
              </button>
            </div>

            {/* Sur mesure */}
            <div className="bg-white rounded-2xl border border-gray-200 p-7 flex flex-col">
              <div>
                <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
                  Sur mesure
                </span>
                <div className="flex items-baseline gap-1 mt-2 mb-3">
                  <span className="text-3xl font-bold text-gray-900">
                    Sur devis
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-6">
                  Pour les groupes d&apos;écoles et réseaux multi-sites.
                </p>
                <div className="h-px bg-gray-100 mb-6" />
                <ul className="space-y-3 text-sm text-gray-600 mb-8">
                  {[
                    "Élèves et campus illimités",
                    "Serveur dédié",
                    "Intégration sur mesure",
                    "Formation sur place",
                    "Interlocuteur dédié",
                  ].map((f, i) => (
                    <li key={i} className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <a
                href="https://wa.me/23889444"
                target="_blank"
                rel="noreferrer"
                className="mt-auto w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-sm rounded-lg transition-colors text-center block"
              >
                Contacter l&apos;équipe commerciale
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section id="faq" className="py-20 sm:py-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold text-gray-900 mb-4">
              Questions fréquentes
            </h2>
            <p className="text-gray-500">
              Tout ce que vous devez savoir pour démarrer.
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FaqItem
                key={i}
                question={faq.q}
                answer={faq.a}
                isOpen={openFaq === i}
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CTA FINAL ───────── */}
      <section className="py-20 sm:py-24 bg-blue-600">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl font-bold text-white mb-4">
            Prêt à simplifier la gestion de votre école ?
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Créez votre espace en quelques minutes. Essai gratuit, sans carte
            bancaire.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3">
            <button
              onClick={() => router.push("/sign-up")}
              className="px-7 py-3.5 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
            >
              Commencer maintenant <ArrowRight className="w-4 h-4" />
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

      {/* ───────── FOOTER ───────── */}
      <footer className="bg-gray-900 text-gray-400 text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">S</span>
                </div>
                <span className="text-lg font-bold text-white">SnapSchool</span>
              </div>
              <p className="text-gray-400 leading-relaxed text-sm">
                Plateforme de gestion scolaire pour les écoles privées, collèges,
                lycées et académies.
              </p>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">
                Plateforme
              </h4>
              <ul className="space-y-2.5">
                <li>
                  <a
                    href="#fonctionnalites"
                    className="hover:text-white transition-colors"
                  >
                    Fonctionnalités
                  </a>
                </li>
                <li>
                  <a
                    href="#parents"
                    className="hover:text-white transition-colors"
                  >
                    Application parents
                  </a>
                </li>
                <li>
                  <a
                    href="#tarifs"
                    className="hover:text-white transition-colors"
                  >
                    Tarifs
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Accès</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/sign-in"
                    className="hover:text-white transition-colors"
                  >
                    Connexion
                  </Link>
                </li>
                <li>
                  <Link
                    href="/sign-up"
                    className="hover:text-white transition-colors"
                  >
                    Inscription
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-4 text-sm">Contact</h4>
              <ul className="space-y-2.5">
                <li className="flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                  <a
                    href="https://wa.me/23889444"
                    className="hover:text-white transition-colors"
                  >
                    WhatsApp
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <span>
              © {new Date().getFullYear()} SnapSchool. Tous droits réservés.
            </span>
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