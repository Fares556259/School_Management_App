"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function SignInPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "forgot" | "forgot_sent">("signin");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-slate-700 mb-1.5 block";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError) {
        setError("Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      const role = data.user?.user_metadata?.role as string | undefined;
      const status = data.user?.user_metadata?.status as string | undefined;

      if (role === "superadmin") {
        window.location.href = "/superadmin";
      } else if (role === "admin" && status === "active") {
        window.location.href = "/admin";
      } else {
        window.location.href = "/waiting-approval";
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue. Veuillez vérifier vos identifiants.");
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMode("forgot_sent");
    } catch (err: any) {
      setError(err.message || "Impossible d'envoyer l'email de réinitialisation. Vérifiez votre adresse.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F5F6F8] text-slate-900 font-sans relative overflow-hidden">
      {/* Subtle background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(59,130,246,0.08),transparent)] pointer-events-none" />

      {/* Top minimal header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
            <span className="text-white font-bold text-lg">S</span>
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">SnapSchool</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Retour à l&apos;accueil
        </Link>
      </header>

      {/* Main centered container */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-[420px] bg-white rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/50 p-7 sm:p-9"
        >
          {/* Card Header */}
          <div className="text-center mb-6">
            <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3.5 border border-blue-100">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {mode === "signin"
                ? "Espace de gestion"
                : mode === "forgot"
                ? "Mot de passe oublié"
                : "Vérifiez vos emails"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {mode === "signin"
                ? "Connectez-vous pour accéder à votre établissement"
                : mode === "forgot"
                ? "Entrez votre email pour recevoir le lien de réinitialisation"
                : "Un lien de réinitialisation vous a été envoyé"}
            </p>
          </div>

          {/* Form */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="directeur@ecole.tn"
                    className={`${inputClass} pl-10`}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className={`${inputClass} pl-10`}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Se connecter <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-4 text-center text-xs text-slate-500 border-t border-slate-100">
                Votre école n&apos;utilise pas encore SnapSchool ?{" "}
                <Link href="/sign-up" className="text-blue-600 font-semibold hover:underline">
                  Créer un compte
                </Link>
              </div>

              {/* Direct WhatsApp Assistance Pill */}
              <a
                href="https://wa.me/21623889444?text=Bonjour,%20j%27ai%20besoin%20d%27aide%20pour%20me%20connecter%20%C3%A0%20SnapSchool"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-between text-xs text-slate-600 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium text-slate-700">Support WhatsApp</span>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  +216 23 889 444
                </span>
              </a>
            </form>
          )}

          {/* Forgot Password Mode */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className={labelClass}>Votre Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    required
                    type="email"
                    placeholder="directeur@ecole.tn"
                    className={`${inputClass} pl-10`}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Envoyer le lien <ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="block w-full text-center text-xs text-slate-500 hover:text-slate-700 font-medium transition-colors pt-2 cursor-pointer"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          {/* Forgot Sent Mode */}
          {mode === "forgot_sent" && (
            <div className="text-center space-y-4 py-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Email envoyé !</h3>
                <p className="text-xs text-slate-500">
                  Un lien de réinitialisation a été envoyé à <span className="font-semibold text-slate-800">{forgotEmail}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="w-full py-2.5 bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
              >
                Retour à la connexion
              </button>
            </div>
          )}
        </motion.div>

        {/* Security / System Badges underneath the card */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> Chiffrement SSL 256-bit
          </span>
          <span className="text-slate-300">•</span>
          <span>Système Éducatif Tunisien</span>
          <span className="text-slate-300">•</span>
          <span>Accès Sécurisé Multi-Rôles</span>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-4 text-center text-[11px] text-slate-400">
        © {new Date().getFullYear()} SnapSchool. Tous droits réservés.
      </footer>
    </div>
  );
}
