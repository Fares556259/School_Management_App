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
      "startTime": "string (e.g. 08:00)",
      "endTime": "string (e.g. 10:00)",
      "slotNumber": number (1, 2 or 3),
      "room": "string (e.g. Room 101)",
      "subjectId": number (match ID from available subjects),
      "teacherId": "string (match ID from available teachers who teach that subject)",
      "classId": ${classContext.id}
    }

    USER INSTRUCTIONS:
    "${prompt}"

    IMPORTANT:
    - Return ONLY the JSON array.
    - Slot 1: 08:00 - 10:00
    - Slot 2: 10:00 - 12:00
    - Slot 3: 12:00 - 14:00
    - Handle overlaps: Don't assign more than one subject to the same slot/day.
    - Aim for a balanced schedule if instructions are vague.
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
