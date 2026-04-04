"use server";

import prisma from "@/lib/prisma";

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
  };
  individualSalaries: { name: string; amount: number; baseSalary: number }[];
  topPaid: { name: string; amount: number }[];
  bottomPaid: { name: string; amount: number }[];
  anomalies: Anomaly[];
  insights: string[];
}

export async function getFinancialReportData(monthLabel: string): Promise<ReportData> {
  const [monthName, yearStr] = monthLabel.split(" ");
  const MONTHS = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];

  const monthIdx = MONTHS.indexOf(monthName) + 1;
  const yearVal = parseInt(yearStr);

  const prevMonthIdx = monthIdx === 1 ? 12 : monthIdx - 1;
  const prevYearVal = monthIdx === 1 ? yearVal - 1 : yearVal;

  // 1. FETCH DATA
  const [currentPayments, lastMonthPayments, allTeachers, allStaff] = await prisma.$transaction([
    prisma.payment.findMany({
      where: {
        month: monthIdx,
        year: yearVal,
        status: "PAID",
        userType: { in: ["TEACHER", "STAFF"] }
      },
      include: { teacher: true, staff: true }
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        month: prevMonthIdx,
        year: prevYearVal,
        status: "PAID",
        userType: { in: ["TEACHER", "STAFF"] }
      }
    }),
    prisma.teacher.findMany(),
    prisma.staff.findMany()
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

    insights.push(
      `Payroll has ${change >= 0 ? "increased" : "decreased"} by ${Math.abs(change).toFixed(1)}% compared to last month.`
    );
  } else {
    insights.push("No previous payroll data available for comparison.");
  }

  const teacherCosts = totalTeacherSalary;
  const staffCosts = totalSalaryExpenses - teacherCosts;

  if (totalSalaryExpenses > 0) {
    insights.push(
      `Teachers account for ${((teacherCosts / totalSalaryExpenses) * 100).toFixed(1)}% of payroll.`
    );
  }

  if (anomalies.filter(a => a.severity === "high").length > 2) {
    insights.push("High payroll risk detected due to multiple critical anomalies.");
  } else {
    insights.push("Payroll system appears stable with minor inconsistencies.");
  }

  return {
    month: monthLabel,
    metrics: {
      totalSalaryExpenses,
      totalTeachersPaid,
      averageSalary
    },
    individualSalaries,
    topPaid,
    bottomPaid,
    anomalies,
    insights
  };
}

export async function getAIFinancialReport(reportData: any): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE" || !apiKey.startsWith("AIza")) {
    return "### AI Analysis Unavailable\n\nAPI Key not configured. Please add a valid **GEMINI_API_KEY** to your `.env` file to enable professional fiscal insights.";
  }

  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
You are a senior financial analyst specialized in private school management.

You are given structured payroll data for a specific month in JSON format.

Your task is to generate a clear, professional, and concise financial report.

INPUT DATA:
${JSON.stringify(reportData, null, 2)}

---

INSTRUCTIONS:

1. Write a well-structured report with the following sections (use Markdown formatting):

### 1. Executive Summary
### 2. Key Metrics
### 3. Top & Bottom Paid Staff
### 4. Anomalies & Risks
### 5. Financial Insights
### 6. Recommendations

---

RULES:
* Be concise but insightful
* Use bullet points where appropriate
* Do NOT repeat raw data — interpret it
* Use a professional tone (like a real CFO report)
* If anomalies are critical, emphasize urgency

OUTPUT:
Return only the final report text in Markdown format (no title, no JSON, no explanations).
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "### AI Analysis Error\n\nThere was an issue generating the professional report. Please check your network connection or API quota.";
  }
}