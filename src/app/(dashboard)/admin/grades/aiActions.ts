"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function extractGradesFromImage(
  imageInput: string, // Can be base64 string OR a URL
  students: { id: string; name: string; surname: string }[]
) {
  if (!apiKey) {
    return { error: "Gemini API Key is not configured in .env file." };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prepare student context for better matching
    const studentListStr = students.map(s => `${s.name} ${s.surname}`).join(", ");

    const prompt = `
      You are an expert academic data extractor. I am providing you an image of a handwritten or printed grade sheet.
      
      TASKS:
      1. Identify and extract the scores (typically out of 20) for each student listed in the image.
      2. Match the names in the image to this list of known students: [${studentListStr}].
      3. If a name has a minor variation or misspelling, map it to the closest known student from the list.
      4. If a score is missing or unreadable, return null for that student.
      
      FORMAT:
      Return ONLY a JSON array of objects with the following schema:
      [
        { "name": "Full Student Name from list", "score": number | null }
      ]
      
      CRITICAL: Return ONLY valid JSON. No markdown, no commentary.
    `;

    let imageParts: any;

    if (imageInput.startsWith("http")) {
      // Use URL strategy (fetch image first as Gemini 1.5 prefers inline data for certain formats, or use URL if supported)
      // For simplicity and robustness across environments, we fetch and convert to inline data here
      const response = await fetch(imageInput);
      const buffer = await response.arrayBuffer();
      imageParts = {
        inlineData: {
          data: Buffer.from(buffer).toString("base64"),
          mimeType: "image/jpeg",
        },
      };
    } else {
      // Extract the pure base64 data (remove prefix if present)
      const base64Data = imageInput.split(",")[1] || imageInput;
      imageParts = {
        inlineData: {
          data: base64Data,
          mimeType: "image/jpeg",
        },
      };
    }

    const result = await model.generateContent([prompt, imageParts]);

    const response = await result.response;
    const text = response.text();
    
    // Clean potential markdown code blocks from AI response
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const extractedData: { name: string; score: number | null }[] = JSON.parse(jsonStr);

    // Map names back to student IDs
    const mappedGrades: Record<string, string> = {};
    
    extractedData.forEach(item => {
      const student = students.find(s => `${s.name} ${s.surname}`.toLowerCase() === item.name.toLowerCase());
      if (student && item.score !== null) {
        mappedGrades[student.id] = String(item.score);
      }
    });

    return { data: mappedGrades, error: null };
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    return { data: null, error: `AI failed to parse image: ${error.message}` };
  }
}
