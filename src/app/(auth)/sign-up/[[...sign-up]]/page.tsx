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
  AlertCircle 
} from "lucide-react";

export default function SignUpPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { signOut } = useClerk();
  const router = useRouter();

  // Form State
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

  // 0. SESSION DETECTION
  // If the user returns to the page and is already verified, skip to step 2
  useEffect(() => {
    if (isLoaded && signUp) {
      if (signUp.verifications.emailAddress.status === "verified") {
        setVerifying(true);
      }
      
      // If we have an email already in the sign-up attempt, populate it
      if (signUp.emailAddress && !formData.email) {
        setFormData(prev => ({ ...prev, email: signUp.emailAddress as string }));
      }
    }
  }, [isLoaded, signUp]);

  // 1. Reset Session
  const handleReset = async () => {
    setLoading(true);
    await signOut();
    window.location.reload();
  };

  // 1.1 Initial Sign Up
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      // If we already have a signUp object in progress, check if we can even call create
      const canCreate = !signUp.status || (signUp.status !== "missing_requirements" && signUp.status !== "complete");

      if (canCreate) {
        // Generate a default username if required by Clerk
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
          }
        });
      } else if (signUp.emailAddress !== formData.email && formData.email) {
        setError("A registration attempt is already in progress. Please use the code sent previously or click 'Start Fresh' below.");
        setLoading(false);
        return;
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err: any) {
      const msg = err.errors?.[0]?.message || "";
      if (msg.toLowerCase().includes("already verified") || msg.toLowerCase().includes("already_verified") || msg.toLowerCase().includes("exists")) {
        setError("Your browser session is stuck. Please click 'Start Fresh' below to fix this.");
      } else {
        setError(msg || "Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // 1.5 Resend Code
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

  // 2. Email Verification
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;

    setLoading(true);
    setError("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });
        router.push("/waiting-approval");
      } else {
        // If still not complete, it's missing something else
        const missing = completeSignUp.missingFields?.join(", ") || "unknown requirements";
        setError(`Registration incomplete. Missing: ${missing}`);
        console.error("Incomplete Sign Up:", completeSignUp);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || "Invalid code. Please check your email.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm";
  const labelClass = "text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1 block";

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-8">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white italic font-black text-xl shadow-lg shadow-indigo-100 mb-4">S</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Your School Account</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Start managing your school with SnapSchool today.</p>
        </div>

        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-premium border border-slate-100 relative overflow-hidden">
           {/* Progress Indicator */}
           <div className="flex items-center gap-2 mb-10">
              <div className={`h-1.5 flex-1 rounded-full ${!verifying ? "bg-indigo-600" : "bg-emerald-500"}`} />
              <div className={`h-1.5 flex-1 rounded-full ${verifying ? "bg-indigo-600" : "bg-slate-100"}`} />
           </div>

           <AnimatePresence mode="wait">
            {!verifying ? (
              <motion.form 
                key="details"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleSubmit} 
                className="space-y-6"
              >
                {/* Error Banner */}
                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-xs font-bold animate-shake">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>First Name</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        placeholder="E.g. John"
                        className={`${inputClass} pl-12`}
                        value={formData.firstName}
                        onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Last Name</label>
                    <div className="relative">
                      <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        placeholder="E.g. Doe"
                        className={`${inputClass} pl-12`}
                        value={formData.lastName}
                        onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>School Name</label>
                    <div className="relative">
                      <School className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        placeholder="E.g. Oxford Academy"
                        className={`${inputClass} pl-12`}
                        value={formData.schoolName}
                        onChange={(e) => setFormData({...formData, schoolName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <div className="relative">
                      <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="text" 
                        placeholder="E.g. London"
                        className={`${inputClass} pl-12`}
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        required
                        type="tel" 
                        placeholder="+1 234 567 890"
                        className={`${inputClass} pl-12`}
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({...formData, phoneNumber: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Create Password</label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••"
                      className={`${inputClass} pl-12`}
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                    />
                  </div>
                </div>

                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3 group"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Continue Registration
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </motion.form>
            ) : (
              <motion.form 
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleVerify} 
                className="space-y-8"
              >
                <div className="text-center">
                   <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Mail className="w-8 h-8" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Verify Your Email</h2>
                   <p className="text-slate-500 font-medium text-sm">We&apos;ve sent a 6-digit code to <span className="text-slate-900 font-bold">{formData.email}</span></p>
                </div>

                {error && (
                  <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl flex items-center gap-3 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                   <label className={labelClass}>Verification Code</label>
                   <input 
                     required
                     maxLength={6}
                     type="text" 
                     placeholder="000000"
                     className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-8 text-center text-4xl font-black tracking-[0.5em] text-indigo-600 placeholder:text-slate-200 focus:ring-0 focus:border-indigo-500 transition-all"
                     value={code}
                     onChange={(e) => setCode(e.target.value)}
                   />
                </div>

                <button 
                  disabled={loading}
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white font-black rounded-3xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-100 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Verify & Activate Account
                      <CheckCircle2 className="w-5 h-5" />
                    </>
                  )}
                </button>

                <p className="text-center text-xs text-slate-400 font-medium">
                  Didn&apos;t receive the code? <button type="button" onClick={handleResend} className="text-indigo-600 font-bold hover:underline">Resend</button>
                </p>
              </motion.form>
            )}
           </AnimatePresence>
            <p className="text-center text-xs text-slate-400 font-medium mt-8 flex flex-col gap-3">
              <span>Already have an account? <a href="/sign-in" className="text-indigo-600 font-bold hover:underline">Sign In</a></span>
              <button 
                type="button" 
                onClick={handleReset}
                className="text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-indigo-600 transition-colors"
                disabled={loading}
              >
                {loading ? "Resetting..." : "Stuck? Start Fresh Registration"}
              </button>
            </p>
         </div>

        <div className="mt-8 flex flex-col items-center gap-4">
           {!verifying ? (
              <div className="flex items-center gap-8 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 <span className="flex items-center gap-2 transition-colors hover:text-slate-600 cursor-default">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Secure Authentication
                 </span>
                 <span className="flex items-center gap-2 transition-colors hover:text-slate-600 cursor-default">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Automated Setup
                 </span>
              </div>
           ) : (
             <button 
                onClick={() => setVerifying(false)}
                className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
             >
                Go back to details
             </button>
           )}
        </div>
      </motion.div>
    </div>
  );
}
