"use client";

export default function Loading() {
  return (
    <div className="w-full h-[80vh] flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative">
        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
        </div>
      </div>
    </div>
  );
}
