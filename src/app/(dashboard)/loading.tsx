"use client";

import Image from "next/image";

export default function Loading() {
  return (
    <div className="w-full h-[calc(100vh-64px)] flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm">
      <div className="relative">
        {/* Outer Ring Animation */}
        <div className="absolute inset-0 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
        
        {/* Inner Logo/Icon */}
        <div className="relative w-24 h-24 bg-white rounded-full flex items-center justify-center p-5 shadow-xl shadow-indigo-100/50">
          <Image src="/logo.png" alt="Loading" width={48} height={48} className="animate-pulse" />
        </div>
      </div>
      
      {/* Animated Text */}
      <div className="mt-8 flex flex-col items-center">
        <h2 className="text-xl font-black text-slate-800 tracking-tight animate-fade-in">
            جاري التحميل...
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 overflow-hidden w-0 animate-writing-ellipsis">
          Please wait
        </p>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes writing-ellipsis {
          0% { width: 0; }
          50% { width: 80px; }
          100% { width: 0; }
        }
        .animate-fade-in {
          animation: fade-in 0.6s ease-out forwards;
        }
        .animate-writing-ellipsis {
          animation: writing-ellipsis 2s steps(4) infinite;
        }
      `}</style>
    </div>
  );
}
