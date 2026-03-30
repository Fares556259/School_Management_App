"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ChartData = { name: string; income: number; expense: number };

const FinanceChartClient = ({ data }: { data: ChartData[] }) => {
  return (
    <ResponsiveContainer width="100%" height="85%">
      <LineChart
        data={data}
        margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="name"
          axisLine={false}
          tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
          tickLine={false}
          tickMargin={20}
        />
        <YAxis
          axisLine={false}
          tick={{ fill: "#94a3b8", fontSize: 12, fontWeight: 600 }}
          tickLine={false}
          tickMargin={20}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "16px",
            border: "none",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
            padding: "12px",
          }}
          itemStyle={{ fontWeight: 600 }}
          formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
        />
        <Legend
          align="right"
          verticalAlign="top"
          wrapperStyle={{ paddingTop: "0px", paddingBottom: "40px" }}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="income"
          stroke="#6366f1"
          strokeWidth={4}
          dot={{ fill: "#6366f1", strokeWidth: 2, r: 4, stroke: "#fff" }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="expense"
          stroke="#94a3b8"
          strokeWidth={4}
          dot={{ fill: "#94a3b8", strokeWidth: 2, r: 4, stroke: "#fff" }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default FinanceChartClient;
