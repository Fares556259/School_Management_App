"use server";

import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";

export async function parseTeachersFromText(text: string) {
  if (!text || text.length < 10) {
    return { error: "Please provide a more detailed list of teachers." };
  }

  const prompt = `
    You are an expert school administrative assistant.
    I will provide you with a list of teachers in unstructured text. 
    Your task is to parse this list into a JSON array of teacher objects.
    
    Each teacher object MUST follow this structure:
    {
      "username": "string (lowercase, no spaces, e.g. jdoe)",
      "name": "string (First name)",
      "surname": "string (Last name)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Unknown' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE",
      "salary": number (default to 3000)
    }

    Notes:
    - If a field is totally missing and has no default specified, use a reasonable educated guess or "N/A".
    - Sex: If not specified, guess based on the name.
    - Username: Must be unique in your output.
    
    TEXT TO PARSE:
    """
    ${text}
    """

    IMPORTANT: Return ONLY the JSON array. No markdown, no explanation.
  `;

  try {
    const response = await callGeminiDirect(prompt);
    
    // Clean potential markdown artifacts
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);

    return { data };
  } catch (err: any) {
    console.error("AI Parse Error:", err);
    return { error: "Failed to parse teacher data. Please ensure the format is readable." };
  }
}
export async function parseTeachersFromImage(imageUrl: string) {
  if (!imageUrl) {
    return { error: "Please provide a valid image of a teacher list." };
  }

  const prompt = `
    You are an expert school administrative assistant with high-performance OCR and vision parsing skills.
    I will provide you with an image of a teacher list or staff document. 
    Your task is to parse this list into a JSON array of teacher objects.
    
    Each teacher object MUST follow this structure:
    {
      "username": "string (lowercase, no spaces, e.g. jdoe)",
      "name": "string (First name)",
      "surname": "string (Last name)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Unknown' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE",
      "salary": number (default to 3000)
    }

    IMPORTANT: 
    - Return ONLY the JSON array. No markdown, no explanation.
    - If names overlap or are ambiguous, use your best judgment to separate them.
    - Username should be first initial + surname (e.g., John Doe -> jdoe).
  `;

  try {
    const response = await callGeminiDirect(prompt, imageUrl);
    
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);

    return { data };
  } catch (err: any) {
    console.error("AI Vision Parse Error:", err);
    return { error: "Failed to parse image. Please ensure the document is clear and readable." };
  }
}
