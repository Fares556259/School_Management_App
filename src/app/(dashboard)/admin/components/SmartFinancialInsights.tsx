"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface Insight {
  text: string;
  type: 'positive' | 'warning' | 'info';
  icon: string;
}

interface SmartFinancialInsightsProps {
  income: number;
  expense: number;
  breakdown: { name: string, value: number, type: 'income' | 'expense' }[];
  prevIncome: number;
}

const SmartFinancialInsights: React.FC<SmartFinancialInsightsProps> = ({
  income,
  expense,
  breakdown,
  prevIncome
}) => {
  const insights: Insight[] = [];

  // Insight 1: Salaries Percentage
  const salaries = breakdown.find(b => b.name === 'Salaries' && b.type === 'expense')?.value || 0;
  const salaryPercent = expense === 0 ? 0 : (salaries / expense) * 100;
  if (salaryPercent > 60) {
    insights.push({
      text: `Salaries represent ${Math.round(salaryPercent)}% of total expenses — unusually high concentration.`,
      type: 'warning',
      icon: '⚠️'
    });
  } else {
    insights.push({
        text: `Payroll is optimized at ${Math.round(salaryPercent)}% of total operational costs.`,
        type: 'positive',
        icon: '✅'
      });
  }

  // Insight 2: Revenue Trend
  const revDiff = prevIncome === 0 ? 0 : ((income - prevIncome) / prevIncome) * 100;
  if (revDiff < 0) {
    insights.push({
      text: `Revenue decreased by ${Math.abs(Math.round(revDiff))}% compared to last period.`,
      type: 'warning',
      icon: '📉'
    });
  } else if (revDiff > 0) {
    insights.push({
      text: `Revenue is up by ${Math.round(revDiff)}% — positive growth trend.`,
      type: 'positive',
      icon: '📈'
    });
  }

  // Insight 3: Largest Expense (excluding Salaries)
  const otherExpenses = breakdown
    .filter(b => b.type === 'expense' && b.name !== 'Salaries')
    .sort((a, b) => b.value - a.value);
  
  if (otherExpenses.length > 0) {
    insights.push({
      text: `${otherExpenses[0].name} is your largest operational expense at $${Math.round(otherExpenses[0].value).toLocaleString()}.`,
      type: 'info',
      icon: '🔍'
    });
  }

  // Insight 4: Margin Health
  const margin = income === 0 ? 0 : ((income - expense) / income) * 100;
  if (margin < 0) {
    insights.push({
      text: `Operating at a deficit ($${Math.round(expense - income).toLocaleString()}). Consider reducing non-essential costs.`,
      type: 'warning',
      icon: '🚩'
    });
  } else if (margin > 20) {
    insights.push({
        text: `Healthy profit margin of ${Math.round(margin)}% — stable financial position.`,
        type: 'positive',
        icon: '💎'
      });
  }

  return (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-black text-slate-800 tracking-tighter uppercase opacity-50 italic">
          Smart Insights
        </h2>
        <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse" />
      </div>

      <div className="flex flex-col gap-3">
        {insights.map((insight, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            className={`p-4 rounded-[20px] flex items-start gap-4 border ${
                insight.type === 'positive' ? 'bg-emerald-50 border-emerald-100' :
                insight.type === 'warning' ? 'bg-rose-50 border-rose-100' :
                'bg-slate-50 border-slate-100'
            }`}
          >
            <span className="text-xl shrink-0">{insight.icon}</span>
            <p className={`text-xs font-bold leading-relaxed ${
                insight.type === 'positive' ? 'text-emerald-700' :
                insight.type === 'warning' ? 'text-rose-700' :
                'text-slate-600'
            }`}>
              {insight.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default SmartFinancialInsights;
