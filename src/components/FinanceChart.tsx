import prisma from "@/lib/prisma";
import FinanceChartClient from "./FinanceChartClient";
import Image from "next/image";

// Build last 12 months labels
function getLast12Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  d.setMonth(d.getMonth() - 11);
  for (let i = 0; i < 12; i++) {
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

const FinanceChart = async () => {
  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ select: { amount: true, date: true } }),
    prisma.expense.findMany({ select: { amount: true, date: true } }),
  ]);

  // Group by month
  const incomeMap: Record<string, number> = {};
  const expenseMap: Record<string, number> = {};

  for (const r of incomes) {
    const key = r.date.toLocaleString("en-US", { month: "short", year: "numeric" });
    incomeMap[key] = (incomeMap[key] || 0) + r.amount;
  }
  for (const r of expenses) {
    const key = r.date.toLocaleString("en-US", { month: "short", year: "numeric" });
    expenseMap[key] = (expenseMap[key] || 0) + r.amount;
  }

  const labels = getLast12Months();
  const data = labels.map((m) => ({
    name: m,
    income: Math.round(incomeMap[m] || 0),
    expense: Math.round(expenseMap[m] || 0),
  }));

  return (
    <div className="glass-card w-full h-full p-6 rounded-3xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-xl font-bold text-slate-800">Financial Overview</h1>
        <div className="p-2 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
          <Image src="/moreDark.png" alt="" width={20} height={20} className="opacity-40" />
        </div>
      </div>
      <FinanceChartClient data={data} />
    </div>
  );
};

export default FinanceChart;
