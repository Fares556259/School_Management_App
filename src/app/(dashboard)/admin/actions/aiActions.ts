"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";

// DIRECT FETCH IMPLEMENTATION WITH MULTI-MODEL FALLBACK
async function callGeminiDirect(prompt: string) {
    if (!apiKey) throw new Error("Missing API Key");

    // GEMINI 2.0 FLASH is confirmed fast and available for this key
    const models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
    let lastError = "";

    for (const modelName of models) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            // Add abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 1024,
                    }
                })
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
                    return data.candidates[0].content.parts[0].text;
                }
            } else {
                const errorData = await response.json();
                lastError = errorData?.error?.message || response.statusText;
                console.log(`Model ${modelName} failed: ${lastError}`);
            }
        } catch (e: any) {
            lastError = e.message;
            console.log(`Model ${modelName} encountered error: ${lastError}`);
        }
    }

    throw new Error(`All Gemini models failed. Last error: ${lastError}`);
}

export async function getFinancialInsights(data: {
    income: number;
    expense: number;
    breakdown: { name: string, value: number, type: 'income' | 'expense' }[];
    prevIncome: number;
    month: string;
}) {
    if (!apiKey) {
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

        const text = await callGeminiDirect(prompt);
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error("Gemini AI Error:", error);
        return { error: "AI Failed", fallback: true };
    }
}

export async function getChatResponse(message: string, context: any) {
    if (!apiKey) {
        return { error: "Missing API Key" };
    }

    try {
        const prompt = `
            You are "SnapAssistant", the dedicated AI financial advisor for SnapSchool.
            
            OFFICIAL SCHOOL DATA (CONTEXT):
            ${JSON.stringify(context, null, 2)}
            
            USER MESSAGE:
            "${message}"
            
            GUIDELINES:
            1. Be professional, friendly, and concise.
            2. Use the provided financial and operational data to answer accurately.
            
            Format your response as a JSON object: { "response": "Your markdown response here" }
        `;

        const text = await callGeminiDirect(prompt);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        
        return JSON.parse(cleanJson);
    } catch (error: any) {
        const errorMsg = error?.message || "Unknown error";
        console.error("SnapAssistant Error:", error);
        return { error: `Assistant Error: ${errorMsg}` };
    }
}
