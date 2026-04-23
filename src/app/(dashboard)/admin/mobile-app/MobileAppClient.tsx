"use client";

import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { 
  Smartphone, 
  Download, 
  Scan, 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  Copy, 
  Check 
} from "lucide-react";
import { useState } from "react";

interface MobileAppClientProps {
  deepLink: string;
  schoolId: string;
}

export default function MobileAppClient({ deepLink, schoolId }: MobileAppClientProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deepLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-5 gap-8"
    >
      {/* Left Column: Info & Instructions */}
      <div className="lg:col-span-3 flex flex-col justify-center space-y-8">
        <div>
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4"
          >
            <Smartphone size={14} />
            Mobile Sync
          </motion.div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-800 leading-tight">
            Take SnapSchool <br /> 
            <span className="text-indigo-600 underline decoration-indigo-200 underline-offset-8">Everywhere You go.</span>
          </h1>
          <p className="mt-6 text-slate-500 text-lg max-w-xl leading-relaxed">
            Scan the QR code to instantly sync your account and continue managing your school on the move.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
             <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
               <Scan size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Scan to Sync</h3>
               <p className="text-xs text-slate-500 mt-1">Open your camera and scan the QR code to open the app.</p>
             </div>
          </div>
          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
             <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
               <ShieldCheck size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Secure Access</h3>
               <p className="text-xs text-slate-500 mt-1">Your credentials are encrypted and stored safely on your device.</p>
             </div>
          </div>
          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
             <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
               <Zap size={20} />
             </div>
             <div>
               <h3 className="font-bold text-slate-800">Fast Login</h3>
               <p className="text-xs text-slate-500 mt-1">One-tap entry after the first scan. No more password typing.</p>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4">
           <button className="flex items-center gap-2 px-6 py-4 bg-slate-900 text-white rounded-3xl font-bold transition-all hover:bg-slate-800 active:scale-95 shadow-xl shadow-slate-900/10">
             <Download size={18} />
             Download APK
             <div className="w-px h-10 bg-white/20 mx-2" />
             <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest leading-none text-left">
                Available for <br /> Android
             </span>
           </button>
        </div>
      </div>

      {/* Right Column: QR Code Display */}
      <div className="lg:col-span-2 flex items-center justify-center">
        <div className="relative group">
          {/* Decorative background blur */}
          <div className="absolute -inset-4 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-[3rem] opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" />
          
          {/* Main Card */}
          <div className="relative p-8 rounded-[3rem] bg-white border border-white/50 backdrop-blur-xl shadow-2xl shadow-indigo-500/10 flex flex-col items-center">
            <div className="p-6 rounded-[2.5rem] bg-white border-4 border-indigo-50 shadow-inner">
               <QRCodeSVG 
                 value={deepLink} 
                 size={220}
                 level="H"
                 includeMargin={false}
                 fgColor="#4F46E5"
                 imageSettings={{
                    src: "/logo.png",
                    x: undefined,
                    y: undefined,
                    height: 40,
                    width: 40,
                    excavate: true,
                 }}
               />
            </div>
            
            <div className="mt-8 text-center space-y-4">
               <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">School ID</p>
                <div className="mt-2 py-2 px-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                  <code className="text-indigo-600 font-mono font-bold text-sm tracking-tight">{schoolId}</code>
                  <button 
                    onClick={copyToClipboard}
                    className="p-1.5 rounded-lg hover:bg-white hover:text-indigo-600 text-slate-400 transition-all active:scale-90"
                  >
                    {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  </button>
                </div>
               </div>

               <div className="flex items-center gap-2 text-slate-400">
                  <div className="h-px flex-1 bg-slate-100" />
                  <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Scan Camera</span>
                  <div className="h-px flex-1 bg-slate-100" />
               </div>
               
               <p className="text-[10px] text-slate-400 max-w-[200px] leading-relaxed">
                  Deep link: <br />
                  <span className="break-all opacity-50">{deepLink}</span>
               </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
