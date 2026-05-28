"use client";

import Image from "next/image";

export default function Loading() {
  return (
    <div className="w-full h-full min-h-[50vh] flex flex-col items-center justify-center bg-white/60 backdrop-blur-md z-[9999]">
      <div className="relative">
        {/* Outer Ring Animation */}
        <div className="absolute inset-0 border-4 border-slate-100 border-t-lamaPurple rounded-full animate-spin" />
        
        {/* Inner Logo/Icon */}
        <div className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-lamaPurple/20">
          <Image src="/logo.png" alt="Loading" width={40} height={40} className="animate-pulse" />
        </div>
      </div>
      
      {/* Animated Text */}
      <div className="mt-6 flex flex-col items-center">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 rounded-full bg-lamaPurple animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-lamaPurple animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-2 h-2 rounded-full bg-lamaPurple animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
      </div>
    </div>
  );
}
