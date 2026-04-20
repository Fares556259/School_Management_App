"use client";

import React from 'react';

export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8 opacity-50 animate-pulse">
      {/* Chart Skeleton */}
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-[480px]">
        <div className="h-4 w-48 bg-slate-100 rounded mb-4" />
        <div className="h-full w-full bg-slate-50 rounded" />
      </div>

      {/* Distribution Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-[400px]">
           <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
           <div className="h-full w-full bg-slate-50 rounded" />
        </div>
        <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-[400px]">
           <div className="h-4 w-32 bg-slate-100 rounded mb-4" />
           <div className="h-full w-full bg-slate-50 rounded" />
        </div>
      </div>

      {/* Insights Skeleton */}
      <div className="bg-white p-8 rounded-2xl border border-slate-100 shadow-sm h-[300px]">
         <div className="h-4 w-64 bg-slate-100 rounded mb-4" />
         <div className="h-full w-full bg-slate-50 rounded" />
      </div>
    </div>
  );
}
