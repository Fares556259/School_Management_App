"use client";

import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, AlertCircle, Zap, RefreshCcw, CheckCircle2 } from 'lucide-react';

export interface SmartInsightsProps {
  payload: {
    totalBalance: number;
    thisMonthIncome: number;
    thisMonthExpense: number;
    unpaidAmount: number;
    unpaidCount: number;
  };
}

type Insight = {
  text: string;
  severity: "red" | "orange" | "green";
};

const ArrowRight = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className || ""}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const SmartInsights = ({ payload }: SmartInsightsProps) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchInsights = async () => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/smart-insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
           throw new Error(`API Error: ${res.status}`);
        }
        
        const data = await res.json();
        if (isMounted) {
          if (data.insights && Array.isArray(data.insights)) {
            setInsights(data.insights);
          } else {
            throw new Error("Invalid response format from API");
          }
        }
      } catch (error: any) {
        console.error("Failed to fetch insights", error);
        if (isMounted) {
          setErrorMsg(error.message || "Failed to load insights");
          setInsights([{ text: "Error fetching data. Check your API key or network.", severity: "orange" }]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchInsights();
    
    return () => { isMounted = false; };
  }, [
    payload.totalBalance, 
    payload.thisMonthIncome, 
    payload.thisMonthExpense, 
    payload.unpaidCount
  ]);

  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full group">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300 relative">
            <Sparkles size={20} />
            {!loading && !errorMsg && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full"></div>}
            {errorMsg && <div className="absolute -top-1 -right-1 w-3 h-3 bg-rose-400 border-2 border-white rounded-full"></div>}
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Smart Insights</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
           <div className={`w-1.5 h-1.5 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : errorMsg ? 'bg-rose-500' : 'bg-emerald-500'}`} />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
             {loading ? 'Analyzing' : errorMsg ? 'Error' : 'Live AI'}
           </span>
        </div>
      </div>

      {/* 2. INSIGHT LIST */}
      <div className="flex-1 space-y-4">
        {loading ? (
          // Loading Skeletons
          [1, 2, 3].map((i) => (
            <div key={i} className="flex gap-4 items-start p-4 bg-slate-50/50 rounded-2xl animate-pulse">
              <div className="w-8 h-8 rounded-lg bg-slate-200 shrink-0" />
              <div className="flex flex-col gap-2 w-full mt-1">
                <div className="h-3 bg-slate-200 rounded w-full" />
                <div className="h-3 bg-slate-200 rounded w-2/3" />
              </div>
            </div>
          ))
        ) : (
          insights.map((insight, idx) => {
            const isRed = insight.severity === "red";
            const isOrange = insight.severity === "orange";
            const isGreen = insight.severity === "green";

            return (
              <div 
                key={idx} 
                className="flex gap-4 items-start p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 transition-all duration-300 group/item hover:shadow-sm animate-in slide-in-from-right-4 fade-in"
                style={{ animationDelay: `${idx * 150}ms` }}
              >
                <div className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${
                  isRed ? 'bg-rose-50 text-rose-500 shadow-inner' : 
                  isOrange ? 'bg-amber-50 text-amber-500 shadow-inner' : 
                  'bg-emerald-50 text-emerald-500 shadow-inner'
                }`}>
                  {isRed ? <AlertCircle size={16} /> : 
                   isOrange ? <Zap size={16} /> : 
                   <CheckCircle2 size={16} />}
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-600 leading-relaxed">
                    {insight.text}
                  </p>
                  <button className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity ${
                    isRed ? 'text-rose-500 hover:text-rose-600' : 
                    isOrange ? 'text-amber-500 hover:text-amber-600' : 
                    'text-emerald-500 hover:text-emerald-600'
                  }`}>
                    Review metrics <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 3. FOOTER STATUS */}
      <div className="mt-8 pt-4 border-t border-slate-50">
        <div className={`flex items-center justify-between p-3 rounded-xl border border-dashed transition-colors ${loading ? 'bg-slate-50 border-slate-200' : errorMsg ? 'bg-rose-50/50 border-rose-100' : 'bg-indigo-50/50 border-indigo-100'}`}>
           <div className="flex items-center gap-2">
              <RefreshCcw size={12} className={loading ? "text-slate-400 animate-spin" : errorMsg ? "text-rose-400" : "text-indigo-400"} />
              <p className={`text-[10px] font-bold uppercase tracking-widest text-center ${loading ? 'text-slate-400' : errorMsg ? 'text-rose-400' : 'text-indigo-400'}`}>
                 {loading ? "AI Analysis in progress..." : errorMsg ? "Analysis Failed" : "Analysis complete"}
              </p>
           </div>
           <span className={`text-[10px] font-black ${loading ? 'text-slate-300' : errorMsg ? 'text-rose-300' : 'text-indigo-300'}`}>
             {loading ? "..." : errorMsg ? "! ! !" : "100%"}
           </span>
        </div>
      </div>
    </div>
  );
};


export default SmartInsights;
