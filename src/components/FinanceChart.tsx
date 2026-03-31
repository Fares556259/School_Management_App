import prisma from "@/lib/prisma";
import FinanceChartClient from "./FinanceChartClient";

const FinanceChart = async ({ filter = "1Y" }: { filter?: string }) => {
  const now = new Date();
  let startDate = new Date();

  if (filter === "1M") startDate.setMonth(now.getMonth() - 1);
  else if (filter === "6M") startDate.setMonth(now.getMonth() - 6);
  else startDate.setFullYear(now.getFullYear() - 1);

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({ 
      where: { date: { gte: startDate } },
      select: { amount: true, date: true } 
    }),
    prisma.expense.findMany({ 
      where: { date: { gte: startDate } },
      select: { amount: true, date: true } 
    }),
  ]);

  // Totals for Summary Header
  const totalIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.amount, 0);
  const netResult = totalIncome - totalExpense;

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

  // Build labels based on filter
  const months: string[] = [];
  const d = new Date(startDate);
  const count = filter === "1M" ? 1 : filter === "6M" ? 6 : 12;
  
  for (let i = 0; i <= count; i++) {
    months.push(d.toLocaleString("en-US", { month: "short", year: "numeric" }));
    d.setMonth(d.getMonth() + 1);
  }

  const data = months.map((m) => ({
    name: m,
    income: Math.round(incomeMap[m] || 0),
    expense: Math.round(expenseMap[m] || 0),
  }));

  return (
    <div className="w-full h-full">
      <FinanceChartClient 
        data={data} 
        totalIncome={totalIncome}
        totalExpense={totalExpense}
        netResult={netResult}
        currentFilter={filter}
      />
    </div>
  );
};

export default FinanceChart;
