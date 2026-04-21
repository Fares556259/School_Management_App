"use client";

import { SignUp } from "@clerk/nextjs";
import { motion } from "framer-motion";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10"
      >
        <div className="flex flex-col items-center text-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white italic font-black text-2xl shadow-lg shadow-indigo-100 mb-6 font-primary">S</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Create Your School Account</h1>
            <p className="text-slate-500 font-medium text-sm mt-2">Start managing your school with SnapSchool today.</p>
        </div>

        <SignUp 
            forceRedirectUrl="/waiting-approval"
            signInUrl="/sign-in"
            appearance={{
                elements: {
                    rootBox: "mx-auto shadow-premium rounded-[3rem] overflow-hidden border border-slate-100",
                    card: "bg-white border-none shadow-none p-4",
                    formButtonPrimary: "bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-100",
                    formFieldInput: "bg-slate-50 border-slate-100 rounded-2xl py-4 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    footerActionLink: "text-indigo-600 font-bold hover:underline",
                    identityPreviewText: "font-bold text-slate-800",
                    formResendCodeLink: "text-indigo-600 font-bold",
                }
            }}
        />
      </motion.div>
    </div>
  );
}
