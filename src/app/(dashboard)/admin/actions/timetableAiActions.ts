"use server";

import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";

export async function generateTimetableFromPrompt(
  prompt: string, 
  classContext: { id: number; name: string; level: number },
  availableSubjects: any[],
  availableTeachers: any[]
) {
  if (!prompt || prompt.length < 5) {
    return { error: "Please provide more instructions for the timetable." };
  }

  const systemPrompt = `
    You are an expert school scheduler.
    You will generate a weekly timetable for a class based on a user's prompt.
    The school operates 6 days a week (MONDAY to SATURDAY).
    Each day has 3 slots (slotNumber 1, 2, 3).
    
    CLASS CONTEXT:
    - ID: ${classContext.id}
    - Name: ${classContext.name}
    - Level: ${classContext.level}

    AVAILABLE SUBJECTS:
    ${availableSubjects.map(s => `- ID ${s.id}: ${s.name}`).join("\n")}

    AVAILABLE TEACHERS (Filter by relevant subjects if possible):
    ${availableTeachers.map(t => `- ID ${t.id}: ${t.name} ${t.surname} (Subjects: ${t.subjects?.map((s: any) => s.name).join(", ")})`).join("\n")}

    TASK:
    Generate a JSON array of TimetableSlot objects.
    Each object MUST have:
    {
      "day": "MONDAY | TUESDAY | WEDNESDAY | THURSDAY | FRIDAY | SATURDAY",
      "slotNumber": number (1, 2, 3, etc.),
      "duration": number (60, 90, or 120 in minutes),
      "room": "string (e.g. Room 101)",
      "subjectId": number (match ID from available subjects),
      "teacherId": "string (match ID from available teachers)",
      "classId": ${classContext.id}
    }

    USER INSTRUCTIONS:
    "${prompt}"

    IMPORTANT:
    - Return ONLY the JSON array.
    - Omit startTime and endTime (these will be auto-calculated).
    - Handle overlaps: Don't assign more than one subject to the same slot/day.
    - Default duration is 120 minutes if unspecified.
  `;

  try {
    const response = await callGeminiDirect(systemPrompt);
    const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleaned);
    return { data };
  } catch (err: any) {
    console.error("AI Timetable Generate Error:", err);
    return { error: "Failed to generate timetable slots. Please try different instructions." };
  }
}
