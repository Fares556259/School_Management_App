"use client";

import { useSignIn } from "@clerk/nextjs";
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
} from "lucide-react";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "forgot" | "forgot_sent">("signin");
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [forgotEmail, setForgotEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputClass =
    "w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm";
  const labelClass =
    "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1 block";

  // ── Sign In ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      const result = await signIn.create({
        identifier: formData.email,
        password: formData.password,
      });

      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/admin");
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password ────────────────────────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");

    try {
      await signIn.create({
        strategy: "reset_password_email_code",
        identifier: forgotEmail,
      });
      setMode("forgot_sent");
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background dot pattern */}
      <div
        className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(#6366f1 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full relative z-10"
      >
        {/* Logo + Heading */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white italic font-black text-xl shadow-lg shadow-indigo-100 mb-4">
            S
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            {mode === "signin" ? "Welcome back" : "Reset your password"}
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            {mode === "signin"
              ? "Sign in to your SnapSchool dashboard."
              : mode === "forgot"
              ? "We'll send you a reset link to your email."
              : "Check your inbox for a reset link."}
          </p>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-premium border border-slate-100 relative overflow-hidden">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-10">
            <div className="h-1.5 flex-1 rounded-full bg-indigo-600" />
            <div className={`h-1.5 flex-1 rounded-full ${mode !== "signin" ? "bg-indigo-600" : "bg-slate-100"}`} />
          </div>

          {/* ── Sign In Form ── */}
          {mode === "signin" && (
            <motion.form
              key="signin"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleSignIn}
              className="space-y-6"
            >
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="john@school.com"
                    className={`${inputClass} pl-12`}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required
                    type="password"
                    placeholder="••••••••"
                    className={`${inputClass} pl-12`}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div className="text-right mt-2">
                  <button
                    type="button"
                    onClick={() => { setMode("forgot"); setError(""); }}
                    className="text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 group disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {/* ── Forgot Password Form ── */}
          {mode === "forgot" && (
            <motion.form
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleForgotPassword}
              className="space-y-6"
            >
              {error && (
                <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div>
                <label className={labelClass}>Your Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input
                    required
                    type="email"
                    placeholder="john@school.com"
                    className={`${inputClass} pl-12`}
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                </div>
              </div>

              <button
                disabled={loading}
                type="submit"
                className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 disabled:opacity-70"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {/* ── Forgot Sent Confirmation ── */}
          {mode === "forgot_sent" && (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Email sent!</h2>
              <p className="text-sm text-slate-500 font-medium">
                We sent a password reset link to{" "}
                <span className="font-bold text-slate-800">{forgotEmail}</span>.
                Check your inbox.
              </p>
            </motion.div>
          )}

          {/* Footer links */}
          <p className="text-center text-xs text-slate-400 font-medium mt-8 flex flex-col gap-3">
            {mode === "signin" ? (
              <span>
                Don&apos;t have an account?{" "}
                <a href="/sign-up" className="text-indigo-600 font-bold hover:underline">
                  Create one
                </a>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => { setMode("signin"); setError(""); }}
                className="text-indigo-600 font-bold hover:underline"
              >
                ← Back to Sign In
              </button>
            )}
          </p>
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex items-center justify-center gap-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            Secure Authentication
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            256-bit Encrypted
          </span>
        </div>
      </motion.div>
    </div>
  );
}
