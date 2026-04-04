"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function getFinancialInsights(data: {
    income: number;
    expense: number;
    breakdown: { name: string, value: number, type: 'income' | 'expense' }[];
    prevIncome: number;
    month: string;
}) {
    if (!process.env.GOOGLE_AI_API_KEY) {
        return { error: "Missing API Key", fallback: true };
    }

    try {
        const prompt = `
            You are a professional financial analyst for a private school called "SnapSchool".
            Analyze the following financial data for the month of ${data.month}:
            - Total Revenue: $${data.income.toLocaleString()}
            - Total Expenses: $${data.expense.toLocaleString()}
            - Previous Month Revenue: $${data.prevIncome.toLocaleString()}
            - Expense Breakdown: ${JSON.stringify(data.breakdown.filter(b => b.type === 'expense'))}
            
            Provide exactly 3 or 4 short, actionable "Smart Insights" for the school director.
            Each insight must be a JSON object with:
            - "text": The insight text (max 100 characters).
            - "type": "positive" (for good news), "warning" (for issues), or "info" (for facts).
            - "icon": A single emoji representing the insight.
            
            Return ONLY a JSON array of these objects.
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, "").trim();
        
        return JSON.parse(text);
    } catch (error) {
        console.error("Gemini AI Error:", error);
        return { error: "AI Failed", fallback: true };
    }
}
