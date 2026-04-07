"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getFinancialInsights } from '../actions/aiActions';

interface Insight {
  text: string;
  type: 'positive' | 'warning' | 'info' | 'action';
  icon: string;
}

interface SmartFinancialInsightsProps {
  income: number;
  expense: number;
  breakdown: { name: string, value: number, type: 'income' | 'expense' }[];
  prevIncome: number;
  month: string;
  dailyData?: { date: string, income: number, expense: number }[];
}

const SmartFinancialInsights: React.FC<SmartFinancialInsightsProps> = ({
  income,
  expense,
  breakdown,
  prevIncome,
  month,
  dailyData
}) => {
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
      });

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
            type: 'warning',
            icon: '⚠️'
          });
        }
        
        const revDiff = prevIncome === 0 ? 0 : ((income - prevIncome) / prevIncome) * 100;
        if (revDiff < 0) {
            fallbackInsights.push({
            text: `Revenue decreased by ${Math.abs(Math.round(revDiff))}% compared to last period.`,
            type: 'warning',
            icon: '📉'
          });
        }

        const margin = income === 0 ? 0 : ((income - expense) / income) * 100;
        if (margin < 0) {
            fallbackInsights.push({
            text: `Operating at a deficit ($${Math.round(expense - income).toLocaleString()}). Consider reducing non-essential costs.`,
            type: 'warning',
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
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-4 min-h-[300px]">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest">
            Smart Insights
            </h2>
            <div className="px-2 py-0.5 bg-indigo-50 rounded-md">
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest">AI Powered</span>
            </div>
        </div>
        <span className={`flex h-2 w-2 rounded-full ${isLoading ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`} />
      </div>

      <div className="flex flex-col gap-3 relative flex-1">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-3"
            >
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 bg-slate-50 animate-pulse rounded-[20px] border border-slate-100 border-dashed" />
              ))}
              <p className="text-[10px] text-center font-bold text-slate-400 mt-4 uppercase animate-bounce">
                AI analyst is analyzing trends...
              </p>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-3"
            >
              {insights.map((insight, idx) => (
                <motion.div 
                   key={idx}
                   initial={{ opacity: 0, scale: 0.95, y: 10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   transition={{ delay: idx * 0.1 }}
                   className={`p-4 rounded-[20px] flex items-start gap-4 border shadow-sm transition-all hover:shadow-md ${
                       insight.type === 'positive' ? 'bg-emerald-50 border-emerald-100' :
                       insight.type === 'warning' ? 'bg-rose-50 border-rose-100' :
                       insight.type === 'action' ? 'bg-amber-50 border-amber-200' :
                       'bg-slate-50 border-slate-100'
                   }`}
                >
                  <span className="text-xl shrink-0">{insight.icon}</span>
                  <div className="flex flex-col gap-1">
                    {insight.type === 'action' && (
                        <span className="text-[8px] font-black text-amber-600 uppercase tracking-widest">Recommended Action</span>
                    )}
                    <p className={`text-xs font-bold leading-relaxed ${
                        insight.type === 'positive' ? 'text-emerald-700' :
                        insight.type === 'warning' ? 'text-rose-700' :
                        insight.type === 'action' ? 'text-amber-800' :
                        'text-slate-600'
                    }`}>
                      {insight.text}
                    </p>
                  </div>
                </motion.div>
              ))}
              
              {insights.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                    <span className="text-2xl mb-2">📊</span>
                    <p className="text-xs font-bold text-slate-400 italic">No significant insights detected for this period.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SmartFinancialInsights;
