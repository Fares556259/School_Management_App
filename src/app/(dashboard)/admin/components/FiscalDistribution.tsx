"use client";

import React, { useMemo } from 'react';
import { useLanguage } from '@/lib/translations/LanguageContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface FinanceDataPoint {
  name: string;
  value: number;
  type: 'income' | 'expense';
}

interface BreakdownItem {
  name: string;
  value: number;
  type: 'income' | 'expense';
}

interface FiscalDistributionProps {
  incomeData: FinanceDataPoint[];
  expenseData: FinanceDataPoint[];
  fullBreakdown?: BreakdownItem[];
  timeFilter?: string;
}

const PALETTE = [
  '#38bdf8', // Sky blue
  '#a855f7', // Purple
  '#10b981', // Emerald green
  '#f59e0b', // Amber / Gold
  '#f97316', // Orange
  '#ef4444', // Red / Rose
  '#64748b', // Slate
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#eab308', // Yellow
];

interface DonutCardProps {
  title: string;
  items: { name: string; value: number }[];
  totalLabel: string;
}

const DonutCard: React.FC<DonutCardProps> = ({ title, items, totalLabel }) => {
  const totalAmount = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [items]);

  const chartData = useMemo(() => {
    const validItems = items.filter((i) => i.value > 0);
    if (validItems.length === 0) {
      return [];
    }

    return validItems
      .sort((a, b) => b.value - a.value)
      .map((item, index) => {
        const percentage = totalAmount > 0 ? Math.round((item.value / totalAmount) * 100) : 0;
        const color = PALETTE[index % PALETTE.length];
        return {
          ...item,
          percentage,
          color,
        };
      });
  }, [items, totalAmount]);

  const CustomDonutTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white/95 p-3 rounded-xl shadow-xl border border-slate-100 backdrop-blur-md min-w-[160px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <p className="text-xs font-bold text-slate-800 tracking-tight">{data.name}</p>
          </div>
          <p className="text-sm font-black text-slate-900">
            {Math.round(data.value).toLocaleString()} TND
          </p>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {data.percentage}% du total
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col justify-between min-h-[360px]">
      {/* Card Title */}
      <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight mb-2">
        {title}
      </h3>

      {/* Donut Chart + Category List */}
      <div className="flex flex-col sm:flex-row items-center gap-6 my-auto">
        {/* Donut on Left */}
        <div className="w-[160px] h-[160px] relative flex-shrink-0 flex items-center justify-center">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={74}
                  paddingAngle={2}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#ffffff" strokeWidth={1.5} />
                  ))}
                </Pie>
                <Tooltip content={<CustomDonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-[140px] h-[140px] rounded-full border-8 border-dashed border-slate-100 flex items-center justify-center text-xs text-slate-400">
              0 TND
            </div>
          )}
        </div>

        {/* Legend List on Right */}
        <div className="flex-1 w-full flex flex-col gap-2 max-h-[190px] overflow-y-auto pr-1 custom-scrollbar">
          {chartData.length > 0 ? (
            chartData.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-slate-600 truncate max-w-[130px] sm:max-w-[160px]">{item.name}</span>
                </div>
                <span
                  className="font-bold text-[11px] px-2 py-0.5 rounded flex-shrink-0"
                  style={{
                    color: item.color,
                    backgroundColor: `${item.color}15`,
                  }}
                >
                  {item.percentage}%
                </span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-400 italic py-4">Aucune donnée enregistrée</p>
          )}
        </div>
      </div>

      {/* Bottom Segmented Bar & Total */}
      <div className="mt-4 pt-3 border-t border-slate-50">
        <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-100 gap-[2px]">
          {chartData.map((item, idx) => (
            <div
              key={idx}
              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-300"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
              title={`${item.name}: ${item.percentage}%`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between text-xs mt-2 text-slate-400">
          <span className="text-[11px] font-medium">{totalLabel}</span>
          <span className="font-bold text-slate-700 tracking-tight">
            {Math.round(totalAmount).toLocaleString()} TND
          </span>
        </div>
      </div>
    </div>
  );
};

const FiscalDistribution: React.FC<FiscalDistributionProps> = ({
  incomeData,
  expenseData,
}) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
      <DonutCard
        title={t.fiscalDistribution.revenueDistribution || "Répartition des revenus"}
        items={incomeData}
        totalLabel={t.fiscalDistribution.totalAmount || "Montant total"}
      />
      <DonutCard
        title={t.fiscalDistribution.expenseDistribution || "Répartition des dépenses"}
        items={expenseData}
        totalLabel={t.fiscalDistribution.totalAmount || "Montant total"}
      />
    </div>
  );
};

export default FiscalDistribution;
