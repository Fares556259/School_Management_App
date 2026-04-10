"use server";

import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";

export async function parseStudentsFromText(text: string) {
  if (!text || text.length < 10) {
    return { error: "Please provide a more detailed list of students." };
  }

  const prompt = `
    You are an expert school administrative assistant.
    I will provide you with a list of students in unstructured text. 
    Your task is to parse this list into a JSON array of student objects.
    
    Each student object MUST follow this structure:
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
      "parentId": "string (leave empty, we will match later)",
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "classId": number (default to 1 if unknown)
    }

    Notes:
    - If a field is totally missing, use a reasonable educated guess or a sensible default.
    - Username should be first initial + surname (e.g., John Doe -> jdoe). Unique in output.
    
    TEXT TO PARSE:
    """
    ${text}
    """

    IMPORTANT: Return ONLY the JSON array. No markdown, no explanation.
  `;

  try {
    const response = await callGeminiDirect(prompt);
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);
    return { data };
  } catch (err: any) {
    console.error("AI Parse Error:", err);
    return { error: "Failed to parse student data." };
  }
}

export async function parseStudentsFromImage(imageUrl: string) {
  if (!imageUrl) {
    return { error: "Please provide a valid image of a student list." };
  }

  const prompt = `
    You are an expert school administrative assistant with high-performance OCR skills.
    I will provide you with an image of a student list or enrollment document. 
    Your task is to parse this list into a JSON array of student objects.
    
    Each student object MUST follow this structure:
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
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "classId": number (default to 1 if unknown)
    }

    IMPORTANT: 
    - Return ONLY the JSON array. No markdown, no explanation.
    - Username should be unique in your output (e.g., John Smith -> jsmith, jsmith2).
  `;

  try {
    const response = await callGeminiDirect(prompt, imageUrl);
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);
    return { data };
  } catch (err: any) {
    console.error("AI Vision Parse Error:", err);
    return { error: "Failed to parse image. Please ensure it is clear and readable." };
  }
}
