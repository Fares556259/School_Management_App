import React from "react";

export default function ProfileLoading() {
  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        <div className="w-32 h-32 rounded-full bg-slate-200 animate-pulse shrink-0 border-4 border-white shadow-sm" />
        <div className="flex flex-col justify-center gap-3 w-full max-w-md">
          <div className="h-8 bg-slate-200 animate-pulse rounded-md w-3/4" />
          <div className="h-4 bg-slate-100 animate-pulse rounded-md w-1/2" />
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
        <div className="h-64 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
      </div>
    </div>
  );
}
