"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { getFinancialInsights } from '../actions/aiActions';

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

  useEffect(() => {
    const fetchAiInsights = async () => {
      setIsLoading(true);
      
      const result = await getFinancialInsights({
        income,
        expense,
        breakdown,
        prevIncome,
        month,
        dailyData
      }, locale);

      if (Array.isArray(result)) {
        setInsights(result);
      } else {
        // FALLBACK: Rule-based logic if AI fails or key is missing
        const fallbackInsights: Insight[] = [];
        
        const salaries = breakdown.find(b => b.name === 'Salaries' && b.type === 'expense')?.value || 0;
        const salaryPercent = expense === 0 ? 0 : (salaries / expense) * 100;
        if (salaryPercent > 60) {
            fallbackInsights.push({
            text: `Salaries represent ${Math.round(salaryPercent)}% of total expenses — unusually high concentration.`,
            type: 'risk',
            icon: '⚠️'
          });
        }
        
        const revDiff = prevIncome === 0 ? 0 : ((income - prevIncome) / prevIncome) * 100;
        if (revDiff < 0) {
            fallbackInsights.push({
            text: `Revenue decreased by ${Math.abs(Math.round(revDiff))}% compared to last period.`,
            type: 'risk',
            icon: '📉'
          });
        }

        const margin = income === 0 ? 0 : ((income - expense) / income) * 100;
        if (margin < 0) {
            fallbackInsights.push({
            text: `Operating at a deficit ($${Math.round(expense - income).toLocaleString()}). Consider reducing non-essential costs.`,
            type: 'opportunity',
            icon: '🚩'
          });
        }

        setInsights(fallbackInsights);
      }
      setIsLoading(false);
    };

    fetchAiInsights();
  }, [income, expense, breakdown, prevIncome, month, dailyData]);

  return (
    <div className={`bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4 ${className || ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-slate-800 tracking-tighter uppercase opacity-50 italic">
            {t.smartInsights.title}
            </h2>
            <div className="px-2 py-0.5 bg-indigo-50 rounded-md">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">{t.smartInsights.aiPowered}</span>
            </div>
        </div>
        <span className={`flex h-2 w-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
      </div>

      <div className="relative flex-1 min-h-0 w-full">
        <AnimatePresence mode="wait">
          {isLoading ? (
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
                             <span className="text-xl leading-none">{insight.icon}</span>
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
