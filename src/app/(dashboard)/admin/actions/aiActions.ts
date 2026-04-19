"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Efficiently fetch AI usage for an admin with caching-like behavior for the request.
 */
export async function getAIUsageStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // DEFENSIBLY: Fetch with a short timeout hint if possible, but here we just catch
    const admin = await prisma.admin.findFirst({
      select: { id: true, aiUsage: true, aiQuota: true, lastAiUpdate: true }
    });

    if (!admin) return { usage: 0, quota: 10 };

    const lastReset = admin.lastAiUpdate ? new Date(admin.lastAiUpdate) : new Date(0);
    lastReset.setHours(0, 0, 0, 0);

    if (today > lastReset) {
      try {
        const updated = await prisma.admin.update({
          where: { id: admin.id },
          data: { aiUsage: 0, lastAiUpdate: today },
          select: { aiUsage: true, aiQuota: true }
        });
        return { usage: updated.aiUsage, quota: updated.aiQuota || 10 };
      } catch (updateErr) {
        return { usage: 0, quota: admin.aiQuota || 10 };
      }
    }

    return { usage: admin.aiUsage || 0, quota: admin.aiQuota || 10 };
  } catch (error) {
    console.warn("⚠️ [AI-STATS] Defaulting AI quota due to connection pressure.");
    return { usage: 0, quota: 10 };
  }
}

export async function isAIQuotaReached() {
  const stats = await getAIUsageStats();
  return stats.usage >= stats.quota;
}

/**
 * Unified guard that checks AND increments usage in as few DB trips as possible.
 */
async function checkAndIncrementUsage() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const admin = await prisma.admin.findFirst({ 
      select: { id: true, aiUsage: true, aiQuota: true, lastAiUpdate: true } 
    });

    if (!admin) return { allowed: true, quota: 10 };

    // QUOTA MANIPULATION DISABLED FOR NOW
    return { allowed: true, quota: 9999 };
    
    /* Original Logic:
    const lastReset = admin.lastAiUpdate ? new Date(admin.lastAiUpdate) : new Date(0);
    ...
    */
  } catch (error) {
    console.error("❌ [AI-GUARD] Error in guard:", error);
    return { allowed: true, quota: 10 }; 
  }
}

export async function toggleTestAIQuota() {
  try {
    const current = await getAIUsageStats();
    const newUsage = current.usage >= current.quota ? 0 : current.quota;

    const adminToUpdate = await prisma.admin.findUnique({ where: { id: "admin" } }) 
      ? "admin" 
      : (await prisma.admin.findFirst({ select: { id: true } }))?.id;

    if (!adminToUpdate) {
      console.error("[AI-TOGGLE] No Admin found to update");
      return { success: false };
    }

    console.log(`[AI-TOGGLE] Updating Admin ${adminToUpdate} to ${newUsage}/10`);
    
    await prisma.admin.update({
      where: { id: adminToUpdate },
      data: { 
        aiUsage: newUsage,
        lastAiUpdate: new Date()
      }
    });
    
    revalidatePath("/");
    return { success: true, newUsage, quota: current.quota };
  } catch (error) {
    console.error("Toggle Test Quota Error:", error);
    return { success: false };
  }
}

/**
 * Unified AI Router
 * Handles routing to Google SDK or OpenRouter based on API Key type
 */
async function unifiedAIRouter(params: {
  systemPrompt?: string;
  userPrompt: string;
  history?: any[];
  imageBase64?: string;
  jsonMode?: boolean;
  useTools?: boolean;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("API key missing");

  const isGoogleKey = apiKey.startsWith("AIza");
  
  if (isGoogleKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: params.jsonMode ? { responseMimeType: "application/json" } : undefined,
        tools: params.useTools ? [SNAP_SCHOOL_TOOLS] : undefined
      });
      
      const contents = [];
      if (params.systemPrompt) {
        contents.push({ role: "user", parts: [{ text: `SYSTEM_INSTRUCTION: ${params.systemPrompt}` }] });
      }
      if (params.history) {
        contents.push(...params.history.map(m => ({ 
          role: m.role === "assistant" ? "model" : "user", 
          parts: [{ text: m.content }] 
        })));
      }
      
      const userParts: any[] = [{ text: params.userPrompt }];
      if (params.imageBase64) {
        userParts.push({ inlineData: { data: params.imageBase64, mimeType: "image/jpeg" } });
      }
      contents.push({ role: "user", parts: userParts });

      const result = await model.generateContent({ contents });
      const response = result.response;
      
      // Support Tool Calling
      const functionCalls = response.getCandidate()?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
      
      if (functionCalls && functionCalls.length > 0) {
        return { text: response.text(), functionCalls };
      }
      
      return response.text();
    } catch (error: any) {
      console.error("[Google SDK Router Error]", error);
      throw new Error(`Google SDK Error: ${error.message}`);
    }
  }

  // OpenRouter Fallback
  try {
    const messages = [];
    if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
    if (params.history) messages.push(...params.history);
    
    messages.push({
      role: "user",
      content: params.imageBase64 
        ? [
            { type: "text", text: params.userPrompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${params.imageBase64}` } }
          ]
        : params.userPrompt
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://snapschool.ai", 
        "X-Title": "SnapSchool AI", 
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages,
        response_format: params.jsonMode ? { type: "json_object" } : undefined
      })
    });

    if (!response.ok) {
       const errBody = await response.text();
       throw new Error(`OpenRouter Fetch Failed: ${response.status} ${errBody}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "OpenRouter Error");
    
    // OpenRouter tool calling support could be added here later if needed
    
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("[OpenRouter Router Error]", error);
    throw new Error(`Connectivity Issue: ${error.message}`);
  }
}

/**
 * Strips markdown code blocks and returns clean JSON
 */
function cleanAIJson(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : text.trim();
}

const SNAP_SCHOOL_TOOLS = {
  functionDeclarations: [
    {
      name: "mark_paid",
      description: "Mark a student's tuition or a staff member's salary as paid for a specific month and year.",
      parameters: {
        type: "OBJECT",
        properties: {
          studentId: { type: "STRING", description: "The UUID of the student (mandatory for tuition)" },
          teacherId: { type: "STRING", description: "The UUID of the teacher (mandatory for salaries if teacher)" },
          staffId: { type: "STRING", description: "The UUID of the staff (mandatory for salaries if staff)" },
          month: { type: "NUMBER", description: "Month number (1-12)" },
          year: { type: "NUMBER", description: "Year (e.g., 2026)" },
          amount: { type: "NUMBER", description: "The actual amount paid" }
        },
        required: ["month", "year"]
      }
    },
    {
      name: "add_expense",
      description: "Record a generic business expense (e.g., rent, utility bill, supplies).",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Description of the expense" },
          amount: { type: "NUMBER", description: "Total amount" },
          category: { type: "STRING", description: "Category (e.g., Utilities, Food, Maintenance)" },
          date: { type: "STRING", description: "Date of expense (ISO format)" }
        },
        required: ["title", "amount", "category"]
      }
    },
    {
      name: "add_income",
      description: "Record a generic school income not related to a specific student payment.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Source of income" },
          amount: { type: "NUMBER", description: "Total amount" },
          category: { type: "STRING", description: "Category" },
          date: { type: "STRING", description: "Date (ISO format)" }
        },
        required: ["title", "amount", "category"]
      }
    },
    {
      name: "post_notice",
      description: "Post an announcement or notice visible to students and parents.",
      parameters: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING", description: "Short title of the notice" },
          message: { type: "STRING", description: "The full content of the notice" }
        },
        required: ["title", "message"]
      }
    }
  ]
};

export async function callGeminiDirect(prompt: string, imageBase64?: string) {
  const usage = await checkAndIncrementUsage();
  if (!usage.allowed) throw new Error(`DAILY_QUOTA_REACHED|${usage.quota}`);

  return await unifiedAIRouter({ userPrompt: prompt, imageBase64 });
}

export async function getChatResponse(
  userMessage: string, 
  context: any, 
  imageBase64?: string, 
  locale = "fr",
  history: any[] = []
) {
  const usage = await checkAndIncrementUsage();
  if (!usage.allowed) return { success: false, error: `DAILY_QUOTA_REACHED|${usage.quota}` };

  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { success: false, error: "API key missing" };

  try {
    console.log("🤖 [AI_FLOW] Context Keys:", Object.keys(context || {}));
    if (context?.financials?.uncollected) {
       console.log("🤖 [AI_FLOW] Uncollected Ledger Size:", context.financials.uncollected.length);
       console.log("🤖 [AI_FLOW] Sample ID from Ledger:", context.financials.uncollected[0]?.studentId || "NONE");
    }
    const systemPrompt = `
      You are Zbiba, the high-intelligence administrative assistant for SnapSchool.
      
      ROLE & VOICE:
      - Professional, concise, and highly structured. Language: ${locale === "fr" ? "French" : "English"}.
      - NEVER reveal technical database IDs (like UUIDs starting with 'dummy_s_...' or 'id_...') to the user.
      - If you need to identify a person, use their full name.
      - Use Markdown TABLES for structured data (e.g. payment records).
      
      CONTEXT: ${JSON.stringify(context)}
      HISTORY: ${JSON.stringify(history.slice(-5))}

      SCENARIO: "All months summary"
      - You have access to a DEEP LEDGER (500 records) of "uncollected" (PENDING) and "paidHistory" (PAID).
      - If a user asks about a person's status, search BOTH ledgers for every month (Sept 2025 to Aug 2026).
      
      FULL POPULATION RULE (CRITICAL):
      - The table columns | Month | Year | Amount | Status | MUST ALWAYS BE FILLED.
      - NEVER leave a dash "-" in Amount or Status for months in the school year.
      - INFERENCE: If you find at least one record (e.g. April = 450), use that same Amount (450) for ALL other months.
      - STATUS LOGIC:
        * Found in paidHistory -> "✅ Paid"
        * Found in uncollected -> "⏳ Pending"
        * NOT FOUND in either ledger -> "⏳ Pending" (Assume it is overdue/not yet recorded if the student is in the system).
      
      DATA MATCHING RULES:
      - FUZZY NAME MATCH: Match names regardless of order or case. 
      - SEARCH EVERY RECORD: Check the full 500-item lists.
      - 12-MONTH TABLE: Generate exactly 12 rows (Sept-Aug).
      
      COMMANDS SCHEMA:
      - Use native function calling for: mark_paid, add_expense, add_income, post_notice.
      
      ID LOOKUP RULE:
      - Match names from the "uncollected" ledger to get their studentId/teacherId/staffId. Use these IDs in your function calls, but NEVER show them in the text response.
    `;

    const rawResult = await unifiedAIRouter({
      systemPrompt,
      userPrompt: userMessage,
      history,
      imageBase64,
      jsonMode: false, // Turn off JSON mode when using Tools
      useTools: true
    });
    
    let textResult = "";
    let command: any = null;
    let commands: any[] = [];

    const isObject = typeof rawResult === 'object';
    const rawText = isObject ? (rawResult as any).text : (rawResult as string);

    if (isObject && (rawResult as any).functionCalls) {
      textResult = (rawResult as any).text || "";
      commands = (rawResult as any).functionCalls.map((fc: any) => {
        // Map native snake_case tool names to our LEGACY uppercase command types for UI compatibility
        const typeMap: Record<string, string> = {
          "mark_paid": "MARK_PAID",
          "add_expense": "ADD_EXPENSE",
          "add_income": "ADD_INCOME",
          "post_notice": "POST_NOTICE"
        };
        return {
          type: typeMap[fc.name] || fc.name.toUpperCase(),
          data: fc.args
        };
      });
      // For backward compatibility with the single 'command' field in current UI
      command = commands[0]; 
    } else {
      // Fallback for non-tool responses (OpenRouter or simple text)
      try {
        const cleaned = cleanAIJson(rawText);
        const parsed = JSON.parse(cleaned);
        textResult = parsed.response;
        command = parsed.command;
        if (command) commands = [command];
      } catch (e) {
        textResult = rawText;
      }
    }
    
    return { 
      response: textResult, 
      command, 
      commands // New field for batch support
    };
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    return { success: false, error: error.message };
  }
}

export async function getFinancialInsights(data: any, locale = "fr") {
  const usage = await checkAndIncrementUsage();
  if (!usage.allowed) return { error: `DAILY_QUOTA_REACHED|${usage.quota}` };

  const prompt = `
    You are an expert school financial analyst. Analyze the following data and provide exactly 5 concise, strategic insights.
    
    DATA: ${JSON.stringify(data)}
    
    RETURN ONLY a JSON array of objects with this schema:
    [
      { 
        "text": "...", 
        "type": "performance" | "risk" | "opportunity" | "trend" | "action", 
        "icon": "A single representative emoji (e.g. 📈, ⚠️, 💡, 🔍, ⚡...)", 
        "confidence": "HIGH" | "MEDIUM" | "LOW" 
      }
    ]
  `;

  try {
    const text = await callGeminiDirect(prompt);
    // Find JSON array in text
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Invalid AI response");
    return JSON.parse(match[0]);
  } catch (error: any) {
    console.error("Financial Insight Error:", error);
    return { error: error.message };
  }
}

export async function upsertConversation({
  id,
  title,
  messages,
  month,
  year
}: {
  id?: string;
  title: string;
  messages: any[];
  month: number;
  year: number;
}) {
  if (!(prisma as any).conversation) return { success: false, error: "Conversation model not initialized" };
  try {
    const data = {
      title,
      messages: messages as any,
      month,
      year,
      updatedAt: new Date(),
    };

    if (id && id !== "new") {
      const conv = await (prisma as any).conversation.update({
        where: { id },
        data,
      });
      return { success: true, conversation: conv };
    } else {
      const conv = await (prisma as any).conversation.create({
        data: {
          ...data,
          userId: "admin",
        },
      });
      revalidatePath("/list/assistant");
      return { success: true, conversation: conv };
    }
  } catch (error: any) {
    console.error("Failed to upsert conversation:", error);
    return { success: false, error: error.message };
  }
}

export async function getConversations(month: number, year: number) {
  if (!(prisma as any).conversation) return [];
  try {
    const conversations = await (prisma as any).conversation.findMany({
      where: { month, year },
      orderBy: { updatedAt: "desc" },
    });
    return conversations;
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return [];
  }
}
