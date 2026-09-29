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
      "username": "string (lowercase, no spaces, e.g. jdoe or std_269274689104)",
      "name": "string (First name / الاسم)",
      "surname": "string (Last name / اللقب)",
      "nationalId": "string (10-12 digit educational ID / المعرف التربوي if available, else empty)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Tunis' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE (convert ذكر to MALE and أنثى to FEMALE)",
      "parentId": "string (leave empty)",
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "levelId": number (1 to 6 if level is mentioned, e.g. Level 1 -> 1),
      "classId": number or null (null if not yet assigned to a class like 1A/1B)
    }

    Notes:
    - If a 10-12 digit ID is present (المعرف التربوي), extract it as "nationalId".
    - If the student is unassigned to a section (غير موزع على قسم), set "classId": null.
    - If a field is totally missing, use a reasonable educated guess or sensible default.
    
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
    return { error: "Please provide a valid image or document of a student list." };
  }

  const prompt = `
    You are an expert school administrative assistant with high-performance OCR skills.
    I will provide you with an image or document of a student list or enrollment document. 
    Your task is to parse this list into a JSON array of student objects.
    
    Each student object MUST follow this structure:
    {
      "username": "string (lowercase, no spaces, e.g. jdoe or std_269274689104)",
      "name": "string (First name / الاسم)",
      "surname": "string (Last name / اللقب)",
      "nationalId": "string (10-12 digit educational ID / المعرف التربوي if visible, else empty)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Tunis' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE (convert ذكر to MALE and أنثى to FEMALE)",
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "levelId": number (1 to 6 if level is known, default 1),
      "classId": number or null (null if unassigned / غير موزع على قسم)
    }

    IMPORTANT: 
    - Return ONLY the JSON array. No markdown, no explanation.
    - If a 10-12 digit ID is present (المعرف التربوي), extract it into "nationalId".
    - If no specific section like 1A or 1B is given, set "classId": null.
  `;

  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error("Failed to fetch image from storage.");
    
    const arrayBuffer = await res.arrayBuffer();
    const base64Str = Buffer.from(arrayBuffer).toString('base64');
    const contentType = res.headers.get("content-type") || "image/jpeg";

    const response = await callGeminiDirect(prompt, base64Str, contentType);
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);
    return { data };
  } catch (err: any) {
    console.error("AI Vision Parse Error:", err);
    return { error: "Failed to parse document. Please ensure it is clear and readable." };
  }
}
