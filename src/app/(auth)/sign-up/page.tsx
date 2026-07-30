"use client";

import { signUpAction } from "../actions";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  Building2,
  Mail,
  Lock,
  Phone,
  MapPin,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  GraduationCap,
  Users,
  MessageSquare,
} from "lucide-react";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full bg-white border border-gray-200 rounded-2xl pl-11 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-gray-600 mb-1.5 block uppercase tracking-wider";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await signUpAction(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  const guarantees = [
    { title: "Essai gratuit 14 jours", desc: "Sans carte bancaire ni engagement" },
    { title: "Importation gratuite", desc: "Vos données Excel / CSV intégrées gratuitement" },
    { title: "Support dédié 7j/7", desc: "Assistance téléphonique et WhatsApp" },
    { title: "Conforme Tunisie", desc: "Trimestres, devoirs et bulletins officiels" },
  ];

  return (
    <div className="min-h-screen flex bg-white text-gray-900 font-sans">
      {/* ── LEFT PANEL (Showcase & Trust) ─────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[42%] xl:w-[38%] bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden text-white">
        {/* Glow Effects */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SnapSchool</span>
          </Link>
        </div>

        {/* Center Text */}
        <div className="relative z-10 space-y-8 my-auto py-10">
          <div>
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
              <Zap className="w-3.5 h-3.5" /> Démarrage immédiat
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight mb-4">
              Modernisez la gestion de votre école dès aujourd&apos;hui.
            </h2>
            <p className="text-blue-100/80 text-sm sm:text-base leading-relaxed">
              Inscrivez votre établissement et profitez d&apos;un accès complet à notre plateforme de gestion scolaire.
            </p>
          </div>

          {/* Guarantees List */}
          <div className="space-y-4">
            {guarantees.map((g, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex items-start gap-3"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold">{g.title}</p>
                  <p className="text-blue-200/70 text-xs">{g.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Quote Card */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl p-5">
            <p className="text-blue-50 text-sm leading-relaxed italic mb-3">
              &ldquo;SnapSchool nous a permis d&apos;éliminer la paperasse et de communiquer instantanément avec les parents d&apos;élèves.&rdquo;
            </p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xs">KB</div>
              <div>
                <p className="text-white text-xs font-bold">Mme Khadija B.</p>
                <p className="text-blue-200 text-[11px]">Directrice, École Privée Al-Irfane</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 flex items-center justify-between text-xs text-blue-300/60">
          <span>© {new Date().getFullYear()} SnapSchool.</span>
          <span className="flex items-center gap-1 text-green-400 font-medium">
            <MessageSquare className="w-3.5 h-3.5" /> Assistance WhatsApp
          </span>
        </div>
      </div>

      {/* ── RIGHT PANEL (Multi-step styled Registration Form) ─────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-6 sm:p-10 lg:p-14 overflow-y-auto">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">SnapSchool</span>
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-2xl bg-white p-8 sm:p-10 rounded-3xl border border-gray-100 shadow-xl"
        >
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-semibold mb-3">
              <Building2 className="w-3.5 h-3.5" /> Création d&apos;espace école
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
              Demande d&apos;ouverture de compte
            </h1>
            <p className="text-sm text-gray-500 font-normal">
              Remplissez le formulaire ci-dessous pour configurer l&apos;espace de votre établissement.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* SECTION 1: RESPONSABLE */}
            <div>
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                <User className="w-4 h-4" /> 1. Responsable de l&apos;établissement
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Prénom *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="Mohamed"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Nom *</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="surname"
                      required
                      placeholder="Ben Ali"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Adresse Email *</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="directeur@ecole.tn"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Numéro de Téléphone *</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="tel"
                      name="phone"
                      required
                      placeholder="+216 98 123 456"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: ÉTABLISSEMENT */}
            <div className="pt-2 border-t border-gray-100">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-3 pt-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" /> 2. Informations sur l&apos;Établissement
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={labelClass}>Nom de l&apos;établissement *</label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      name="schoolName"
                      required
                      placeholder="École Privée Al-Amal"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Gouvernorat / Ville *</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      name="city"
                      defaultValue="Tunis"
                      className={`${inputClass} appearance-none cursor-pointer`}
                    >
                      <option value="Tunis">Tunis</option>
                      <option value="Ariana">Ariana</option>
                      <option value="Ben Arous">Ben Arous</option>
                      <option value="Manouba">Manouba</option>
                      <option value="Nabeul">Nabeul</option>
                      <option value="Sousse">Sousse</option>
                      <option value="Monastir">Monastir</option>
                      <option value="Sfax">Sfax</option>
                      <option value="Bizerte">Bizerte</option>
                      <option value="Autre">Autre gouvernorat</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Mot de Passe *</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      required
                      minLength={6}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SUBMIT BUTTON */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-blue-600 text-white font-semibold text-base rounded-2xl hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 shadow-lg shadow-blue-600/25"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Créer mon espace école
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="pt-6 text-center text-sm text-gray-500 font-medium">
            Vous avez déjà un compte ?{" "}
            <Link href="/sign-in" className="text-blue-600 font-semibold hover:underline">
              Se connecter
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
