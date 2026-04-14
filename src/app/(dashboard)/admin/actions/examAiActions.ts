"use server";

import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";

export async function generateExamsFromPrompt(
  prompt: string, 
  classContext: { id: number; name: string; level: number },
  availableSubjects: any[],
  availableTeachers: any[],
  examPeriod: number = 1
) {
  if (!prompt || prompt.length < 5) {
    return { error: "Please provide more instructions for the exam schedule." };
  }

  const systemPrompt = `
    You are an expert school scheduler.
    You will generate a weekly Exam schedule for a class based on a user's prompt.
    The goal is to schedule exams for PERIOD ${examPeriod}.
    The school operates 6 days a week (MONDAY to SATURDAY).
    Each day has 3 slots (slotNumber 1, 2, 3).
    
    CLASS CONTEXT:
    - ID: ${classContext.id}
    - Name: ${classContext.name}
    - Level: ${classContext.level}

    AVAILABLE SUBJECTS:
    ${availableSubjects.map(s => `- ID ${s.id}: ${s.name}`).join("\n")}

    AVAILABLE TEACHERS:
    ${availableTeachers.map(t => `- ID ${t.id}: ${t.name} ${t.surname}`).join("\n")}

    TASK:
    Generate a JSON array of Exam objects mapped to these slots.
    Each object MUST have:
    {
      "day": "MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY",
      "slotNumber": number (1, 2 or 3),
      "subjectId": number (match ID from available subjects),
      "teacherId": "string (match ID from available teachers)",
      "classId": ${classContext.id},
      "examPeriod": ${examPeriod}
    }

    USER INSTRUCTIONS:
    "${prompt}"

    IMPORTANT:
    - Return ONLY the JSON array.
    - Slot 1: 08:00 - 10:00
    - Slot 2: 10:00 - 12:00
    - Slot 3: 12:00 - 14:00
    - UNIQUE SUBJECTS: Each subject can have at most ONE exam in the generated schedule. Do not repeat subjects.
    - Avoid more than one exam per class per day if possible unless requested.
  `;

  try {
    const response = await callGeminiDirect(systemPrompt);
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);
    return { data };
  } catch (err: any) {
    console.error("AI Exam Generate Error:", err);
    return { error: "Failed to generate exam slots. Please try different instructions." };
  }
}
