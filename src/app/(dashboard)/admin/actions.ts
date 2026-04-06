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
You are a senior business consultant and financial strategist specializing in SaaS, education businesses, and financial modeling.

You are analyzing structured business data for SnapSchool (a school management SaaS).

Your objective is to generate a HIGH-QUALITY, INVESTOR-GRADE business report with deep insights, clear reasoning, and actionable decisions.

INPUT DATA:
${JSON.stringify(reportData, null, 2)}

---

INSTRUCTIONS:

Generate a comprehensive report with the following sections:

### 1. EXECUTIVE SUMMARY & BUSINESS HEALTH

* Provide a clear assessment: **Growing, Stable, or Declining**
* Quantify performance using key numbers (%, growth rates, totals)
* Evaluate **path to profitability** and operational leverage
* Highlight 2–3 critical insights that matter most

---

### 2. CORE REVENUE ANALYSIS

* Break down revenue streams (Tuition, Enrollment, Extra)
* Analyze **Occupancy Rate vs Capacity**
* Identify revenue drivers using numbers (e.g., “80% of revenue comes from X”)
* Detect unrealistic or risky assumptions

---

### 3. FINANCIAL PERFORMANCE & PROFITABILITY

* Analyze Revenue, Expenses, Profit
* Evaluate margins (Gross, EBITDA if available)
* Identify cost inefficiencies (with estimated % impact)
* Comment on scalability of the model

---

### 4. CASH FLOW & LIQUIDITY

* Identify **cash flow risks or gaps**
* Analyze impact of unpaid fees (arrears)
* Estimate liquidity pressure (low / medium / high)
* Suggest financial protections (specific, not generic)

---

### 5. BREAK-EVEN & PROFITABILITY PATH

* Estimate how far the business is from break-even
* Identify key variables needed to reach it (e.g., +15% occupancy)
* Provide timeline assumptions if possible

---

### 6. SCENARIO & RISK ANALYSIS

* Perform at least ONE quantitative scenario:
  Example: “If occupancy drops 10%, revenue decreases by X%”
* Identify top 3 risks and explain:

  * Root cause
  * Impact
  * Likelihood

---

### 7. STRATEGIC INSIGHTS (DEEP ANALYSIS)

* Identify the TRUE drivers of the business (core levers)
* Explain WHY performance is what it is (root-cause thinking)
* Highlight hidden opportunities (e.g., pricing, utilization, upsells)

---

### 8. ACTIONABLE RECOMMENDATIONS (CRITICAL SECTION)

Provide 5–10 high-impact actions.

Each recommendation MUST include:

* Action (clear and specific)
* Expected Impact (quantified if possible: %, revenue, cost)
* Priority (High / Medium / Low based on impact vs effort)

Focus on:

* Increasing revenue
* Reducing costs
* Improving efficiency

---

### 9. FINAL VERDICT & NEXT STEPS

* Should the business continue current strategy?
* What are the TOP 3 priorities for next month?

---

RULES:

* Use NUMBERS wherever possible (%, amounts, trends)
* Avoid generic statements
* Be concise but insightful
* Think like an investor + CEO advisor
* If data is missing, make reasonable assumptions and state them
* Prioritize depth over length

OUTPUT:
Return a clean, well-structured Markdown report.

    `;

    return await callGeminiDirect(prompt);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return `### AI Analysis Error\n\nThere was an issue generating the professional report: ${error?.message || "Unknown error"}. Please check your configuration.`;
  }
}