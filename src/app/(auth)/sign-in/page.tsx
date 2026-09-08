"use client";

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
  Building2,
  Headphones,
  Check,
  ArrowLeft,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function SignInPage() {
  const [mode, setMode] = useState<"signin" | "forgot" | "forgot_sent">("signin");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError(err.message || "Une erreur est survenue lors de la connexion.");
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
      setError(err.message || "Impossible d'envoyer l'email de réinitialisation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50 text-slate-900 font-sans selection:bg-blue-600 selection:text-white">
      {/* ── LEFT PANEL (Branding & Trust) ──────────────────────────────────── */}
      <div className="lg:w-[45%] xl:w-[40%] bg-slate-950 text-white p-8 sm:p-12 lg:p-16 flex flex-col justify-between relative border-b lg:border-b-0 lg:border-r border-slate-800">
        {/* Brand Header */}
        <div>
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-600/30 group-hover:scale-105 transition-transform">
              S
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white">SnapSchool</span>
              <span className="text-[10px] block font-semibold text-blue-400 uppercase tracking-wider -mt-1">
                Espace Direction
              </span>
            </div>
          </Link>
        </div>

        {/* Core Value Context */}
        <div className="my-10 lg:my-0 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Building2 className="w-3.5 h-3.5" /> Accès Sécurisé Établissement
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-snug">
            Le portail de gestion de votre école privée.
          </h1>

          <p className="text-slate-400 text-sm leading-relaxed max-w-md">
            Connectez-vous pour piloter vos notes trimestrielles, imprimer les bulletins officiels,
            suivre les règlements en Dinars et gérer votre établissement sans friction.
          </p>

          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Conforme aux normes du Ministère de l&apos;Éducation</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Chiffrement des données scolaires et sauvegardes quotidiennes</span>
            </div>
            <div className="flex items-center gap-3 text-xs font-medium text-slate-300">
              <div className="w-6 h-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <span>Support WhatsApp direct pour les directeurs & secrétariat</span>
            </div>
          </div>
        </div>

        {/* Direct Contact / Assistance for schools */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Headphones className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <p className="text-white font-semibold">Un problème d&apos;accès ?</p>
              <p className="text-[11px] text-slate-400">Assistance rapide par WhatsApp</p>
            </div>
          </div>
          <a
            href="https://wa.me/21623889444?text=Bonjour,%20j%27ai%20besoin%20d%27aide%20pour%20acc%C3%A9der%20%C3%A0%20mon%20compte%20SnapSchool"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors"
          >
            Contacter
          </a>
        </div>
      </div>

      {/* ── RIGHT PANEL (Auth Form) ────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md">
          {/* Back link */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-8"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Retour à l&apos;accueil
          </Link>

          <div className="bg-white p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100">
            {/* Title / Description */}
            <div className="mb-8">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-2">
                {mode === "signin"
                  ? "Connexion Établissement"
                  : mode === "forgot"
                  ? "Récupérer mon mot de passe"
                  : "Email envoyé"}
              </h2>
              <p className="text-sm text-slate-500">
                {mode === "signin"
                  ? "Entrez les identifiants de votre école pour continuer."
                  : mode === "forgot"
                  ? "Nous vous enverrons un lien sécurisé pour créer un nouveau mot de passe."
                  : "Consultez votre boîte de réception pour réinitialiser vos accès."}
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl flex items-start gap-3 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Mode 1: Sign In Form ── */}
            {mode === "signin" && (
              <form onSubmit={handleSignIn} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Adresse Email
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="directeur@ecole.tn"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Mot de passe
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                      }}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Se connecter <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-4 text-center border-t border-slate-100">
                  <p className="text-xs text-slate-500">
                    Votre établissement n&apos;utilise pas encore SnapSchool ?{" "}
                    <a
                      href="https://wa.me/21623889444?text=Bonjour,%20je%20souhaite%20activer%20SnapSchool%20pour%20notre%20%C3%A9cole"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Demander une activation
                    </a>
                  </p>
                </div>
              </form>
            )}

            {/* ── Mode 2: Forgot Password Form ── */}
            {mode === "forgot" && (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                    Email de l&apos;école
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="directeur@ecole.tn"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 rounded-xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Envoyer le lien de réinitialisation <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signin");
                      setError("");
                    }}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    ← Retour à la connexion
                  </button>
                </div>
              </form>
            )}

            {/* ── Mode 3: Forgot Email Sent Confirmation ── */}
            {mode === "forgot_sent" && (
              <div className="text-center space-y-5 py-4">
                <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Email envoyé</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Un lien sécurisé a été transmis à{" "}
                    <span className="font-semibold text-slate-900">{forgotEmail}</span>.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMode("signin");
                    setError("");
                  }}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                >
                  Revenir à la connexion
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
