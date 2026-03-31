import React from 'react';
import { Sparkles, TrendingUp, AlertCircle, Zap, RefreshCcw } from 'lucide-react';

interface SmartInsightsProps {
  insights: string[];
}

const SmartInsights = ({ insights }: SmartInsightsProps) => {
  return (
    <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100 flex flex-col h-full group">
      {/* 1. HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300">
            <Sparkles size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">Smart Insights</h3>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* 2. INSIGHT LIST */}
      <div className="flex-1 space-y-4">
        {insights.map((insight, idx) => (
          <div key={idx} className="flex gap-4 items-start p-4 bg-slate-50/50 hover:bg-white rounded-2xl border border-transparent hover:border-slate-100 transition-all group/item shadow-none hover:shadow-sm">
            <div className={`mt-0.5 p-1.5 rounded-lg ${
              insight.includes('⚠️') ? 'bg-rose-50 text-rose-500' : 
              insight.includes('📌') ? 'bg-indigo-50 text-indigo-500' : 
              'bg-emerald-50 text-emerald-500'
            }`}>
              {insight.includes('⚠️') ? <AlertCircle size={16} /> : 
               insight.includes('📌') ? <Zap size={16} /> : 
               <TrendingUp size={16} />}
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-slate-600 leading-relaxed">
                {insight.replace(/[⚠️📌]/g, '').trim()}
              </p>
              <button className="text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors uppercase tracking-widest flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                Learn more <ArrowRight size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. ANALYSIS STATUS */}
      <div className="mt-8 pt-4 border-t border-slate-50">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200">
           <div className="flex items-center gap-2">
              <RefreshCcw size={12} className="text-slate-400 animate-spin" />
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest text-center">
                 AI Analysis in progress...
              </p>
           </div>
           <span className="text-[10px] font-black text-slate-300">88%</span>
        </div>
      </div>
    </div>
  );
};

const ArrowRight = ({ size, className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

export default SmartInsights;
