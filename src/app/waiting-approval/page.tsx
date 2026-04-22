"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, LogOut, Mail, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WaitingApprovalPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const router = useRouter();

  useEffect(() => {
    // 🚀 AUTO-REDIRECT IF ACTIVE
    if (isLoaded && isSignedIn && user) {
      const status = user.publicMetadata?.status as string | undefined;
      const role = user.publicMetadata?.role as string | undefined;
      
      if (status === "active" || role === "superadmin") {
        router.push("/admin");
      }
    }

    // 🔄 REFRESH USER DATA PERIODICALLY 
    // This catches the moment the superadmin approves the account
    const interval = setInterval(() => {
      if (isSignedIn && user) {
        user.reload().catch(e => console.error("Poll fail:", e));
      }
    }, 10000); // Check every 10s

    return () => clearInterval(interval);
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (isLoaded && isSignedIn && user && syncStatus === "idle") {
      setSyncStatus("syncing");
      
      const schoolName = (user.unsafeMetadata?.schoolName as string) 
                      || (user.publicMetadata?.schoolName as string) 
                      || `${user.firstName || "Unknown"}'s School`;
      
      const phoneNumber = (user.unsafeMetadata?.phoneNumber as string) || "N/A";
      const city = (user.unsafeMetadata?.city as string) || "Online";
                      
      fetch("/api/auth/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, phoneNumber, city }),
      })
      .then(async res => {
          if (res.ok) setSyncStatus("success");
          else setSyncStatus("error");
      })
      .catch((err) => {
          console.error("Sync backup failed", err);
          setSyncStatus("error");
      });
    }
  }, [isLoaded, isSignedIn, user, syncStatus]);

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[3rem] p-10 shadow-premium border border-slate-100 flex flex-col items-center text-center relative z-10"
      >
        {/* Animated Icon Container */}
        <div className="relative mb-8">
          <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center">
            {syncStatus === "syncing" ? (
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            ) : (
                <Clock className="w-12 h-12 text-indigo-600 animate-pulse" />
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-4">
          Approving Your School
        </h1>
        
        <p className="text-slate-500 font-medium leading-relaxed mb-8">
          Welcome to SnapSchool, <span className="font-bold text-slate-800">{user?.firstName || "Educator"}</span>! 
          Your account is currently being reviewed by our team.
        </p>

        <div className="w-full space-y-4 mb-8">
          <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl text-left border border-slate-100/50">
            <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
              {syncStatus === "syncing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {syncStatus === "syncing" ? "Status: Synchronizing" : "Next Step"}
              </span>
              <span className="text-sm font-bold text-slate-700">
                  {syncStatus === "error" 
                    ? "Connection check failed. Please refresh." 
                    : "We'll email you once activated."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
            <SignOutButton>
                <button className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </SignOutButton>
            
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mt-4">
              © 2025 SnapSchool Platform
            </p>
        </div>
      </motion.div>

      {/* Brand Logo */}
      <div className="mt-12 flex items-center gap-3 opacity-50 grayscale">
         <div className="w-8 h-8 bg-slate-400 rounded-xl flex items-center justify-center text-white italic font-black text-sm">S</div>
         <span className="text-lg font-black text-slate-800 tracking-tighter">SnapSchool</span>
      </div>
    </div>
  );
}
