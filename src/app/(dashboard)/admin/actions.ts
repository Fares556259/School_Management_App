"use server";

import prisma from "@/lib/prisma";
import { callGeminiDirect } from "./actions/aiActions";

export type Anomaly = {
  type: "DUPLICATE" | "MISMATCH" | "UNPAID";
  message: string;
  severity: "low" | "medium" | "high";
};

export interface ReportData {
  month: string;
  metrics: {
    totalSalaryExpenses: number;
    totalTeachersPaid: number;
    averageSalary: number;
    totalTuitionIncome: number;
    totalGeneralExpenses: number;
    netPerformance: number;
    unpaidArrears: number;
    margin: number;
  };
  individualSalaries: { name: string; amount: number; baseSalary: number }[];
  incomeBreakdown: { category: string; amount: number }[];
  expenseBreakdown: { category: string; amount: number }[];
  topPaid: { name: string; amount: number }[];
  bottomPaid: { name: string; amount: number }[];
  anomalies: Anomaly[];
  insights: string[];
}

export async function getFinancialReportData(monthLabel: string): Promise<ReportData> {
  // Handle both "April 2026" and "April_2026"
  const parts = monthLabel.includes("_") ? monthLabel.split("_") : monthLabel.split(" ");
  const monthName = parts[0];
  const yearStr = parts[1];

  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const monthIdx = MONTHS.indexOf(monthName) + 1;
  const yearVal = parseInt(yearStr);

  if (!yearVal || monthIdx === 0) {
    throw new Error(`Invalid month/year provided: ${monthLabel}`);
  }

  const prevMonthIdx = monthIdx === 1 ? 12 : monthIdx - 1;
  const prevYearVal = monthIdx === 1 ? yearVal - 1 : yearVal;

  const startDate = new Date(yearVal, monthIdx - 1, 1);
  const endDate = new Date(yearVal, monthIdx, 1);

  // 1. FETCH DATA (Comprehensive)
  const [
    currentPayments, 
    lastMonthPayments, 
    allTeachers, 
    allStaff,
    studentTuition,
    generalIncomes,
    generalExpenses,
    unpaidAmount
  ] = await prisma.$transaction([
    prisma.payment.findMany({
      where: { month: monthIdx, year: yearVal, status: "PAID", userType: { in: ["TEACHER", "STAFF"] } },
      include: { teacher: true, staff: true }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { month: prevMonthIdx, year: prevYearVal, status: "PAID", userType: { in: ["TEACHER", "STAFF"] } }
    }),
    prisma.teacher.findMany(),
    prisma.staff.findMany(),
    // Tuition Income
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { month: monthIdx, year: yearVal, status: "PAID", userType: "STUDENT" }
    }),
    // Other Incomes
    prisma.income.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Tuition" } },
      orderBy: { _count: { id: 'desc' } }
    }),
    // Other Expenses
    prisma.expense.groupBy({
      by: ['category'],
      _sum: { amount: true },
      where: { date: { gte: startDate, lt: endDate }, NOT: { category: "Salary" } },
      orderBy: { _count: { id: 'desc' } }
    }),
    // Unpaid/Arrears for context
    prisma.payment.aggregate({
        _sum: { amount: true },
        where: { month: monthIdx, year: yearVal, status: "PENDING" }
    })
  ]);

  // 2. GROUP SALARIES PER PERSON (CRITICAL)
  const salaryMap: Record<string, { name: string; amount: number; baseSalary: number }> = {};
  const paymentCount: Record<string, number> = {};

  currentPayments.forEach(p => {
    const entity = p.teacher || p.staff;
    const id = p.teacherId || p.staffId;

    if (!entity || !id) return;

    // Count payments
    paymentCount[id] = (paymentCount[id] || 0) + 1;

    if (!salaryMap[id]) {
      salaryMap[id] = {
        name: `${entity.name} ${entity.surname}`,
        amount: 0,
        baseSalary: entity.salary || 0
      };
    }

    salaryMap[id].amount += p.amount;
  });

  const individualSalaries = Object.values(salaryMap);

  // 3. METRICS
  const totalSalaryExpenses = individualSalaries.reduce((acc, s) => acc + s.amount, 0);

  const teacherIds = Object.keys(salaryMap).filter(id =>
    currentPayments.find(p => p.teacherId === id)
  );

  const totalTeachersPaid = teacherIds.length;

  const totalTeacherSalary = teacherIds.reduce((acc, id) => acc + salaryMap[id].amount, 0);

  const averageSalary =
    totalTeachersPaid > 0 ? totalTeacherSalary / totalTeachersPaid : 0;

  // 4. TOP / BOTTOM
  const sorted = [...individualSalaries].sort((a, b) => b.amount - a.amount);

  const topPaid = sorted.slice(0, 3).map(s => ({
    name: s.name,
    amount: s.amount
  }));

  const bottomPaid = sorted.slice(-3).reverse().map(s => ({
    name: s.name,
    amount: s.amount
  }));

  // 5. ANOMALIES
  const anomalies: Anomaly[] = [];

  Object.entries(paymentCount).forEach(([id, count]) => {
    if (count > 1) {
      anomalies.push({
        type: "DUPLICATE",
        message: `Multiple payments detected for user ID ${id}`,
        severity: count > 2 ? "high" : "medium"
      });
    }
  });

  currentPayments.forEach(p => {
    const entity = p.teacher || p.staff;
    if (!entity) return;

    const diff = p.amount - (entity.salary || 0);

    if (diff !== 0) {
      anomalies.push({
        type: "MISMATCH",
        message: `${entity.name}: Paid ${p.amount} vs Base ${entity.salary} (${diff > 0 ? "+" : ""}${diff})`,
        severity: Math.abs(diff) > 200 ? "high" : "medium"
      });
    }
  });

  const paidIds = new Set(currentPayments.map(p => p.teacherId || p.staffId));

  allTeachers.forEach(t => {
    if (!paidIds.has(t.id)) {
      anomalies.push({
        type: "UNPAID",
        message: `Unpaid Teacher: ${t.name} ${t.surname}`,
        severity: "high"
      });
    }
  });

  allStaff.forEach(s => {
    if (!paidIds.has(s.id)) {
      anomalies.push({
        type: "UNPAID",
        message: `Unpaid Staff: ${s.name} ${s.surname}`,
        severity: "high"
      });
    }
  });

  // 6. INSIGHTS
  const insights: string[] = [];

  const lastMonthTotal = lastMonthPayments._sum.amount || 0;
  if (lastMonthTotal > 0) {
    const change = ((totalSalaryExpenses - lastMonthTotal) / lastMonthTotal) * 100;
    insights.push(`Payroll has ${change >= 0 ? "increased" : "decreased"} by ${Math.abs(change).toFixed(1)}% compared to last month.`);
  }

  const totalTuition = studentTuition._sum.amount || 0;
  const totalOtherIncome = generalIncomes.reduce((acc, curr) => acc + (curr._sum?.amount || 0), 0);
  const totalIncome = totalTuition + totalOtherIncome;
  
  const totalOtherExpense = generalExpenses.reduce((acc, curr) => acc + (curr._sum?.amount || 0), 0);
  const totalExpense = totalSalaryExpenses + totalOtherExpense;

  const netPerformance = totalIncome - totalExpense;
  const margin = totalIncome > 0 ? (netPerformance / totalIncome) * 100 : 0;

  return {
    month: monthLabel,
    metrics: {
      totalSalaryExpenses,
      totalTeachersPaid,
      averageSalary,
      totalTuitionIncome: totalTuition,
      totalGeneralExpenses: totalOtherExpense,
      netPerformance,
      unpaidArrears: unpaidAmount._sum.amount || 0,
      margin
    },
    individualSalaries,
    incomeBreakdown: generalIncomes.map(i => ({ category: i.category, amount: i._sum?.amount || 0 })),
    expenseBreakdown: generalExpenses.map(e => ({ category: e.category, amount: e._sum?.amount || 0 })),
    topPaid,
    bottomPaid,
    anomalies,
    insights
  };
}

export async function getAIFinancialReport(reportData: any): Promise<string> {
  try {
    const prompt = `
You are SnapAssistant, a world-class Financial Strategist and Chief Financial Officer (CFO) for SnapSchool.

YOUR OBJECTIVE:
Generate a high-density, professional "Executive Fiscal Review" that looks and feels like it came from a top-tier management consultancy (e.g., McKinsey/BCG).

TONE & STYLE:
- **Institutional & Analytical**: Be precise, clinical, and data-driven. Avoid "fluff" or generic praise.
- **Decision-Ready**: Every paragraph should help the school director make a choice.
- **Structural Density**: Use nested bullet points and bolding for key metrics.
- **Minimalist Formatting**: Use the provided Markdown sections. Avoid excessive emojis within the body text.

DATA (JSON Context):
${JSON.stringify(reportData, null, 2)}

---

REPORT SECTIONS:

### 1. EXECUTIVE SUMMARY & STRATEGIC POSITIONING
- High-level overview of monthly unit economics.
- Clear statement on the current "Business Health" (Vulnerable, Stable, or Growth-Ready).
- Highlight the **Single Most Important Metric** for this month.

### 2. REVENUE OPTIMIZATION & LEAKAGE
- Analyze Tuition vs General Income.
- Identify "Revenue Leakage" points (e.g., impact of arrears/unpaid fees).
- Identify enrollment/occupancy trends if data allows.

### 3. OPERATIONAL EFFICIENCY & RUN-RATE
- Detailed breakdown of Payroll vs Fixed Expenses.
- Analyze the "Burn Rate" and operational leverage.
- Highlight specific categories where "Efficiency Gains" are possible.

### 4. LIQUIDITY & WORKING CAPITAL
- Direct comment on **Cash-on-Hand** and liquidity risks.
- Analyze how Arrears are choking growth or operational flexibility.
- Propose specific liquidity-saving measures.

### 5. BREAK-EVEN & PROFITABILITY MILESTONES
- Quantify how far the school is from its next major profitability milestone.
- Describe the "Critical Path" to increasing net margins.

### 6. SCENARIO & STRESS TESTING
- Perform a "What-If" Analysis (e.g., "If 10% of students default on tuition, the impact is $X").
- Identify specific risks categorized by severity.

### 7. STRATEGIC GROWTH LEVERS
- What is the "Core Driver" of the business right now?
- How can the school capitalize on its current strengths?

### 8. MANDATORY TACTICAL ACTIONS
Provide 5–8 clear, high-impact actions. Format each as:
1. **[ACTION TITLE]**: Concise description of the execution step.
    - **Expected Outcome**: Quantify (e.g., "Reduce payroll overhead by 5%").
    - **Urgency**: [High / Medium / Low].

---

CRITICAL RULES:
- **DO NOT use Markdown tables.** Use clean, structured bullet lists only.
- **NO HIGHLIGHTER STYLES**: Use Bold text only for emphasis.
- **DRY (Don't Repeat Yourself)**: If a metric is in one section, don't repeat it elsewhere unless for comparison.
- **PROFESSIONAL BOLDING**: Bold key numbers (percentages, currency) to make the report "scannable."

OUTPUT:
Return only the final professional Markdown report.
    `;

    return await callGeminiDirect(prompt);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `### AI Analysis Error\n\nThere was an issue generating the professional report: ${error?.message || "Unknown error"}. Please check your configuration.`;
  }
}