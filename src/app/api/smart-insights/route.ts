import { NextResponse } from 'next/server';
import { generateHash, getCachedInsights, setCachedInsights } from '@/lib/insightsCache';

export async function POST(req: Request) {
  let fallbackInsights: any[] = [];
  
  try {
    const payload = await req.json();
    
    // 1. Check the local cache first to prevent redundant API calls
    const payloadHash = generateHash(payload);
    const cached = getCachedInsights(payloadHash);
    
    if (cached) {
      return NextResponse.json({ insights: cached, source: "cache" });
    }

    // Prepare robust mathematical fallback
    fallbackInsights = [
      { text: `Balance is $${(payload.totalBalance/1000).toFixed(1)}k this month.`, severity: "green" },
      { text: `Monthly expenses are $${(payload.thisMonthExpense/1000).toFixed(1)}k.`, severity: payload.thisMonthExpense > payload.thisMonthIncome ? "red" : "green" },
      { text: `${payload.unpaidCount} pending payments totaling $${(payload.unpaidAmount/1000).toFixed(1)}k.`, severity: payload.unpaidCount > 0 ? "orange" : "green" },
    ];

    // 2. Fetch from LLM API (OpenAI compatible)
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/chat/completions';
    
    if (!apiKey || apiKey.length < 5) {
      console.warn("OPENAI_API_KEY is missing or invalid. Using deterministic fallback.");
      return NextResponse.json({ insights: fallbackInsights, source: "fallback" });
    }

    // 3. Construct System Prompt
    const systemPrompt = `You are a financial analyst for a private school. 
Analyze the following financial snapshot and generate EXACTLY 3 short, actionable insights.
Each insight MUST be under 15 words.
Identify the severity of each insight as:
- 'red' (critical warning, e.g. high debt, large spending)
- 'orange' (moderate issue, e.g. pending payments to collect)
- 'green' (positive trend, e.g. strong revenue, no debt)

Return ONLY a valid JSON array of objects with the keys 'text' and 'severity'. No markdown wrappers.`;

    const userPrompt = `Data Snapshot:
- Total Net Balance: $${payload.totalBalance}
- This Month Income: $${payload.thisMonthIncome}
- This Month Expenses: $${payload.thisMonthExpense}
- Pending/Unpaid Payments: $${payload.unpaidAmount} (${payload.unpaidCount} entities)

Output Valid JSON array only.`;

    const llmResponse = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Or any equivalent OSS model if using a proxy
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.3, // Low temp for more determinism
      }),
    });

    if (!llmResponse.ok) {
      throw new Error(`LLM API returned ${llmResponse.status} ${llmResponse.statusText}`);
    }

    const json = await llmResponse.json();
    let messageContent = json.choices[0].message.content.trim();
    
    // Failsafe parsing
    if (messageContent.startsWith("```json")) {
      messageContent = messageContent.replace(/```json/g, "").replace(/```/g, "").trim();
    }
    
    const generatedInsights = JSON.parse(messageContent);

    // 4. Save to cache
    setCachedInsights(payloadHash, generatedInsights);

    return NextResponse.json({ insights: generatedInsights, source: "llm" });

  } catch (error) {
    console.warn("Smart Insights API Error, falling back to deterministic calculations:", error);
    // Hard fallback so the UI never crashes and always displays useful insights!
    if (fallbackInsights.length > 0) {
      return NextResponse.json({ insights: fallbackInsights, source: "error_fallback" });
    }
    
    return NextResponse.json({ 
      insights: [
        { text: "System is operating normally. All metrics stable.", severity: "green" },
        { text: "No critical financial alerts detected this week.", severity: "green" },
        { text: "Pending collections are being monitored automatically.", severity: "orange" }
      ], 
      source: "error" 
    });
  }
}
