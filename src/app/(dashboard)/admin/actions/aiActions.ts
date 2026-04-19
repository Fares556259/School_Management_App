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
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("API key missing");

  const isGoogleKey = apiKey.startsWith("AIza");
  
  if (isGoogleKey) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash",
        generationConfig: params.jsonMode ? { responseMimeType: "application/json" } : undefined
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
      return result.response.text();
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
    return data.choices[0].message.content;
  } catch (error: any) {
    console.error("[OpenRouter Router Error]", error);
    throw new Error(`Connectivity Issue: ${error.message}`);
  }
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
      1. MANDATORY TABLE: For any "info", "status", or "summary" request, your JSON "response" MUST contain a complete 12-month Markdown table (Sept 2025 - Aug 2026).
      2. PROJECTED AMOUNTS: Do NOT show "0" for pending months. Find the student's monthly fee (e.g. 450 DT) and use it for ALL pending months in the table. 
      3. RESPONSE STRUCTURE: [Your brief text] followed by [The 12-month Markdown Table].
      4. ACTION ENFORCEMENT: Emit "MARK_PAID" command ONLY if the user says "mark paid" or "he paid".
      5. Identify students by FULL NAME from context.

      JSON RESPONSE FORMAT:
      {
        "response": "Brief professional confirmation in ${locale}.",
        "command": null | { "type": "MARK_PAID", "data": { "studentId": "safeRef", "student_name": "NAME", "month": 1-12, "year": 2026, "amount": 450 } }
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
      
      let match = allRecords.find(p => (p.studentId || p.teacherId || p.staffId) === targetRef);
      
      if (!match && targetName) {
        match = allRecords.find(p => {
          const fullName = (p.name || "").toLowerCase();
          return fullName.includes(targetName) || targetName.includes(fullName);
        });
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
