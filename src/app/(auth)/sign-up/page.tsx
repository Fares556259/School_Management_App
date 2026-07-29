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
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-gray-600 mb-1.5 block";

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

  const features = [
    { icon: Zap, text: "Mise en place immédiate en quelques minutes" },
    { icon: Building2, text: "Sous-domaine et espace école dédié" },
    { icon: ShieldCheck, text: "Essai gratuit de 14 jours sans carte bancaire" },
  ];

  return (
    <div className="min-h-screen flex bg-white text-gray-900 font-sans">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden text-white">
        {/* Decorative background glow */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] bg-indigo-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SnapSchool</span>
          </Link>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8 my-auto py-12">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
              <Building2 className="w-3.5 h-3.5" /> Écoles Privées & Académies
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight mb-4">
              Rejoignez SnapSchool et <br />
              <span className="text-blue-400">modernisez votre école.</span>
            </h2>
            <p className="text-blue-100/80 text-sm sm:text-base leading-relaxed">
              Créez votre compte administrateur en quelques instants. Accédez à tous nos modules pendant 14 jours sans aucun engagement.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-blue-500/20 border border-blue-400/20 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-blue-300" />
                </div>
                <p className="text-blue-100 text-sm font-medium">{f.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Customer Quote */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl p-5">
            <p className="text-blue-50 text-sm leading-relaxed italic mb-3">
              &ldquo;La création de notre espace a pris moins de 5 minutes. Tout est pensé pour le fonctionnement de nos écoles.&rdquo;
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

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-blue-300/60 text-xs">© {new Date().getFullYear()} SnapSchool. Tous droits réservés.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-6 sm:p-12 lg:p-16 overflow-y-auto">
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
          className="w-full max-w-xl bg-white p-8 sm:p-12 rounded-3xl border border-gray-100 shadow-xl"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              Créer un compte
            </h1>
            <p className="text-base text-gray-500 font-normal">
              Démarrez votre essai gratuit de 14 jours pour votre établissement.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">Prénom</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Mohamed"
                    className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-base font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">Nom</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="surname"
                    required
                    placeholder="Ben Ali"
                    className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-base font-medium"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">Nom de l&apos;établissement</label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="schoolName"
                  required
                  placeholder="École Privée Al-Amal"
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-base font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">Adresse Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="directeur@ecole.tn"
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-base font-medium"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 mb-2 block uppercase tracking-wider">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="w-full bg-white border border-gray-200 rounded-2xl pl-12 pr-4 py-4 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-base font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 text-white font-semibold text-base rounded-2xl hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 shadow-lg shadow-blue-600/25 mt-3"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Créer mon espace
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
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
