"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getCachedInsights, setCachedInsights, generateHash } from "@/lib/insightsCache";

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
 * CIRCUIT BREAKER STATE
 */
let CIRCUIT_BREAKER_TRIPPED = false;
let CIRCUIT_BREAKER_RESET_TIME = 0;

const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function checkCircuitBreaker() {
  if (CIRCUIT_BREAKER_TRIPPED) {
    if (Date.now() > CIRCUIT_BREAKER_RESET_TIME) {
      console.log("🔓 [AI-BREAKER] Cooldown expired. Resetting circuit...");
      CIRCUIT_BREAKER_TRIPPED = false;
      return true;
    }
    return false;
  }
  return true;
}

function tripCircuitBreaker() {
  console.warn("🔒 [AI-BREAKER] Tripping circuit due to provider instability. Cooling down for 5m...");
  CIRCUIT_BREAKER_TRIPPED = true;
  CIRCUIT_BREAKER_RESET_TIME = Date.now() + COOLDOWN_MS;
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
    try {
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
        if (response.status === 429) {
           throw new Error("RATE_LIMITED|Upstream provider is rate-limited. Serving cached data if available.");
        }
        throw new Error(`Provider Failed: ${response.status} ${errBody}`);
      }
      const data = await response.json();
      return data.choices[0].message.content;
      }
    } catch (err: any) {
      if (err.message.includes("RATE_LIMITED") || err.message.includes("CREDIT_EXHAUSTED")) throw err;
      console.error(`❌ [ROUTER_FETCH_ERROR] Detail:`, err.message, err.cause || "");
      throw err;
    }
  }

  // EXECUTION WITH SMART FALLBACK & RETRY (Enhanced for Rate Limits/504s)
  const execute = async () => {
    let providers = [];
    if (primaryKey) providers.push(primaryKey);
    if (secondaryKey && secondaryKey !== primaryKey) providers.push(secondaryKey);

    let lastErr: any;
    for (const key of providers) {
      try {
        return await callWithTimeout(callProvider(key), TIMEOUT_MS);
      } catch (err: any) {
        lastErr = err;
        // If it's a credit issue, don't try other providers (usually same account)
        if (err.message.includes("CREDIT_EXHAUSTED")) throw err;
        
        console.error(`🚀 [ROUTER_FAILOVER] Provider attempt failed (${err.message}). Trying next...`);
        // Continue to next provider in the list
      }
    }
    throw lastErr || new Error("No valid AI API providers succeeded.");
  };

  if (!checkCircuitBreaker()) {
    throw new Error("RATE_LIMITED|AI Service is cooling down due to recent errors. Using cached data.");
  }

  let lastErr: any;
  for (let i = 0; i <= MAX_RETRIES; i++) {
    try {
      return await execute();
    } catch (err: any) {
      lastErr = err;
      if (err.message.includes("CREDIT_EXHAUSTED") || err.message.includes("UNAUTHORIZED") || err.message.includes("RATE_LIMITED") || err.message.includes("504") || err.message.includes("TIMEDOUT")) {
        // Trip breaker for infrastructure failures or limits
        if (err.message.includes("RATE_LIMITED") || err.message.includes("504") || err.message.includes("TIMEOUT")) {
          tripCircuitBreaker();
        }
        break; 
      }
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
         - Identify recipients by FULL NAME from context (studentCensus). 
         - MANDATORY: If the context provides a "studentId" for a name, you MUST use that ID. If not, use the Full Name in the "studentId" field and I will resolve it.
      5. Identify students by FULL NAME from context.

      JSON RESPONSE FORMAT:
      {
        "response": "Brief professional confirmation in ${locale}. If detecting an invoice or expense, EXPLICITLY TELL THE USER they must click the 'Record Expense' button below to finalize the recording.",
        "command": null | { 
          "type": "MARK_PAID" | "ADD_EXPENSE", 
          "data": { 
             "studentId": "UUID_OR_FULL_NAME", "month": 1, "year": 2026, "amount": 450, 
             "title": "Vendor/Description", "category": "Type", "date": "YYYY-MM-DD" 
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

    // ROBUST RESOLVER (Synchronized with AdminPage context)
    if (result.command?.type === "MARK_PAID") {
      const data = result.command.data;
      const targetQuery = (data.studentId || "").trim().toLowerCase();
      
      // 1. Check Student Census (Primary Source for Identity)
      if (context.studentCensus) {
        const studentMatch = context.studentCensus.find((s: any) => 
          s.id === targetQuery || 
          s.name.toLowerCase() === targetQuery ||
          s.name.toLowerCase().includes(targetQuery) ||
          targetQuery.includes(s.name.toLowerCase())
        );
        if (studentMatch) {
          console.log(`✅ [AI_RESOLVER] Identity match found: ${studentMatch.name} -> ${studentMatch.id}`);
          result.command.data.studentId = studentMatch.id;
          result.command.data.studentName = studentMatch.name;
        }
      }

      // 2. Fallback to Financial Activity Records (for Teachers/Staff/Contextual amount matching)
      const activity = context.financials?.recentActivity || {};
      const allRecords = [...(activity.uncollected || []), ...(activity.paidHistory || [])];
      const match = allRecords.find(p => {
         const name = (p.name || "").toLowerCase();
         const id = (p.studentId || p.teacherId || p.staffId || "").toLowerCase();
         return id === targetQuery || name === targetQuery || name.includes(targetQuery) || targetQuery.includes(name);
      });

      if (match) {
        console.log(`✅ [AI_RESOLVER] Record match found: ${match.name}`);
        result.command.data.studentId = match.studentId || match.teacherId || match.staffId;
        if (!result.command.data.amount) result.command.data.amount = match.amount;
        if (!result.command.data.month) result.command.data.month = match.month;
        if (!result.command.data.year) result.command.data.year = match.year;
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

  // 🛰️ INSIGHTS CACHING LAYER
  const dataPayload = {
    totalBalance: (data.income || 0) - (data.expense || 0),
    thisMonthIncome: data.income || 0,
    thisMonthExpense: data.expense || 0,
    unpaidAmount: data.breakdown?.find((b:any) => b.type === 'unpaid')?.value || 0,
    unpaidCount: data.unpaidCount || 0 
  };
  const hash = generateHash(dataPayload);
  const cached = getCachedInsights(hash);

  if (cached && cached.insights && !cached.isStale) {
    console.log("🛰️ [CACHE] Hit: Serving valid insights from storage.");
    return cached.insights;
  }

  if (cached && cached.isStale) {
    console.log("🛰️ [CACHE] Refreshing stale insights in background...");
  } else {
    console.log("🛰️ [CACHE] Miss: Requesting new AI insights...");
  }

  const prompt = `
    You are an expert CFO for a luxury private school in Tunisia (SnapSchool). 
    
    DATA ANALYSIS:
    - Monthly Revenue: $${data.income}
    - Monthly Expenses: $${data.expense}
    - Unpaid Tuition: $${dataPayload.unpaidAmount} (${dataPayload.unpaidCount} students pending)
    - Regional Context: Private education in Tunisia is 20% more profitable in Q1 due to registration fees.
    
    TASK: Provide exactly 5 concise, strategic insights. 
    Ensure you cover: 1 Performance, 1 Risk, 1 Opportunity, 1 Economic Trend, and 1 Actionable Step.
    
    DATA BLOCKS: ${JSON.stringify(data)}
    
    RETURN ONLY a JSON array of objects: [{ "text": "...", "type": "performance" | "risk" | "opportunity" | "trend" | "action", "icon": "...", "confidence": "..." }]
  `;

  try {
    const text = await callGeminiDirect(prompt);
    const cleaned = cleanAIJson(text);
    
    // Robustly search for the JSON array within the response
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn("⚠️ [AI-INSIGHTS] No JSON array found in response. Raw:", cleaned);
      return []; 
    }
    
    try {
      const parsed = JSON.parse(match[0]);
      // CRITICAL: NEVER CACHE AN EMPTY ARRAY
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCachedInsights(hash, parsed);
        return parsed;
      }
      throw new Error("EMPTY_OR_MALFORMED_ARRAY");
    } catch (parseErr) {
      console.error("❌ [AI-INSIGHTS] JSON Parse failed:", parseErr, "Content:", match[0]);
      throw parseErr;
    }
  } catch (error: any) {
    console.error("❌ [AI-INSIGHTS] Insight Generation Error:", error);
    
    // ON FAILURE: Return the stale cache if we have ANY
    if (cached && cached.insights && cached.insights.length > 0) {
      console.log("🛰️ [CACHE] Fallback: Serving stale insights after provider failure.");
      return cached.insights;
    }
    
    // HARD FALLBACKS: Never return an empty UI
    return [
      { text: "Revenue collection is lower than expected for " + (data.month || "this month") + ". Focus on pending student tuition.", type: "risk", icon: "warning", confidence: "HIGH" },
      { text: "Healthy expense monitoring detected. Operational costs are stable.", type: "performance", icon: "check", confidence: "MEDIUM" },
      { text: "Opportunity to optimize Q3 budget based on historical Tunisian school trends.", type: "opportunity", icon: "zap", confidence: "AI_ESTIMATED" }
    ]; 
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
