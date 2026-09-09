"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Users,
  Bell,
  ShieldCheck,
  Building2,
  MessageSquare,
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
    "w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-gray-600 mb-1.5 block";

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

  const features = [
    { icon: BarChart3, text: "Gestion financière & suivi des frais de scolarité" },
    { icon: Users, text: "Gestion des élèves, enseignants & bulletins" },
    { icon: Bell, text: "Notifications instantanées aux parents" },
    { icon: ShieldCheck, text: "Données chiffrées & conformes aux normes" },
  ];

  return (
    <div className="min-h-screen flex bg-white text-gray-900 font-sans">
      {/* ── LEFT PANEL (Our Original Branding) ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden text-white">
        {/* Subtle glow */}
        <div className="absolute top-[-80px] right-[-80px] w-[350px] h-[350px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-60px] left-[-60px] w-[250px] h-[250px] bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <a href="/" className="inline-flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/30">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SnapSchool</span>
          </a>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-7 my-auto py-8">
          <div>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-4">
              <Building2 className="w-3.5 h-3.5" /> Espace de gestion
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight tracking-tight mb-3">
              Bienvenue sur votre <br />
              <span className="text-blue-400">tableau de bord.</span>
            </h2>
            <p className="text-blue-100/80 text-sm leading-relaxed">
              Toutes les fonctionnalités pour gérer votre établissement privé en un seul endroit.
            </p>
          </div>

          <div className="space-y-3.5">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/20 border border-blue-400/20 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-blue-300" />
                </div>
                <p className="text-blue-100 text-sm font-medium">{f.text}</p>
              </div>
            ))}
          </div>

          {/* Quick Direct Support Card */}
          <div className="bg-white/10 border border-white/15 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <p className="text-white text-xs font-bold">Besoin d&apos;assistance immédiate ?</p>
                <p className="text-blue-200 text-[11px]">Support technique WhatsApp direct</p>
              </div>
            </div>
            <a
              href="https://wa.me/21623889444?text=Bonjour,%20j%27ai%20besoin%20d%27aide%20pour%20me%20connecter%20%C3%A0%20SnapSchool"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Contacter
            </a>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-blue-300/60 text-xs">© {new Date().getFullYear()} SnapSchool. Conçu pour les écoles privées.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL (Auth Form) ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50/50 p-6 sm:p-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-gray-900 text-lg tracking-tight">SnapSchool</span>
          </a>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white p-8 sm:p-10 rounded-2xl border border-gray-100 shadow-xl"
        >
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1.5">
              {mode === "signin"
                ? "Connexion à votre compte"
                : mode === "forgot"
                ? "Réinitialiser le mot de passe"
                : "Vérifiez vos emails"}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              {mode === "signin"
                ? "Entrez vos identifiants pour accéder à votre espace."
                : mode === "forgot"
                ? "Saisissez votre email pour recevoir un lien de réinitialisation."
                : "Un lien de réinitialisation vous a été envoyé par email."}
            </p>
          </div>

          {/* Sign In Mode */}
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2.5 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className={labelClass}>Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                  <label className="text-xs font-semibold text-gray-600 block">Mot de passe</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                className="w-full py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    Se connecter <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>

              <div className="pt-3 text-center text-xs text-gray-500 border-t border-gray-100">
                Votre école n&apos;utilise pas encore SnapSchool ?{" "}
                <a href="/sign-up" className="text-blue-600 font-semibold hover:underline">
                  Créer un compte
                </a>
              </div>
            </form>
          )}

          {/* Forgot Mode */}
          {mode === "forgot" && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2 text-xs font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className={labelClass}>Votre Adresse Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
                className="w-full py-3 bg-blue-600 text-white font-semibold text-sm rounded-xl hover:bg-blue-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-md shadow-blue-600/20 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Envoyer le lien <ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="block w-full text-center text-xs text-gray-500 hover:text-gray-700 font-medium transition-colors pt-2 cursor-pointer"
              >
                ← Retour à la connexion
              </button>
            </form>
          )}

          {/* Sent Mode */}
          {mode === "forgot_sent" && (
            <div className="text-center space-y-4 py-3">
              <div className="w-12 h-12 bg-green-50 border border-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-1">Email envoyé !</h3>
                <p className="text-xs text-gray-500">
                  Un lien de réinitialisation a été envoyé à <span className="font-semibold text-gray-800">{forgotEmail}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="w-full py-2.5 bg-gray-100 text-gray-700 font-semibold text-xs rounded-xl hover:bg-gray-200 transition-all cursor-pointer"
              >
                Retour à la connexion
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
