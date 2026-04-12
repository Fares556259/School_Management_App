"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || "";

// DIRECT FETCH IMPLEMENTATION WITH MULTI-MODEL FALLBACK AND OPENROUTER SUPPORT
export async function callGeminiDirect(prompt: string, base64Image?: string) {
    if (!apiKey) throw new Error("Missing API Key");

    const isOpenRouter = apiKey.startsWith("sk-or-");
    
    // If it's an OpenRouter key, use their OpenAI-compatible endpoint
    if (isOpenRouter) {
        const orModels = [
            "google/gemini-2.0-flash-001", 
            "google/gemini-2.0-flash-exp:free", 
            "google/gemini-pro-1.5", 
            "google/gemini-flash-1.5"
        ];
        let lastORError = "";

        for (const modelId of orModels) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout for OpenRouter

                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://snapschool.app",
                        "X-Title": "SnapSchool Admin",
                    },
                    signal: controller.signal,
                    body: JSON.stringify({
                        model: modelId,
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

                clearTimeout(timeoutId);

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0]?.message?.content || "";
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    lastORError = errorData?.error?.message || response.statusText;
                    console.error(`OpenRouter Model ${modelId} failed: ${lastORError}`);
                }
            } catch (e: any) {
                lastORError = e.message;
                console.error(`OpenRouter Error (${modelId}): ${lastORError}`);
            }
        }
        throw new Error(`OpenRouter failed for all fallback models. Last error: ${lastORError}`);
    }

    // ORIGINAL GOOGLE GEMINI FLOW
    const models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-pro-latest"];
    let lastError = "";

    for (const modelName of models) {
        try {
            const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s per model (36s total max)

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
}, locale: string = "en") {
    if (!apiKey) {
        return { error: "Missing API Key", fallback: true };
    }

    try {
        const langIns = locale === 'ar' ? 'Generate the insights exclusively in Arabic.' : locale === 'fr' ? 'Generate the insights exclusively in French.' : 'Generate the insights exclusively in English.';

        const prompt = `
            You are an advanced financial analyst AI embedded inside a dashboard.
            ${langIns}

            Your role is to analyze financial data and generate high-quality "Smart Insights" that are:
            * Specific
            * Data-driven
            * Actionable
            * Concise but insightful

            ---
            ### 📊 INPUT DATA:
            You will receive:
            * Total Revenue: $${data.income.toLocaleString()}
            * Total Expenses: $${data.expense.toLocaleString()}
            * Profit Margin: ${data.income > 0 ? (((data.income - data.expense) / data.income) * 100).toFixed(1) : 0}%
            * Net Balance: $${(data.income - data.expense).toLocaleString()}
            * Category breakdown: ${JSON.stringify(data.breakdown)}
            * Previous Month Revenue: $${data.prevIncome.toLocaleString()}
            * Daily Trends: ${data.dailyData ? JSON.stringify(data.dailyData) : "N/A"}

            ---
            ### 🎯 YOUR TASK:
            Generate 5–7 Smart Insights divided into these categories:
            1. 🟢 Performance
            2. 🔴 Risks
            3. 🟡 Opportunities
            4. 🔵 Trends
            5. ⚡ Actionable Steps

            ---
            ### ⚙️ RULES:
            1. ALWAYS include numbers:
               * % change (e.g., +45%)
               * absolute values (e.g., +$31,200)
               * ratios when relevant (e.g., 54% of total expenses)
            2. ALWAYS explain WHY something happened:
               * Identify main drivers (categories, dates, anomalies)
            3. ALWAYS include impact:
               * What it means for the business
            4. For at least 2 insights, include ACTIONABLE recommendations:
               * With quantified impact if possible
            5. Detect anomalies:
               * spikes, drops, unusual patterns
            6. Keep each insight under 2 lines

            ---
            ### 🧠 OUTPUT FORMAT:
            Return ONLY a JSON array like this:
            [
              {
                "type": "performance",
                "icon": "📈",
                "text": "Revenue increased by +42% (+$31,200) vs last period, mainly driven by Grants (68% of total), significantly boosting profitability.",
                "confidence": "High"
              },
              {
                "type": "risk",
                "icon": "⚠️",
                "text": "Salaries represent 54% of total expenses (+18% MoM), indicating rising fixed costs that could reduce flexibility.",
                "confidence": "Medium"
              },
              {
                "type": "opportunity",
                "icon": "💡",
                "text": "Reducing maintenance costs by 15% could improve profit margin from 75.7% to ~79%, increasing net savings.",
                "confidence": "Medium"
              },
              {
                "type": "trend",
                "icon": "📊",
                "text": "Revenue shows a strong upward trend since March, with a major spike on 2026-04-14 accounting for the monthly peak.",
                "confidence": "High"
              },
              {
                "type": "action",
                "icon": "⚡",
                "text": "Negotiate new supplier contracts to lower fixed material costs before the next fiscal quarter begins.",
                "confidence": "High"
              }
            ]

            ---
            ### ❌ AVOID:
            * Generic statements like "Revenue increased"
            * No vague language
            * No repetition
            * No long paragraphs

            ---
            ### ✅ STYLE:
            * Professional but simple
            * Clear business insights
            * Feels like a real CFO assistant
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

export async function getChatResponse(message: string, context: any, base64Image?: string, locale: string = "en") {
    if (!apiKey) {
        return { error: "Missing API Key" };
    }

    try {
        const langIns = locale === 'ar' ? 'Always respond exclusively in Arabic.' : locale === 'fr' ? 'Always respond exclusively in French.' : 'Always respond exclusively in English.';

        const prompt = `
            You are "zbiba", a highly sophisticated Senior Business Consultant and AI-Vision Financial Analyst for SnapSchool.
            ${langIns}

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
        console.error("zbiba Error:", error);
        return { error: `Assistant Error: ${errorMsg}` };
    }
}
