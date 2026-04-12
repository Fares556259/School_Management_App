"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function callGeminiDirect(prompt: string, imageBase64?: string) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("API key missing");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://snapschool.ai", // Optional
        "X-Title": "SnapSchool AI", 
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5-8b",
        messages: [
          {
            role: "user",
            content: imageBase64 
              ? [
                  { type: "text", text: prompt },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
              : prompt
          }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return data.choices[0].message.content;
  } catch (error) {
    console.error("OpenRouter Direct Error:", error);
    throw error;
  }
}

export async function getChatResponse(
  userMessage: string, 
  context: any, 
  imageBase64?: string, 
  locale = "fr",
  history: any[] = []
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return { success: false, error: "API key missing" };

  try {
    const systemPrompt = `
      You are Zbiba (pronounced "Zbeeba"), an expert AI school administrator for "SnapSchool".
      Your tone: Strategic, professional, and helpful. Language: ${locale === "fr" ? "French" : "English"}.
      
      CONTEXT: ${JSON.stringify(context)}
      HISTORY: ${JSON.stringify(history.slice(-5))}

      CAPABILITIES:
      1. Analyze financials (Incomes, Expenses, Payments).
      2. Manage Academics (Grades, Classes).
      3. Perform Actions: YOU CAN EMIT COMMANDS.
      
      COMMANDS format:
      If the user wants to perform an action (e.g., "Mark student X as paid", "Add expense for electricity"), you MUST return a 'command' object.
      
      JSON RESPONSE FORMAT:
      {
        "response": "Your natural language response here (in ${locale})",
        "command": null | { "type": "MARK_PAID" | "ADD_EXPENSE" | "ADD_GRADE" | "POST_NOTICE", "data": { ... } }
      }
    `;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-flash-1.5-8b",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
          {
            role: "user",
            content: imageBase64 
              ? [
                  { type: "text", text: userMessage },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
              : userMessage
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  } catch (error: any) {
    console.error("OpenRouter Assistant Error:", error);
    return { success: false, error: error.message };
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
