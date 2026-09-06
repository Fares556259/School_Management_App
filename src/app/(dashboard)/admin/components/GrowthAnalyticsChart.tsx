"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/translations/LanguageContext";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GrowthData {
  month: string;
  income: number;
  expense: number;
}

interface GrowthAnalyticsChartProps {
  data: GrowthData[];
  currentIncome?: number;
  currentExpense?: number;
  is12Months?: boolean;
}

const GrowthAnalyticsChart = ({
  data,
  currentIncome,
  currentExpense,
  is12Months = true,
}: GrowthAnalyticsChartProps) => {
  const [view, setView] = useState<"all" | "income" | "expense" | "profit">("all");
  const { t } = useLanguage();

  const lastIndex = data.length > 0 ? data.length - 1 : 0;
  const lastIncome = currentIncome !== undefined ? currentIncome : (data[lastIndex]?.income || 0);
  const lastExpense = currentExpense !== undefined ? currentExpense : (data[lastIndex]?.expense || 0);
  const netProfit = lastIncome - lastExpense;
  const isHealthy = netProfit >= 0;
  const trend = isHealthy ? t.analyticsChart.healthyGrowth : t.analyticsChart.expensesGrowing;

  const chartData = data.map((d) => ({
    ...d,
    historicalIncome: d.income,
    historicalExpense: d.expense,
    historicalProfit: Math.max(0, d.income - d.expense),
    actualProfit: d.income - d.expense,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const match = data.find((d) => d.month === label);
      const income = payload.find((p: any) => p.dataKey === "historicalIncome")?.value ?? match?.income ?? 0;
      const expense = payload.find((p: any) => p.dataKey === "historicalExpense")?.value ?? match?.expense ?? 0;
      const profit = income - expense;

      return (
        <div className="bg-white/95 p-4 rounded-xl shadow-xl border border-slate-100 backdrop-blur-md min-w-[210px]">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5 pb-1.5 border-b border-slate-100">
            {label}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#38bdf8]" />
                <span className="text-xs font-semibold text-slate-600">{t.analyticsChart.revenue}</span>
              </div>
              <span className="text-xs font-bold text-slate-900">
                {`${Math.round(income).toLocaleString()} DT`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-sm bg-[#c084fc]" />
                <span className="text-xs font-semibold text-slate-600">{t.analyticsChart.expenses}</span>
              </div>
              <span className="text-xs font-bold text-slate-900">
                {`${Math.round(expense).toLocaleString()} DT`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-6 pt-1.5 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                <span className="text-xs font-bold text-slate-700">{t.analyticsChart.netProfit}</span>
              </div>
              <span className={`text-xs font-extrabold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {`\u202A${profit < 0 ? "-" : ""}${Math.abs(Math.round(profit)).toLocaleString()} DT\u202C`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col">
      {/* Top Header matching reference design exactly */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        {/* Left: Title */}
        <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
          {is12Months ? (t.analyticsChart.title12Months || "Revenue VS Dépenses – 12 derniers mois") : (t.analyticsChart.titleGeneral || "Revenue VS Dépenses")}
        </h2>

        {/* Right: Legend matching Image 1 */}
        <div className="flex items-center gap-5 text-xs sm:text-sm font-semibold text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-5 h-2 rounded-full bg-[#38bdf8]" />
            <span>{t.analyticsChart.revenue}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-2 rounded-full bg-[#c084fc]" />
            <span>{t.analyticsChart.expenses}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-5 h-0.5 bg-[#22c55e] relative flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] ring-2 ring-white" />
            </span>
            <span>{t.analyticsChart.netProfit}</span>
          </div>
        </div>
      </div>

      {/* Main Chart Container */}
      <div className="w-full h-[360px] sm:h-[400px] mt-4">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 15, right: 15, left: -15, bottom: 5 }}
              barGap={4}
              barCategoryGap="22%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#E2E8F0"
                strokeOpacity={0.7}
              />
              <XAxis
                dataKey="month"
                axisLine={{ stroke: "#E2E8F0", strokeWidth: 1 }}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                dy={8}
              />
              <YAxis
                domain={[0, 'auto']}
                allowDataOverflow={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748B", fontSize: 11, fontWeight: 500 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                dx={-4}
              />

              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(241, 245, 249, 0.45)" }}
              />

              {/* Dépenses: Soft purple grouped bar on the left */}
              <Bar
                dataKey="historicalExpense"
                name={t.analyticsChart.expenses}
                fill="#c084fc"
                fillOpacity={0.65}
                stroke="#a855f7"
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />

              {/* Revenus: Sky blue grouped bar on the right */}
              <Bar
                dataKey="historicalIncome"
                name={t.analyticsChart.revenue}
                fill="#38bdf8"
                fillOpacity={0.65}
                stroke="#0284c7"
                strokeWidth={1.5}
                radius={[4, 4, 0, 0]}
                maxBarSize={30}
                isAnimationActive={false}
              />

              {/* Bénéfices net: Vibrant emerald green line with circular markers overlaid */}
              <Line
                type="linear"
                dataKey="historicalProfit"
                name={t.analyticsChart.netProfit}
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ r: 4, fill: "#22c55e", stroke: "#ffffff", strokeWidth: 1.5 }}
                activeDot={{ r: 6, fill: "#22c55e", stroke: "#ffffff", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium text-sm">
            Aucune donnée disponible
          </div>
        )}
      </div>
    </div>
  );
};

export default GrowthAnalyticsChart;