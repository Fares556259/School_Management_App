"use client";

export default function Loading() {
  return (
    <div className="fixed inset-0 w-full h-full flex flex-col items-center justify-center bg-white/80 backdrop-blur-md z-[9999]">
      <div className="flex flex-col items-center">
        {/* Brand Icon with glowing ring */}
        <div className="relative">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/30 animate-pulse">
            <span className="text-white font-bold text-2xl">S</span>
          </div>
          <div className="absolute -inset-2 border-2 border-blue-600/20 border-t-blue-600 rounded-3xl animate-spin" />
        </div>
        
        {/* Brand Name */}
        <div className="mt-5 flex items-center gap-1.5">
          <span className="font-bold text-gray-900 text-base tracking-tight">SnapSchool</span>
        </div>

        {/* Animated Dots */}
        <div className="mt-3 flex items-center space-x-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}
