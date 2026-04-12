"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "");

export async function callGeminiDirect(prompt: string, imageBase64?: string) {
  try {
    const modelName = imageBase64 ? "gemini-1.5-flash" : "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const parts: any[] = [{ text: prompt }];
    if (imageBase64) {
      parts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64,
        },
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Direct Error:", error);
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
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

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

    const prompt = `System Instructions: ${systemPrompt}\n\nUser Message: ${userMessage}`;
    
    const parts: any[] = [{ text: prompt }];
    if (imageBase64) {
      parts.push({ inlineData: { mimeType: "image/jpeg", data: imageBase64 } });
    }

    const result = await model.generateContent(parts);
    const responseText = result.response.text();
    
    return JSON.parse(responseText);
  } catch (error: any) {
    console.error("Assistant AI Error:", error);
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
