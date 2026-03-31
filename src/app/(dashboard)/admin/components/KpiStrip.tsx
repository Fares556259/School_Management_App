import React from 'react';

interface KpiCardProps {
  title: string;
  value: string;
  trend?: number;
  type: 'income' | 'expense' | 'warning' | 'neutral';
}

const KpiCard = ({ title, value, trend, type }: KpiCardProps) => {
  const bgColors = {
    income: 'bg-emerald-50 border-emerald-100',
    expense: 'bg-rose-50 border-rose-100',
    warning: 'bg-amber-50 border-amber-100',
    neutral: 'bg-slate-50 border-slate-100',
  };

  const textColors = {
    income: 'text-emerald-700',
    expense: 'text-rose-700',
    warning: 'text-amber-700',
    neutral: 'text-slate-700',
  };

  const iconColors = {
    income: 'bg-emerald-500',
    expense: 'bg-rose-500',
    warning: 'bg-amber-500',
    neutral: 'bg-slate-500',
  };

  return (
    <div className={`flex-1 min-w-[200px] p-6 rounded-2xl border ${bgColors[type]} shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex justify-between items-start mb-4">
        <div className={`w-10 h-10 rounded-xl ${iconColors[type]} flex items-center justify-center text-white shadow-lg shadow-current/20`}>
          {type === 'income' && '💰'}
          {type === 'expense' && '💸'}
          {type === 'warning' && '⌛'}
          {type === 'neutral' && '📊'}
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-slate-500 mb-1">{title}</p>
      <h2 className={`text-3xl font-black ${textColors[type]} tracking-tight`}>{value}</h2>
    </div>
  );
};

interface KpiStripProps {
  totalBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  unpaidAmount: number;
  unpaidCount: number;
  incomeTrend?: number;
  expenseTrend?: number;
}

const KpiStrip = ({ 
  totalBalance, 
  thisMonthIncome, 
  thisMonthExpense, 
  unpaidAmount, 
  unpaidCount,
  incomeTrend,
  expenseTrend 
}: KpiStripProps) => {
  return (
    <div className="flex gap-4 w-full flex-wrap">
      <KpiCard 
        title="Total Balance" 
        value={`$${(totalBalance / 1000).toFixed(1)}k`} 
        type={totalBalance >= 0 ? 'income' : 'expense'} 
      />
      <KpiCard 
        title="Income (Month)" 
        value={`$${(thisMonthIncome / 1000).toFixed(1)}k`} 
        trend={incomeTrend}
        type="income" 
      />
      <KpiCard 
        title="Expenses (Month)" 
        value={`$${(thisMonthExpense / 1000).toFixed(1)}k`} 
        trend={expenseTrend}
        type="expense" 
      />
      <KpiCard 
        title="Unpaid Amount" 
        value={`$${(unpaidAmount / 1000).toFixed(1)}k`} 
        type="warning" 
      />
      <KpiCard 
        title="Unpaid Entities" 
        value={unpaidCount.toString()} 
        type="neutral" 
      />
    </div>
  );
};

export default KpiStrip;
