"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "provisioning" | "done" | "pending">("checking");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const provision = async () => {
      try {
        setStatus("provisioning");
        const res = await fetch("/api/provision-on-signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        });

        const data = await res.json();

        if (data.status === "provisioned") {
          setStatus("done");
          // Force reload session claims then redirect
          await user.reload();
          router.push("/admin");
        } else if (data.status === "pending") {
          setStatus("pending");
        } else {
          setError(data.error || "Provisioning failed. Please contact support.");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred.");
      }
    };

    provision();
  }, [isLoaded, user, router]);

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50/30">
      <div className="max-w-md w-full mx-4 bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/60 p-12 border border-slate-100 text-center">
        {/* Logo */}
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-200">
          <span className="text-white font-black text-3xl italic">S</span>
        </div>

        {(status === "checking" || status === "provisioning") && (
          <>
            <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              Setting up your dashboard…
            </h1>
            <p className="text-slate-500 font-medium text-sm leading-relaxed">
              We&apos;re building your school&apos;s command center. This only takes a moment.
            </p>
          </>
        )}

        {status === "done" && (
          <>
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-emerald-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              Your dashboard is ready!
            </h1>
            <p className="text-slate-500 font-medium text-sm">Redirecting you now…</p>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              Pending Approval
            </h1>
            <p className="text-slate-500 font-medium text-sm leading-relaxed mb-6">
              Your account has been created, but your school isn&apos;t activated yet.
              Our team will review your request and enable your dashboard shortly.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs text-amber-700 font-medium">
              📧 You&apos;ll be notified at <strong>{user?.primaryEmailAddress?.emailAddress}</strong> once you&apos;re approved.
            </div>
          </>
        )}

        {error && (
          <>
            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-rose-500 font-medium text-sm mb-6">{error}</p>
            <p className="text-slate-400 text-xs">Please contact support or try again.</p>
          </>
        )}
      </div>
    </div>
  );
}
