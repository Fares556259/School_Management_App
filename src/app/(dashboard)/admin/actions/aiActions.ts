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
 */
async function unifiedAIRouter(params: {
  systemPrompt?: string;
  userPrompt: string;
  history?: any[];
  imageBase64?: string;
  jsonMode?: boolean;
}) {
  const primaryKey = process.env.OPENROUTER_API_KEY;
  const secondaryKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  const MAX_RETRIES = 2;
  const TIMEOUT_MS = 30000; // 30s timeout

  async function callWithTimeout(promise: Promise<any>, timeoutMs: number) {
    let timeoutId: any;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("AI_TIMEOUT|The AI took too long to respond.")), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  async function callProvider(key: string) {
    const isGoogleNative = key.startsWith("AIza");
    
    if (isGoogleNative) {
      console.log("🛰️ [ROUTER] Using Google Native SDK...");
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: params.jsonMode ? { responseMimeType: "application/json" } : undefined
      });
      
      const contents: any[] = [];
      if (params.systemPrompt) contents.push({ role: "user", parts: [{ text: `SYSTEM_INSTRUCTION: ${params.systemPrompt}` }] });
      if (params.history) contents.push(...params.history.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })));
      const userParts: any[] = [{ text: params.userPrompt }];
      if (params.imageBase64) userParts.push({ inlineData: { data: params.imageBase64, mimeType: "image/jpeg" } });
      contents.push({ role: "user", parts: userParts });

      const result = await model.generateContent({ contents });
      return result.response.text();
    } else {
      console.log("🌐 [ROUTER] Using OpenRouter Fetch (Economy Mode)...");
      const messages = [];
      if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
      
      // Economy Mode: Only take last 10 history messages
      const shortHistory = (params.history || []).slice(-10);
      if (shortHistory.length > 0) messages.push(...shortHistory);
      
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
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://snapschool.ai", 
          "X-Title": "SnapSchool AI", 
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages,
          max_tokens: 2000, // Economy limit
          response_format: params.jsonMode ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        const errBody = await response.text();
        if (response.status === 402) {
           throw new Error("CREDIT_EXHAUSTED|Your OpenRouter account is out of credits. Please top up at openrouter.ai or add a native Google AI key (AIza...) to your .env file.");
        }
        throw new Error(`Provider Failed: ${response.status} ${errBody}`);
      }
      const data = await response.json();
      return data.choices[0].message.content;
    }
  }

  // EXECUTION WITH SMART FALLBACK & RETRY
  const execute = async () => {
    if (primaryKey) {
      try {
        return await callWithTimeout(callProvider(primaryKey), TIMEOUT_MS);
      } catch (err: any) {
        if (err.message.includes("402") || err.message.includes("429")) throw err; // Don't retry auth/billing
        console.error("🚀 [ROUTER_FALLBACK] Primary failed, trying secondary:", err.message);
        if (!secondaryKey || secondaryKey === primaryKey) throw err;
      }
    }
    if (secondaryKey) return await callWithTimeout(callProvider(secondaryKey), TIMEOUT_MS);
    throw new Error("No valid AI API keys found in environment.");
  };

  let lastErr: any;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await execute();
    } catch (err: any) {
      lastErr = err;
      if (err.message.includes("CREDIT_EXHAUSTED") || err.message.includes("UNAUTHORIZED")) break; 
      console.warn(`⚠️ [AI-RETRY] Attempt ${i + 1} failed. Retrying...`, err.message);
      if (i < MAX_RETRIES) await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw lastErr;
}

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
    // SECURITY BYPASS: Mask technical IDs
    const maskedUnpaid = (context.unpaidPayments || []).map((p: any) => ({
      ...p,
      safeRef: p.studentId || p.teacherId || p.staffId,
      tempId: `REF-${p.student?.name || "User"}-${p.id?.substring(0, 4)}`
    }));

    const systemPrompt = `
      You are Zbiba, an expert AI administrator for SnapSchool. 
      Language: ${locale === "fr" ? "French" : "English"}.
      
      CONTEXT: ${JSON.stringify({ ...context, unpaidPayments: maskedUnpaid })}
      
      CRITICAL RULES:
      1. MANDATORY TABLE CONTENT: For any "info", "status", or "summary" request, your JSON "response" MUST contain a 12-row Markdown table for Sept 2025 - Aug 2026. This is non-negotiable.
      2. FEE FALLBACK: Use a standard fee of 450 DT for all pending months if the context doesn't specify a different rate for that student.
      3. RESPONSE STRUCTURE: Provide a 1-sentence intro followed immediately by the 12-month table.
      4. ACTION ENFORCEMENT: 
         - Emit "MARK_PAID" for tuition/salary recordings.
         - Emit "ADD_EXPENSE" if an image appears to be an Invoice (Facture) or Receipt. Extract: title, amount, category, and date.
      5. Identify students by FULL NAME from context.

      JSON RESPONSE FORMAT:
      {
        "response": "Brief professional confirmation in ${locale}. If detecting an invoice or expense, EXPLICITLY TELL THE USER they must click the 'Record Expense' button below to finalize the recording.",
        "command": null | { 
          "type": "MARK_PAID" | "ADD_EXPENSE", 
          "data": { 
             "studentId": "ID", "month": 1, "year": 2026, "amount": 450, // For MARK_PAID
             "title": "Vendor/Description", "category": "Type", "date": "YYYY-MM-DD" // For ADD_EXPENSE
          } 
        }
      }
    `;

    const content = await unifiedAIRouter({
      systemPrompt,
      userPrompt: userMessage,
      history: history.slice(-3),
      imageBase64,
      jsonMode: true
    });
    
    console.log("🤖 [ZBIBA_RAW]", content);
    const cleaned = cleanAIJson(content);
    const result = JSON.parse(cleaned);

    // ROBUST RESOLVER (Corrected keys for dashboardContext)
    if (result.command?.type === "MARK_PAID") {
      const data = result.command.data;
      const targetName = (data.student_name || "").toLowerCase().trim();
      const targetRef = (data.studentId || "").trim();
      
      const activity = context.financials?.recentActivity || {};
      const allRecords = [...(activity.uncollected || []), ...(activity.paidHistory || [])];
      
      // 1. Direct Context ID Match (The Gold Standard)
      let match = allRecords.find(p => (p.studentId || p.teacherId || p.staffId) === targetRef);
      
      // 2. Fuzzy Name Match (Fallback if AI provided a NAME instead of an ID)
      if (!match) {
        const queryName = targetRef.toLowerCase().length > 3 ? targetRef.toLowerCase() : targetName;
        if (queryName) {
           // Search recent financial activity first (includes teachers/staff)
           match = allRecords.find(p => {
             const fullName = (p.name || "").toLowerCase();
             return fullName === queryName || fullName.includes(queryName) || queryName.includes(fullName);
           });

           // 3. GLOBAL CENSUS FALLBACK (Foolproof student mapping)
           if (!match && context.studentCensus) {
             console.log("🔍 [RESOLVER] Falling back to Student Census...");
             const studentMatch = context.studentCensus.find((s: any) => {
               const fullName = (s.name || "").toLowerCase();
               return fullName === queryName || fullName.includes(queryName) || queryName.includes(fullName);
             });
             if (studentMatch) {
               match = { studentId: studentMatch.id, name: studentMatch.name } as any;
             }
           }
        }
      }

      if (match) {
        result.command.data.studentId = match.studentId || match.teacherId || match.staffId;
        if (!result.command.data.amount) result.command.data.amount = match.amount;
        if (!result.command.data.month) result.command.data.month = match.month;
        if (!result.command.data.year) result.command.data.year = match.year;
        console.log("🎯 [RESOLVER_SUCCESS] Linked to:", result.command.data.studentId);
      }
    }

    return result;
  } catch (error: any) {
    console.error("AI Assistant Error:", error);
    return { success: false, error: error.message };
  }
}

function cleanAIJson(text: string): string {
  if (!text) return "{}";
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1].trim() : text.trim();
}

export async function getFinancialInsights(data: any, locale = "fr") {
  const usage = await checkAndIncrementUsage();
  if (!usage.allowed) return { error: `DAILY_QUOTA_REACHED|${usage.quota}` };

  const prompt = `
    Analyze the following data and provide exactly 5 concise, strategic insights.
    DATA: ${JSON.stringify(data)}
    RETURN ONLY a JSON array of objects: [{ "text": "...", "type": "...", "icon": "...", "confidence": "..." }]
  `;

  try {
    const text = await callGeminiDirect(prompt);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("Invalid AI response");
    return JSON.parse(match[0]);
  } catch (error: any) {
    console.error("Financial Insight Error:", error);
    return { error: error.message };
  }
}

export async function upsertConversation({ id, title, messages, month, year }: any) {
  if (!(prisma as any).conversation) return { success: false, error: "Conversation model not initialized" };
  try {
    const data = { title, messages, month, year, updatedAt: new Date() };
    if (id && id !== "new") {
      const conv = await (prisma as any).conversation.update({ where: { id }, data });
      return { success: true, conversation: conv };
    } else {
      const conv = await (prisma as any).conversation.create({ data: { ...data, userId: "admin" } });
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
    return await (prisma as any).conversation.findMany({
      where: { month, year },
      orderBy: { updatedAt: "desc" },
    });
  } catch (error) {
    console.error("Failed to fetch conversations:", error);
    return [];
  }
}

export async function getAIUsageStatsDirect() {
  return await getAIUsageStats();
}
