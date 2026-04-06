"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";

// DIRECT FETCH IMPLEMENTATION WITH MULTI-MODEL FALLBACK AND OPENROUTER SUPPORT
export async function callGeminiDirect(prompt: string, base64Image?: string) {
    if (!apiKey) throw new Error("Missing API Key");

    const isOpenRouter = apiKey.startsWith("sk-or-");
    
    // If it's an OpenRouter key, use their OpenAI-compatible endpoint
    if (isOpenRouter) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://snapschool.app", // Optional
                    "X-Title": "SnapSchool Admin", // Optional
                },
                body: JSON.stringify({
                    model: "google/gemini-2.0-flash-001",
                    messages: [{ 
                        role: "user", 
                        content: base64Image 
                            ? [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                              ]
                            : prompt 
                    }],
                    temperature: 0.7,
                })
            });

            if (response.ok) {
                const data = await response.json();
                return data.choices[0]?.message?.content || "";
            } else {
                const errorData = await response.json();
                throw new Error(errorData?.error?.message || response.statusText);
            }
        } catch (e: any) {
            throw new Error(`OpenRouter failed: ${e.message}`);
        }
    }

    // ORIGINAL GOOGLE GEMINI FLOW
    const models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
    let lastError = "";

    for (const modelName of models) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal,
                body: JSON.stringify({
                    contents: [{ 
                        parts: [
                            { text: prompt },
                            ...(base64Image ? [{
                                inline_data: {
                                    mime_type: "image/jpeg",
                                    data: base64Image
                                }
                            }] : [])
                        ] 
                    }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 1024 }
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
    dailyData?: { date: string, income: number, expense: number }[];
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
            
            ${data.dailyData ? `DAILY TRENDS FOR THIS MONTH: ${JSON.stringify(data.dailyData)}` : ""}

            TASK:
            Provide 4 to 6 "Smart Insights" and "Actionable Steps" for the school director.
            - Include 2-3 high-level monthly trends.
            - Include 2-3 specific "Next Steps" or "Daily Observations" based on the daily flow or category concentration.
            
            Each insight must be a JSON object with:
            - "text": The insight text (max 120 characters).
            - "type": "positive" (for good news), "warning" (for issues), "info" (for facts), or "action" (for specific steps TO DO).
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

export async function getChatResponse(message: string, context: any, base64Image?: string) {
    if (!apiKey) {
        return { error: "Missing API Key" };
    }

    try {
        const prompt = `
            You are "SnapAssistant", a highly sophisticated Senior Business Consultant and AI-Vision Financial Analyst for SnapSchool.

            YOUR CORE PHILOSOPHY:
            - You help School Directors manage operations and financials directly from this chat.
            - You can PERFORM ACTIONS in the database when the user requests them.
            - If an IMAGE is provided (receipt, invoice, or tuition slip), extract the data and return an "ADD_EXPENSE" or "MARK_PAID" command.
            
            AVAILABLE TOOLS (COMMANDS):
            1. **MARK_PAID**: To mark a Student, Teacher, or Staff pending payment as PAID.
               - Data: { "studentId"?: string, "teacherId"?: string, "staffId"?: string, "month": number, "year": number }
            2. **ADD_EXPENSE**: To record a new school expense.
               - Data: { "title": string, "amount": number, "category": string, "date"?: string }
            3. **ADD_INCOME**: To record new non-student income (donations, grants, etc.).
               - Data: { "title": string, "amount": number, "category": string, "date"?: string }
            4. **POST_NOTICE**: To publish a new announcement on the notice board.
               - Data: { "title": string, "message": string }

            OFFICIAL SCHOOL DATA (CONTEXT):
            ${JSON.stringify(context, null, 2)}
            
            USER MESSAGE:
            "${message || "Please analyze this image and extract financial data."}"
            
            GUIDELINES:
            1. If the image is NOT a financial document (receipt, invoice, tuition slip, donation), simply respond that you can only process school-related financial records for now. DO NOT return a command in this case.
            2. If it is a tuition slip, look for the student name in studentLedger and return MARK_PAID.
            3. If it's a general revenue source (donation, event gift), return ADD_INCOME.
            4. If it's a general expense receipt (electricity, supplies), return ADD_EXPENSE.
            5. If you see a document but cannot clearly read the Amount or Title, ask the user for clarification.
            6. If you generate a command, provide a brief summary of the extraction.
            7. If an image was processed and a command returned, start your response with "✅ [Document Verified]".
            8. Be professional and context-aware.
            
            FORMAT YOUR RESPONSE AS THIS JSON OBJECT:
            { 
              "response": "Brief professional confirmation or extraction summary here.",
              "command": { "type": "COMMAND_NAME", "data": { ... } } // OPTIONAL: Only if an action is requested
            }
        `;

        const text = await callGeminiDirect(prompt, base64Image);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        
        return JSON.parse(cleanJson);
    } catch (error: any) {
        const errorMsg = error?.message || "Unknown error";
        console.error("SnapAssistant Error:", error);
        return { error: `Assistant Error: ${errorMsg}` };
    }
}
