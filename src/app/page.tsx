"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Calendar,
  Wallet,
  GraduationCap,
  Sparkles,
  Phone,
  MessageCircle,
  Clock,
  Shield,
  BookOpen,
  Receipt,
  Users,
  Check,
} from "lucide-react";

export default function LandingPage() {
  const [activeTab, setActiveTab] = useState<"bulletins" | "finances" | "timetable">("bulletins");

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white">
      {/* ── Top Bar / Announcement ─────────────────────────────────────────── */}
      <div className="bg-slate-900 text-white text-xs py-2.5 px-4 text-center border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">
            <Sparkles className="w-3 h-3" /> Rentrée 2026/2027
          </span>
          <span className="text-slate-300 font-medium hidden sm:inline">
            Migration offerte de vos fichiers Excel vers SnapSchool en 48h.
          </span>
          <a
            href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20de%20SnapSchool"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-1 underline underline-offset-4"
          >
            Réserver un créneau <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-blue-600/30 group-hover:scale-105 transition-transform">
              S
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">SnapSchool</span>
              <span className="text-[10px] block font-semibold text-blue-600 uppercase tracking-wider -mt-1">
                Système Scolaire
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
            <a href="#fonctionnalites" className="hover:text-blue-600 transition-colors">
              Fonctionnalités
            </a>
            <a href="#apercu" className="hover:text-blue-600 transition-colors">
              Aperçu Produit
            </a>
            <a href="#tarifs" className="hover:text-blue-600 transition-colors">
              Tarifs
            </a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm font-semibold text-slate-700 hover:text-blue-600 px-4 py-2 rounded-xl transition-colors"
            >
              Se connecter
            </Link>
            <a
              href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20de%20SnapSchool"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" /> Démo WhatsApp
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-6">
              <Shield className="w-3.5 h-3.5" /> Conçu pour les écoles privées en Tunisie
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] mb-6">
              Gérez votre établissement <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                sans friction ni erreurs
              </span>.
            </h1>

            <p className="text-lg sm:text-xl text-slate-600 font-medium leading-relaxed mb-8">
              Bulletins officiels aux normes tunisiennes, calculs automatiques des coefficients,
              recouvrement des écolages en DT et emplois du temps sans conflits.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20une%20d%C3%A9mo%20personnalis%C3%A9e%20de%20SnapSchool"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold px-7 py-4 rounded-2xl shadow-xl shadow-blue-600/25 hover:shadow-blue-600/35 transition-all text-base active:scale-95"
              >
                <MessageCircle className="w-5 h-5" /> Demander une démo immédiate
              </a>
              <Link
                href="/sign-in"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-100 text-slate-800 font-bold px-7 py-4 rounded-2xl border border-slate-200 shadow-sm transition-all text-base"
              >
                Accès Établissement <ArrowRight className="w-4 h-4 text-slate-400" />
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6 text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Déploiement en 48h
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Import Excel gratuit
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600" /> Support local 7j/7
              </span>
            </div>
          </div>

          {/* ── Product Interactive Showcase ─────────────────────────────────── */}
          <div id="apercu" className="max-w-5xl mx-auto bg-white rounded-3xl border border-slate-200/80 shadow-2xl p-4 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  SnapSchool OS v2.0
                </span>
              </div>

              {/* Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("bulletins")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "bulletins"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> Bulletins & Moyennes
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("finances")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "finances"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Wallet className="w-3.5 h-3.5" /> Écolages & Recouvrement
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("timetable")}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "timetable"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" /> Emploi du Temps
                </button>
              </div>
            </div>

            {/* Tab 1: Bulletins */}
            {activeTab === "bulletins" && (
              <div className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Bulletin Trimestriel Conforme au Ministère de l&apos;Éducation
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Calcul automatique : Contrôle (x1), Synthèse (x2), Coefficients et rangs de classe.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                      Moyenne générale : 15.42 / 20
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Matière</th>
                        <th className="p-3 text-center">Coeff</th>
                        <th className="p-3 text-center">Contrôle</th>
                        <th className="p-3 text-center">Synthèse</th>
                        <th className="p-3 text-center">Moyenne</th>
                        <th className="p-3">Observations de l&apos;enseignant</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      <tr>
                        <td className="p-3 font-semibold text-slate-900">Mathématiques</td>
                        <td className="p-3 text-center font-bold">3.0</td>
                        <td className="p-3 text-center">15.50</td>
                        <td className="p-3 text-center">16.00</td>
                        <td className="p-3 text-center font-bold text-blue-600">15.83</td>
                        <td className="p-3 text-slate-500">Très bonne maîtrise du raisonnement.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-900">Français</td>
                        <td className="p-3 text-center font-bold">2.0</td>
                        <td className="p-3 text-center">14.00</td>
                        <td className="p-3 text-center">15.00</td>
                        <td className="p-3 text-center font-bold text-blue-600">14.67</td>
                        <td className="p-3 text-slate-500">Bon investissement à l&apos;oral et à l&apos;écrit.</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-slate-900">Sciences Physiques</td>
                        <td className="p-3 text-center font-bold">2.0</td>
                        <td className="p-3 text-center">16.50</td>
                        <td className="p-3 text-center">15.50</td>
                        <td className="p-3 text-center font-bold text-blue-600">15.83</td>
                        <td className="p-3 text-slate-500">Excellents résultats aux travaux pratiques.</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 2: Finances */}
            {activeTab === "finances" && (
              <div className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Suivi des Écolages & Salaires en Dinars Tunisiens (DT)
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Tableau de bord financier en temps réel avec relances parents automatiques.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                      Recouvrement : 88.5%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <span className="text-xs text-slate-500 font-medium">Total encaissé ce mois</span>
                    <p className="text-2xl font-black text-slate-900 mt-1">42 850 DT</p>
                    <span className="text-[11px] text-emerald-600 font-semibold">+12% vs mois dernier</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <span className="text-xs text-slate-500 font-medium">Impayés & Restant dû</span>
                    <p className="text-2xl font-black text-amber-600 mt-1">5 400 DT</p>
                    <span className="text-[11px] text-slate-500 font-medium">14 familles relancées</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
                    <span className="text-xs text-slate-500 font-medium">Masse salariale & Avances</span>
                    <p className="text-2xl font-black text-slate-900 mt-1">18 200 DT</p>
                    <span className="text-[11px] text-blue-600 font-semibold">22 enseignants réglés</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Timetable */}
            {activeTab === "timetable" && (
              <div className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Générateur d&apos;Emploi du Temps Anti-Conflit
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Alerte automatique si un enseignant ou une salle est affecté(e) deux fois.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                      0 conflit détecté
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <span className="font-bold text-blue-900 block">08:00 - 10:00</span>
                    <p className="font-bold text-blue-700 text-sm mt-1">Mathématiques</p>
                    <p className="text-blue-600 text-[11px]">M. Ben Amor • Salle 12</p>
                  </div>
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                    <span className="font-bold text-indigo-900 block">10:15 - 12:15</span>
                    <p className="font-bold text-indigo-700 text-sm mt-1">Français</p>
                    <p className="text-indigo-600 text-[11px]">Mme Trabelsi • Salle 8</p>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <span className="font-bold text-emerald-900 block">14:00 - 15:00</span>
                    <p className="font-bold text-emerald-700 text-sm mt-1">Informatique</p>
                    <p className="text-emerald-600 text-[11px]">M. Gharbi • Lab Info</p>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                    <span className="font-bold text-purple-900 block">15:15 - 17:15</span>
                    <p className="font-bold text-purple-700 text-sm mt-1">Sciences Physiques</p>
                    <p className="text-purple-600 text-[11px]">Mme Ayadi • Labo</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── 3 Core Pillars (Why SnapSchool) ─────────────────────────────────── */}
      <section id="fonctionnalites" className="py-20 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-2">
              L&apos;Essentiel Sans Le Superflu
            </h2>
            <p className="text-3xl font-black text-slate-900 tracking-tight">
              Trois piliers fondamentaux pour sécuriser votre école
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Pillar 1 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center mb-6">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Conformité Ministérielle Totale
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Ne perdez plus des nuits sur Excel à calculer les moyennes trimestrielles.
                SnapSchool intègre la pondération officielle tunisienne : devoirs de contrôle,
                synthèses, coefficients par niveau et édition de bulletins prêts pour signature.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Saisie rapide par les enseignants
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Calcul automatique des rangs & moyennes
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-600" /> Export PDF individuel ou groupé
                </li>
              </ul>
            </div>

            {/* Pillar 2 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center mb-6">
                <Receipt className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Écolages & Trésorerie en Dinars (DT)
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Gardez une vision claire de votre trésorerie. Suivez les paiements annuels,
                trimestriels ou mensuels, générez des reçus immédiats et identifiez les retards
                de paiement en un coup d&apos;œil sans risque d&apos;oubli.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Reçus de paiement avec numéro unique
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Gestion des avances & salaires profs
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Relance des impayés par WhatsApp
                </li>
              </ul>
            </div>

            {/* Pillar 3 */}
            <div className="p-8 rounded-3xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center mb-6">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">
                Emploi du Temps Anti-Conflit
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                Créez et ajustez vos grilles horaires pour l&apos;école primaire, le collège ou le lycée.
                Notre système détecte instantanément les collisions d&apos;enseignants ou de salles
                et supporte les créneaux modulables de 1h ou 2h.
              </p>
              <ul className="space-y-2 text-xs font-semibold text-slate-700">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Détection de collision en direct
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Vue classe, enseignant ou globale
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" /> Consultation mobile pour les profs
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing & Onboarding ────────────────────────────────────────────── */}
      <section id="tarifs" className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-2">
              Tarification Transparente
            </h2>
            <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              Une formule claire, sans surprise ni surcoût
            </p>
            <p className="text-slate-400 text-sm mt-3">
              Tout est inclus : support direct WhatsApp, formation de votre équipe et mises à jour continues.
            </p>
          </div>

          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
            <div className="text-center pb-8 border-b border-white/10">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4 border border-blue-400/20">
                Abonnement Établissement
              </span>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl font-black text-white">Sur mesure</span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Adapté au nombre d&apos;élèves et de classes de votre école (Primaire, Collège, Lycée)
              </p>
            </div>

            <div className="py-6 space-y-3.5 text-sm">
              <div className="flex items-center gap-3 text-slate-200">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Importation complète de vos fichiers Excel actuels</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Génération illimitée de bulletins aux normes tunisiennes</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Module financier complet en Dinars Tunisiens (DT)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Comptes illimités (Directeurs, Professeurs, Parents)</span>
              </div>
              <div className="flex items-center gap-3 text-slate-200">
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <span>Accompagnement & assistance WhatsApp 7j/7</span>
              </div>
            </div>

            <div className="pt-6 border-t border-white/10">
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20obtenir%20un%20devis%20SnapSchool%20pour%20mon%20%C3%A9cole"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-lg transition-all text-sm"
              >
                <Phone className="w-4 h-4" /> Discuter avec notre équipe (+216 23 889 444)
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer id="contact" className="bg-slate-950 text-slate-400 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-sm">
                S
              </div>
              <span className="text-white font-bold text-base tracking-tight">SnapSchool</span>
            </div>

            <div className="flex items-center gap-6 text-slate-400 font-medium">
              <span>Tunis, Tunisie</span>
              <span>•</span>
              <a href="tel:+21623889444" className="hover:text-white transition-colors">
                +216 23 889 444
              </a>
              <span>•</span>
              <a href="mailto:contact@snapschool.tn" className="hover:text-white transition-colors">
                contact@snapschool.tn
              </a>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/sign-in" className="text-blue-400 hover:text-blue-300 font-semibold">
                Accès Direction
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-500">
            <p>© {new Date().getFullYear()} SnapSchool. Conçu spécialement pour l&apos;éducation privée en Tunisie.</p>
            <p>Développé avec rigueur et sécurité des données scolaires.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}