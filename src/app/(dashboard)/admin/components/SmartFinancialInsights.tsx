"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { Lock, RefreshCw, AlertCircle } from 'lucide-react';

interface Insight {
  text: string;
  type: 'performance' | 'risk' | 'opportunity' | 'trend' | 'action';
  icon: string;
  confidence?: string;
}

interface SmartFinancialInsightsProps {
  income: number;
  expense: number;
  breakdown: { name: string, value: number, type: 'income' | 'expense' }[];
  prevIncome: number;
  month: string;
  dailyData?: { date: string, income: number, expense: number }[];
  className?: string;
}

const getEmoji = (icon: string) => {
  const mapping: Record<string, string> = {
    'bar-chart': '📈',
    'warning': '⚠️',
    'alert': '🚨',
    'lightbulb': '💡',
    'search': '🔍',
    'trending-up': '↗️',
    'trending-down': '↘️',
    'dollar-sign': '💰',
    'pie-chart': '📊',
    'check': '✅',
    'x': '❌',
    'info': 'ℹ️',
    'clock': '🕒',
    'user': '👤',
    'users': '👥',
    'calendar': '📅',
    'zap': '⚡',
  };
  return mapping[icon.toLowerCase()] || icon;
};

const SmartFinancialInsights: React.FC<SmartFinancialInsightsProps> = ({
  income,
  expense,
  breakdown,
  prevIncome,
  month,
  dailyData,
  className
}) => {
  const { locale, t } = useLanguage();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [quota, setQuota] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const [lastDataHash, setLastDataHash] = useState("");

  const fetchAiInsights = async (force = false) => {
    const currentDataHash = JSON.stringify({ income, expense, breakdown, prevIncome, month, dailyData, locale });
    if (!force && currentDataHash === lastDataHash) return;

    setIsLoading(true);
    setIsLocked(false);
    setError(null);
    setLastDataHash(currentDataHash);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s client-side timeout

      const res = await fetch("/api/admin/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { income, expense, breakdown, prevIncome, month, dailyData },
          locale
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!res.ok) {
        if (res.status === 504) throw new Error("TIMEOUT");
        throw new Error("FAILED");
      }

      const result = await res.json();

      if (result.error) {
        if (result.error.startsWith("DAILY_QUOTA_REACHED")) {
          setIsLocked(true);
          setQuota(Number(result.error.split("|")[1]) || 10);
        } else {
          setError(result.error);
        }
      } else if (Array.isArray(result)) {
        setInsights(result);
      } else {
        throw new Error("INVALID_RESPONSE");
      }
    } catch (err: any) {
      console.error("❌ [CLIENT_AI_ERROR] Failed to fetch insights:", err.message);
      if (err.name === 'AbortError' || err.message === 'TIMEOUT') {
        setError("AI Service temporarily busy (Timeout). Showing local fallbacks.");
      } else {
        setError("Failed to generate AI insights.");
      }
      
      // FALLBACK INSIGHTS
      const fallbackInsights: Insight[] = [
        { 
          text: `Revenue for ${month} is currently $${income.toLocaleString()}. Maintain positive cashflow.`, 
          type: 'performance', 
          icon: 'dollar-sign' 
        },
        { 
          text: expense > income ? "Warning: Expenses exceed current income." : "Healthy income-to-expense ratio.", 
          type: expense > income ? 'risk' : 'trend', 
          icon: expense > income ? 'warning' : 'bar-chart' 
        }
      ];
      setInsights(fallbackInsights);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAiInsights();
  }, [income, expense, breakdown, prevIncome, month, dailyData, locale]);

  return (
    <div className={`bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4 relative overflow-hidden ${className || ''}`}>
      {isLocked && (
        <div className="absolute inset-0 z-20 bg-white/60 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center border-2 border-indigo-100/50 rounded-[32px] animate-in fade-in duration-500">
           <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white mb-4 shadow-xl shadow-indigo-200 ring-8 ring-indigo-50">
              <Lock size={24} />
           </div>
           <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-2">Limite AI Atteinte</h3>
           <p className="text-sm font-bold text-slate-500 leading-relaxed mb-6 max-w-xs">
              Vous avez utilisé vos {quota} analyses quotidiennes. Passez à **Premium** pour des analyses illimitées.
           </p>
           <button className="px-6 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">
              Débloquer Premium
           </button>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-slate-800 tracking-tighter uppercase opacity-50 italic">
            {t.smartInsights.title}
          </h2>
          <div className="px-2 py-0.5 bg-indigo-50 rounded-md">
            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{t.smartInsights.aiPowered}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <div className="flex items-center gap-1 text-rose-500 text-[10px] font-bold">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}
          <button 
            onClick={() => fetchAiInsights(true)}
            disabled={isLoading}
            className={`p-1.5 rounded-full hover:bg-slate-50 transition-all text-slate-400 ${isLoading ? 'animate-spin cursor-not-allowed' : ''}`}
          >
            <RefreshCw size={14} />
          </button>
          <span className={`flex h-2 w-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-pulse' : error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
        </div>
      </div>

      <div className={`relative flex-1 min-h-0 w-full ${isLocked ? 'blur-[6px] pointer-events-none select-none grayscale-[0.5]' : ''}`}>
        <AnimatePresence mode="wait">
          {isLoading && insights.length === 0 ? (
            <motion.div 
               key="loading"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-[20px] border border-slate-100 border-dashed" />
              ))}
              <div className="col-span-full">
                  <p className="text-[10px] text-center font-bold text-slate-400 mt-4 uppercase italic animate-bounce">
                    {t.smartInsights.analyzing}
                  </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-start w-full"
            >
              {[
                { type: 'performance', label: t.smartInsights.performance, icon: '🟢', color: 'emerald' },
                { type: 'risk', label: t.smartInsights.risks, icon: '🔴', color: 'rose' },
                { type: 'opportunity', label: t.smartInsights.opportunities, icon: '🟡', color: 'amber' },
                { type: 'trend', label: t.smartInsights.trends, icon: '🔵', color: 'indigo' },
                { type: 'action', label: t.smartInsights.actionableSteps, icon: '⚡', color: 'orange' }
              ].map((category) => {
                const categoryInsights = insights.filter(i => i.type === category.type);
                
                return (
                  <div key={category.type} className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 mb-1 px-1">
                      <span className="text-xs">{category.icon}</span>
                      <h3 className={`text-[10px] font-black uppercase tracking-widest ${
                          category.type === 'performance' ? 'text-emerald-500' :
                          category.type === 'risk' ? 'text-rose-500' :
                          category.type === 'opportunity' ? 'text-amber-500' :
                          category.type === 'action' ? 'text-orange-500' :
                          'text-indigo-500'
                      }`}>
                        {category.label}
                      </h3>
                    </div>
                    
                    {categoryInsights.length > 0 ? (
                      categoryInsights.map((insight, idx) => (
                        <motion.div 
                           key={idx}
                           initial={{ opacity: 0, scale: 0.95, y: 10 }}
                           animate={{ opacity: 1, scale: 1, y: 0 }}
                           transition={{ delay: idx * 0.1 }}
                           className={`p-4 rounded-[20px] flex flex-col gap-3 border shadow-sm transition-all hover:shadow-md ${
                               category.type === 'performance' ? 'bg-emerald-50 border-emerald-100' :
                               category.type === 'risk' ? 'bg-rose-50 border-rose-100' :
                               category.type === 'opportunity' ? 'bg-amber-50 border-amber-200' :
                               category.type === 'action' ? 'bg-orange-50 border-orange-100' :
                               'bg-indigo-50 border-indigo-100'
                           }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                             <span className="text-xl leading-none">{getEmoji(insight.icon)}</span>
                             {insight.confidence && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 opacity-60">
                                    {insight.confidence}
                                </span>
                             )}
                          </div>
                          <p className={`text-xs font-bold leading-relaxed ${
                              category.type === 'performance' ? 'text-emerald-700' :
                              category.type === 'risk' ? 'text-rose-700' :
                              category.type === 'opportunity' ? 'text-amber-800' :
                              category.type === 'action' ? 'text-orange-700' :
                              'text-indigo-700'
                          }`}>
                            {insight.text}
                          </p>
                        </motion.div>
                      ))
                    ) : (
                       <div className="p-4 rounded-[20px] border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center text-center h-24">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-50">{t.smartInsights.noExt} {category.label} {t.smartInsights.detected}</span>
                       </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SmartFinancialInsights;
