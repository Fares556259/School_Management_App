"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function generateSmartInsights(aggregatedData: any) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert school administrator. Analyze the following daily aggregated data for the school and provide 2-3 short, actionable, and smart insights.
      Do not hallucinate data. Be very concise. Provide the output as a simple array of strings in JSON format.

      Data:
      ${JSON.stringify(aggregatedData, null, 2)}
      
      Example output format:
      ["Insight 1", "Insight 2", "Insight 3"]
    `;

    const result = await model.generateContent(prompt);
    const textResult = result.response.text();
    
    // Find the JSON array in the text (in case there's markdown around it)
    const jsonMatch = textResult.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [
      "Unable to parse AI insights.",
    ];
  } catch (err) {
    console.error("AI Insight Generation Error:", err);
    return [
      "Failed to generate smart insights due to an error.",
    ];
  }
}
