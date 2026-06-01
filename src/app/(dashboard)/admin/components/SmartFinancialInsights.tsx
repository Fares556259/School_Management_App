"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { Lock, RefreshCw, AlertCircle, TrendingUp, AlertTriangle, Lightbulb, CheckCircle2, BarChart2 } from 'lucide-react';

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
  unpaidCount?: number;
  className?: string;
}

const getLucideIcon = (icon: string) => {
  const mapping: Record<string, React.ReactNode> = {
    'bar-chart': <BarChart2 size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'warning': <AlertTriangle size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'alert': <AlertTriangle size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'lightbulb': <Lightbulb size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'trending-up': <TrendingUp size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'trending-down': <TrendingUp size={20} className="text-[#181d26]" strokeWidth={1.5} />,
    'check': <CheckCircle2 size={20} className="text-[#181d26]" strokeWidth={1.5} />,
  };
  return mapping[icon.toLowerCase()] || <Lightbulb size={20} className="text-[#181d26]" strokeWidth={1.5} />;
};

const SmartFinancialInsights: React.FC<SmartFinancialInsightsProps> = ({
  income,
  expense,
  breakdown,
  prevIncome,
  month,
  dailyData,
  unpaidCount = 0,
  className
}) => {
  const { locale, t } = useLanguage();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [quota, setQuota] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const [lastDataHash, setLastDataHash] = useState("");

  const fetchAiInsights = useCallback(async (force = false) => {
    const currentDataHash = JSON.stringify({ income, expense, breakdown, prevIncome, month, dailyData, unpaidCount, locale });
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
          data: { income, expense, breakdown, prevIncome, month, dailyData, unpaidCount },
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
  }, [income, expense, breakdown, prevIncome, month, dailyData, unpaidCount, locale, lastDataHash]);

  useEffect(() => {
    fetchAiInsights();
  }, [fetchAiInsights]);

  return (
    <div className={`bg-[#ffffff] p-6 rounded-[8px] border border-[#d8d8d8] shadow-sm flex flex-col gap-4 relative overflow-hidden ${className || ''}`}>
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
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-[24px] font-normal text-[#181d26] leading-[1.35] tracking-[0.12px]">
            {t.smartInsights.title}
          </h2>
          <div className="px-2 py-1 bg-[#f8fafc] border border-[#dddddd] rounded-[6px]">
            <span className="text-[12px] font-medium text-[#41454d] tracking-wide">AI POWERED</span>
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
              className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x w-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            >
              {[
                { type: 'performance', label: t.smartInsights.performance, iconColor: 'text-emerald-600', bgIcon: 'bg-emerald-50' },
                { type: 'risk', label: t.smartInsights.risks, iconColor: 'text-rose-600', bgIcon: 'bg-rose-50' },
                { type: 'opportunity', label: t.smartInsights.opportunities, iconColor: 'text-amber-600', bgIcon: 'bg-amber-50' },
                { type: 'trend', label: t.smartInsights.trends, iconColor: 'text-indigo-600', bgIcon: 'bg-indigo-50' },
                { type: 'action', label: t.smartInsights.actionableSteps, iconColor: 'text-orange-600', bgIcon: 'bg-orange-50' }
              ].map((category) => {
                const categoryInsights = insights.filter(i => i.type === category.type);
                
                if (categoryInsights.length === 0) return null;

                return (
                  <div key={category.type} className={`min-w-[280px] max-w-[320px] snap-start rounded-[8px] p-4 flex flex-col gap-3 bg-[#ffffff] border border-[#dddddd] shadow-sm`}>
                    <div className="flex items-center gap-2">
                      <div className={`p-1.5 rounded-md ${category.bgIcon}`}>
                        {React.cloneElement(getLucideIcon(categoryInsights[0]?.icon) as React.ReactElement, { className: category.iconColor, size: 16 })}
                      </div>
                      <h3 className="text-[13px] font-semibold text-[#181d26] uppercase tracking-wide">
                        {category.label}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {categoryInsights.map((insight, idx) => (
                        <motion.div 
                           key={idx}
                           initial={{ opacity: 0, y: 5 }}
                           animate={{ opacity: 1, y: 0 }}
                           transition={{ delay: idx * 0.1 }}
                        >
                          <p className="text-[13px] font-normal text-[#333840] leading-relaxed">
                            {insight.text}
                          </p>
                        </motion.div>
                      ))}
                    </div>
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
