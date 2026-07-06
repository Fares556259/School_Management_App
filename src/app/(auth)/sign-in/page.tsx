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
    "w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

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
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }

      // Read role from the signed-in user's metadata
      const role = data.user?.user_metadata?.role as string | undefined;
      const status = data.user?.user_metadata?.status as string | undefined;

      // Route based on role — session is already committed in the browser
      // router.refresh() syncs the server-side session cookie before navigating
      if (role === "superadmin") {
        router.refresh();
        router.push("/superadmin");
      } else if (role === "admin" && status === "active") {
        router.refresh();
        router.push("/admin");
      } else {
        router.refresh();
        router.push("/waiting-approval");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
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
      setError(err.message || "Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: BarChart3, text: "Real-time financial tracking & AI forecasting" },
    { icon: Users, text: "Manage students, teachers & parents in one place" },
    { icon: Bell, text: "Instant push notifications to parents" },
    { icon: ShieldCheck, text: "Full audit trail — every action logged" },
  ];

  return (
    <div className="min-h-screen flex">
      {/* ── LEFT PANEL ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Glow orbs */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[300px] h-[300px] bg-violet-600/20 rounded-full blur-[100px] pointer-events-none" />
        {/* Dot grid */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "28px 28px" }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-lg">S</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SnapSchool</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-black text-white leading-tight tracking-tight mb-4">
              Welcome back to<br />
              <span className="text-indigo-400">your dashboard.</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              Everything you need to run your school, all in one place.
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
                <div className="w-8 h-8 bg-indigo-500/20 border border-indigo-500/30 rounded-lg flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-indigo-400" />
                </div>
                <p className="text-slate-300 text-sm font-medium">{f.text}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 bg-white/5 border border-white/10 rounded-2xl p-5">
          <p className="text-slate-300 text-sm leading-relaxed italic mb-4">
            &ldquo;SnapSchool transformed how we manage our 400-student school. What took hours now takes minutes.&rdquo;
          </p>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-400 flex items-center justify-center text-white font-bold text-xs">A</div>
            <div>
              <p className="text-white text-xs font-bold">Ahmed Ben Ali</p>
              <p className="text-slate-500 text-xs">Director, Académie El Amal</p>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 SnapSchool. All rights reserved.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-black">S</span>
          </div>
          <span className="font-bold text-slate-800 text-lg">SnapSchool</span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {mode === "signin" ? "Sign in to SnapSchool" : mode === "forgot" ? "Reset your password" : "Check your inbox"}
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {mode === "signin"
                ? "Enter your credentials to access your dashboard."
                : mode === "forgot"
                ? "We'll send you a reset link right away."
                : "A password reset link has been sent."}
            </p>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8">
            <div className="h-1 flex-1 rounded-full bg-indigo-600" />
            <div className={`h-1 flex-1 rounded-full transition-all ${mode !== "signin" ? "bg-indigo-600" : "bg-slate-200"}`} />
          </div>

          {/* ── Sign In ── */}
          {mode === "signin" && (
            <motion.form key="signin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSignIn} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="john@school.com"
                    className={`${inputClass} pl-10`}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`${labelClass} mb-0`}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); }}
                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
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
                className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 shadow-lg shadow-indigo-200"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Sign In <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>

              <p className="text-center text-sm text-slate-500">
                Don&apos;t have an account?{" "}
                <a href="/sign-up" className="text-indigo-600 font-semibold hover:underline">Create one</a>
              </p>
            </motion.form>
          )}

          {/* ── Forgot Password ── */}
          {mode === "forgot" && (
            <motion.form key="forgot" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} onSubmit={handleForgotPassword} className="space-y-5">
              {error && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <div>
                <label className={labelClass}>Your Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="john@school.com"
                    className={`${inputClass} pl-10`}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-indigo-200"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Send Reset Link <ArrowRight className="w-4 h-4" /></>}
              </button>

              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="block w-full text-center text-sm text-slate-400 hover:text-slate-600 font-medium transition-colors"
              >
                ← Back to Sign In
              </button>
            </motion.form>
          )}

          {/* ── Sent Confirmation ── */}
          {mode === "forgot_sent" && (
            <motion.div key="sent" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
              <div className="w-16 h-16 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 mb-1">Email sent!</h2>
                <p className="text-sm text-slate-500 font-medium">
                  We sent a reset link to <span className="font-bold text-slate-700">{forgotEmail}</span>. Check your inbox.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold text-sm rounded-xl hover:bg-slate-200 transition-all"
              >
                Back to Sign In
              </button>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
