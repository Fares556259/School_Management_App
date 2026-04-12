"use server";

import { callGeminiDirect } from "../actions/aiActions";

export async function extractGradesFromImage({
  imageInput,
  students,
  context
}: {
  imageInput: string;
  students: { id: string; name: string; surname: string }[];
  context: { subject: string; term: string; className: string };
}) {
  try {
    if (!context || !context.className) {
      return { data: null, error: "The system context is missing. Please refresh the page and try scanning again.", warnings: [] };
    }

    // Prepare student context for better matching
    const studentListStr = students.map(s => `${s.name} ${s.surname}`).join(", ");

    const prompt = `
      You are an expert academic data extractor for SnapSchool. I am providing you an image of a grade sheet (handwritten or printed).
      
      CORE VALIDATION DATA:
      - Selected Class: ${context.className}
      - Selected Subject: ${context.subject}
      - Selected Term: ${context.term}
      
      TASKS:
      1. EXTRACT METADATA: Find the Classroom name, Subject name, and Term mentioned on the paper.
      2. EXTRACT GRADES: Identify and extract the scores (typically out of 20) for each student.
      3. FUZZY MATCHING: Match the names in the image to this list of known students: [${studentListStr}].
         - If a name is missing or has minor variations, map it to the closest known student from the list.
         - If you find names on the paper that are NOT in the provided list, still extract them but mark them as "unmatched".

      FORMAT:
      Return ONLY a JSON object with this exact schema:
      {
        "metadata": {
          "detectedClass": "string or unknown",
          "detectedSubject": "string or unknown", 
          "detectedTerm": "string or unknown"
        },
        "grades": [
          { "name": "Exact Name from list", "score": number | null, "isMatched": boolean }
        ]
      }
      
      CRITICAL: Return ONLY valid JSON.
    `;

    let base64Data: string;
    if (imageInput.startsWith("http")) {
      const response = await fetch(imageInput);
      if (!response.ok) throw new Error("Could not download the document image.");
      const buffer = await response.arrayBuffer();
      base64Data = Buffer.from(buffer).toString("base64");
    } else {
      base64Data = imageInput.split(",")[1] || imageInput;
    }

    const text = await callGeminiDirect(prompt, base64Data);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("The AI provided an invalid response format. The image might be too complex or blurry.");
    }

    const result = JSON.parse(jsonMatch[0]);

    // Map names back to student IDs and collect warnings
    const mappedGrades: Record<string, string> = {};
    const warnings: string[] = [];
    const unmappedStudents: string[] = [];

    // Metadata validation
    if (result.metadata) {
      if (result.metadata.detectedSubject !== "unknown" && !result.metadata.detectedSubject.toLowerCase().includes(context.subject.toLowerCase())) {
        warnings.push(`Warning: This document looks like it is for "${result.metadata.detectedSubject}", but you have selected "${context.subject}".`);
      }
      if (result.metadata.detectedTerm !== "unknown" && !result.metadata.detectedTerm.toLowerCase().includes(context.term.toLowerCase())) {
        warnings.push(`Warning: This document looks like it is for "${result.metadata.detectedTerm}", but you have selected "${context.term}".`);
      }
      if (result.metadata.detectedClass !== "unknown" && !result.metadata.detectedClass.toLowerCase().includes(context.className.toLowerCase())) {
        warnings.push(`Warning: The paper mentions class "${result.metadata.detectedClass}" but you are recording for "${context.className}".`);
      }
    }

    result.grades.forEach((item: any) => {
      const student = students.find(s => `${s.name} ${s.surname}`.toLowerCase() === item.name.toLowerCase());
      if (student && item.score !== null) {
        mappedGrades[student.id] = String(item.score);
      } else if (!item.isMatched) {
        unmappedStudents.push(item.name);
      }
    });

    if (unmappedStudents.length > 0) {
      warnings.push(`The AI found ${unmappedStudents.length} names on the paper that do not match anyone in ${context.className}.`);
    }

    return { 
      data: mappedGrades, 
      warnings, 
      metadata: result.metadata,
      error: null 
    };
  } catch (error: any) {
    console.error("AI Extraction Error:", error);
    
    let friendlyError = "The AI was unable to read the grade sheet correctly.";
    const rawError = error.message || "";
    
    if (rawError.includes("aborted") || rawError.includes("timeout")) {
        friendlyError = "The scan took too long and was interrupted. Please ensure your internet is stable and try with a smaller or lower-resolution photo.";
    } else if (rawError.includes("blurry") || rawError.includes("complex") || rawError.includes("invalid response")) {
        friendlyError = "The document is too blurry or complex for the AI to read. please try taking a clearer, well-lit photo of the sheet.";
    } else if (rawError.includes("quota") || rawError.includes("limit")) {
        friendlyError = "The AI service is currently at its limit. Please wait about 60 seconds and try again.";
    } else if (rawError.includes("fetch") || rawError.includes("Network")) {
        friendlyError = "A network error occurred. Please check your connection and try again.";
    } else if (rawError.includes("API key") || rawError.includes("unauthorized")) {
        friendlyError = "Technical configuration error (API Key). Please contact the system administrator.";
    } else {
        // Fallback to a slightly more descriptive generic error
        friendlyError = `AI Error: ${rawError.length > 100 ? rawError.substring(0, 100) + "..." : rawError}`;
    }

    return { data: null, warnings: [], metadata: null, error: friendlyError };
  }
}
