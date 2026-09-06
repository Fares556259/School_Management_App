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
  '#0284c7', // 1. Sky / Ocean Blue
  '#8b5cf6', // 2. Vivid Purple
  '#10b981', // 3. Emerald Green
  '#f59e0b', // 4. Amber / Gold
  '#ec4899', // 5. Pink / Rose
  '#06b6d4', // 6. Cyan / Turquoise
  '#f97316', // 7. Orange
  '#6366f1', // 8. Indigo
  '#84cc16', // 9. Lime Green
  '#e11d48', // 10. Crimson Red
  '#14b8a6', // 11. Teal
  '#d946ef', // 12. Fuchsia
  '#ca8a04', // 13. Deep Gold
  '#3b82f6', // 14. Royal Blue
  '#059669', // 15. Forest Green
  '#7c3aed', // 16. Deep Violet
  '#be123c', // 17. Wine Red
  '#0891b2', // 18. Deep Cyan
  '#475569', // 19. Slate
  '#dc2626', // 20. Strong Red
];

interface DonutCardProps {
  title: string;
  items: { name: string; value: number }[];
  totalLabel: string;
}

const DonutCard: React.FC<DonutCardProps> = ({ title, items, totalLabel }) => {
  const { t } = useLanguage();

  const totalAmount = useMemo(() => {
    return items.reduce((acc, curr) => acc + (curr.value || 0), 0);
  }, [items]);

  const chartData = useMemo(() => {
    const validItems = items.filter((i) => (i.value || 0) > 0);
    if (validItems.length === 0 || totalAmount <= 0) {
      return [];
    }

    // Sort descending by value
    const sorted = [...validItems].sort((a, b) => b.value - a.value);

    // Calculate raw percentages
    const withPercentages = sorted.map((item) => {
      const rawPct = (item.value / totalAmount) * 100;
      const percentage = Math.round(rawPct);
      return {
        ...item,
        rawPct,
        percentage,
      };
    });

    // Significant items (>= 1%) vs tiny items (< 1%)
    const significant = withPercentages.filter((item) => item.rawPct >= 1);
    const tiny = withPercentages.filter((item) => item.rawPct < 1);

    const result: { name: string; value: number; percentage: number; color: string }[] = [];

    // Assign guaranteed unique colors to significant items
    significant.forEach((item, index) => {
      result.push({
        name: item.name,
        value: item.value,
        percentage: Math.max(1, item.percentage),
        color: PALETTE[index % PALETTE.length],
      });
    });

    // If there are tiny items, combine them into "Autres" if they sum to >= 1%
    if (tiny.length > 0) {
      const tinyTotal = tiny.reduce((acc, curr) => acc + curr.value, 0);
      const tinyPct = Math.round((tinyTotal / totalAmount) * 100);
      if (tinyPct >= 1) {
        result.push({
          name: t.fiscalDistribution.other || "Autres",
          value: tinyTotal,
          percentage: tinyPct,
          color: '#94a3b8',
        });
      } else if (significant.length === 0) {
        // Fallback if all items are tiny
        tiny.slice(0, 6).forEach((item, index) => {
          result.push({
            name: item.name,
            value: item.value,
            percentage: 1,
            color: PALETTE[index % PALETTE.length],
          });
        });
      }
    }

    return result;
  }, [items, totalAmount, t]);

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
