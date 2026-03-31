import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, Banknote, Receipt, Activity, Wallet } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string;
  trend?: number;
  type: 'income' | 'expense' | 'warning' | 'neutral';
  icon: any;
}

const KpiCard = ({ title, value, trend, type, icon: Icon }: KpiCardProps) => {
  const bgColors = {
    income: 'bg-white border-slate-100',
    expense: 'bg-white border-slate-100',
    warning: 'bg-white border-slate-100',
    neutral: 'bg-white border-slate-100',
  };

  const trendColor = trend !== undefined ? (trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50') : '';

  return (
    <div className={`flex-1 min-w-[240px] p-6 rounded-[24px] border ${bgColors[type]} shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 duration-300 ${
          type === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 
          type === 'expense' ? 'bg-rose-500/10 text-rose-600' : 
          type === 'warning' ? 'bg-amber-500/10 text-amber-600' : 
          'bg-indigo-500/10 text-indigo-600'
        }`}>
          <Icon size={24} strokeWidth={2.5} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-tight shadow-sm ${trendColor}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-[13px] font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
        <div className="flex items-baseline gap-2">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">{value}</h2>
          {trend !== undefined && (
            <span className="text-[10px] font-bold text-slate-300 uppercase">vs last month</span>
          )}
        </div>
      </div>
    </div>
  );
};

interface KpiStripProps {
  totalBalance: number;
  thisMonthIncome: number;
  thisMonthExpense: number;
  unpaidAmount: number;
  unpaidCount: number;
  balanceTrend?: number;
  incomeTrend?: number;
  expenseTrend?: number;
}

const KpiStrip = ({ 
  totalBalance, 
  thisMonthIncome, 
  thisMonthExpense, 
  unpaidAmount, 
  unpaidCount,
  balanceTrend,
  incomeTrend,
  expenseTrend 
}: KpiStripProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 w-full">
      <KpiCard 
        title="Total Balance" 
        value={`$${(totalBalance / 1000).toFixed(1)}k`} 
        trend={balanceTrend}
        type={totalBalance >= 0 ? 'income' : 'expense'} 
        icon={Activity}
      />
      <KpiCard 
        title="Income (Month)" 
        value={`$${(thisMonthIncome / 1000).toFixed(1)}k`} 
        trend={incomeTrend}
        type="income" 
        icon={Banknote}
      />
      <KpiCard 
        title="Expenses (Month)" 
        value={`$${(thisMonthExpense / 1000).toFixed(1)}k`} 
        trend={expenseTrend}
        type="expense" 
        icon={Receipt}
      />
      <KpiCard 
        title="Unpaid Amount" 
        value={`$${(unpaidAmount / 1000).toFixed(1)}k`} 
        type="warning" 
        icon={AlertCircle}
      />
      <KpiCard 
        title="Unpaid Entities" 
        value={unpaidCount.toString()} 
        type="neutral" 
        icon={Wallet}
      />
    </div>
  );
};

export default KpiStrip;
