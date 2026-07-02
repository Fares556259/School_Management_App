"use client";

import { useSignUp, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  School,
  User,
  Mail,
  Lock,
  MapPin,
  Phone,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Users,
  Bell,
  ShieldCheck,
} from "lucide-react";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { signOut } = useClerk();
  const router = useRouter();

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    schoolName: "",
    phoneNumber: "",
    city: "",
  });

  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 2) return { score, label: "Weak", color: "bg-rose-400" };
    if (score <= 3) return { score, label: "Fair", color: "bg-amber-400" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };
  const pwdStrength = getPasswordStrength(formData.password);

  useEffect(() => {
    if (isLoaded && signUp) {
      if (signUp.verifications.emailAddress.status === "verified") setVerifying(true);
      if (signUp.emailAddress && !formData.email)
        setFormData((prev) => ({ ...prev, email: signUp.emailAddress as string }));
    }
  }, [isLoaded, signUp, formData.email]);

  const handleReset = async () => {
    setLoading(true);
    await signOut();
    window.location.reload();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const canCreate =
        !signUp.status ||
        (signUp.status !== "missing_requirements" && signUp.status !== "complete");
      if (canCreate) {
        const defaultUsername = formData.email.split("@")[0] + "_" + Math.floor(Math.random() * 1000);
        await signUp.create({
          firstName: formData.firstName,
          lastName: formData.lastName,
          emailAddress: formData.email,
          username: defaultUsername,
          password: formData.password,
          unsafeMetadata: {
            schoolName: formData.schoolName,
            phoneNumber: formData.phoneNumber,
            city: formData.city,
          },
        });
      } else if (signUp.emailAddress !== formData.email && formData.email) {
        setError("A registration attempt is already in progress. Click 'Start Fresh' below.");
        setLoading(false);
        return;
      }
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || "";
      if (msg.toLowerCase().includes("already verified") || msg.toLowerCase().includes("exists")) {
        setError("Your browser session is stuck. Click 'Start Fresh' below to fix this.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!isLoaded || !signUp) return;
    setLoading(true);
    setError("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setLoading(true);
    setError("");
    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code });
      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push("/waiting-approval");
      } else {
        const missing = completeSignUp.missingFields?.join(", ") || "unknown requirements";
        setError(`Registration incomplete. Missing: ${missing}`);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid code. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full bg-white border border-slate-200 rounded-xl px-4 py-3.5 text-slate-800 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all text-sm font-medium";
  const labelClass = "text-xs font-semibold text-slate-500 mb-1.5 block";

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
              Run your school<br />
              <span className="text-indigo-400">smarter, not harder.</span>
            </h2>
            <p className="text-slate-400 text-base leading-relaxed">
              The all-in-one management platform trusted by private schools.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * i + 0.3 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-indigo-400" />
                </div>
                <p className="text-slate-300 text-sm font-medium">{f.text}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
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
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <p className="text-slate-600 text-xs">© 2025 SnapSchool. All rights reserved.</p>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-6 overflow-y-auto">
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
              {verifying ? "Check your inbox" : "Create your account"}
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              {verifying
                ? `We sent a 6-digit code to ${formData.email}`
                : "Start managing your school with SnapSchool."}
            </p>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`h-1 flex-1 rounded-full transition-all ${!verifying ? "bg-indigo-600" : "bg-emerald-500"}`} />
            <div className={`h-1 flex-1 rounded-full transition-all ${verifying ? "bg-indigo-600" : "bg-slate-200"}`} />
          </div>

          <AnimatePresence mode="wait">
            {!verifying ? (
              <motion.form
                key="details"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input required type="text" placeholder="John" className={`${inputClass} pl-10`}
                        value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input required type="text" placeholder="Doe" className={`${inputClass} pl-10`}
                        value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>School Name</label>
                    <div className="relative">
                      <School className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input required type="text" placeholder="Oxford Academy" className={`${inputClass} pl-10`}
                        value={formData.schoolName} onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input required type="text" placeholder="London" className={`${inputClass} pl-10`}
                        value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input required type="email" placeholder="john@school.com" className={`${inputClass} pl-10`}
                      value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input required type="tel" placeholder="+1 234 567 890" className={`${inputClass} pl-10`}
                      value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input required type="password" placeholder="Min. 8 characters" className={`${inputClass} pl-10`}
                      value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} />
                  </div>
                  {formData.password && (
                    <div className="mt-2.5">
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= pwdStrength.score ? pwdStrength.color : "bg-slate-200"}`} />
                        ))}
                      </div>
                      <p className={`text-xs font-semibold ${pwdStrength.label === "Weak" ? "text-rose-500" : pwdStrength.label === "Fair" ? "text-amber-500" : "text-emerald-600"}`}>
                        {pwdStrength.label} password
                      </p>
                    </div>
                  )}
                </div>

                <button
                  disabled={loading}
                  type="submit"
                  className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 group disabled:opacity-60 shadow-lg shadow-indigo-200"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continue <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" /></>}
                </button>

                <p className="text-center text-sm text-slate-500">
                  Already have an account?{" "}
                  <a href="/sign-in" className="text-indigo-600 font-semibold hover:underline">Sign In</a>
                </p>

                <button type="button" onClick={handleReset} disabled={loading}
                  className="block w-full text-center text-xs text-slate-300 hover:text-slate-500 transition-colors font-medium">
                  {loading ? "Resetting…" : "Stuck? Start fresh registration"}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="verify"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleVerify}
                className="space-y-6"
              >
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 text-center">
                  <Mail className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600 font-medium">Enter the 6-digit code we sent to</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">{formData.email}</p>
                </div>

                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-start gap-2.5 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    {error}
                  </div>
                )}

                <div>
                  <label className={labelClass}>Verification Code</label>
                  <input
                    required maxLength={6} type="text" placeholder="000000"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-5 text-center text-3xl font-black tracking-[0.5em] text-indigo-600 placeholder:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                    value={code} onChange={(e) => setCode(e.target.value)}
                  />
                </div>

                <button
                  disabled={loading} type="submit"
                  className="w-full py-3.5 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-indigo-200"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Verify & Activate Account</>}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button type="button" onClick={() => setVerifying(false)} className="text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    ← Back
                  </button>
                  <button type="button" onClick={handleResend} className="text-indigo-600 font-semibold hover:underline">
                    Resend code
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
