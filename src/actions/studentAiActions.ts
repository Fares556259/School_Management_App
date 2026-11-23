"use server";

import { callGeminiDirect } from "@actions/aiActions";
import { Workbook } from "exceljs";

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
      "name": "string (First name / Ø§Ù„Ø§Ø³Ù…)",
      "surname": "string (Last name / Ø§Ù„Ù„Ù‚Ø¨)",
      "nationalId": "string (10-12 digit educational ID / Ø§Ù„Ù…Ø¹Ø±Ù Ø§Ù„ØªØ±Ø¨ÙˆÙŠ if available, else empty)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Tunis' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE (convert Ø°ÙƒØ± to MALE and Ø£Ù†Ø«Ù‰ to FEMALE)",
      "parentId": "string (leave empty)",
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "levelId": number (1 to 6 if level is mentioned, e.g. Level 1 -> 1),
      "classId": number or null (null if not yet assigned to a class like 1A/1B)
    }

    Notes:
    - If a 10-12 digit ID is present (Ø§Ù„Ù…Ø¹Ø±Ù Ø§Ù„ØªØ±Ø¨ÙˆÙŠ), extract it as "nationalId".
    - If the student is unassigned to a section (ØºÙŠØ± Ù…ÙˆØ²Ø¹ Ø¹Ù„Ù‰ Ù‚Ø³Ù…), set "classId": null.
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
      "name": "string (First name / Ø§Ù„Ø§Ø³Ù…)",
      "surname": "string (Last name / Ø§Ù„Ù„Ù‚Ø¨)",
      "nationalId": "string (10-12 digit educational ID / Ø§Ù„Ù…Ø¹Ø±Ù Ø§Ù„ØªØ±Ø¨ÙˆÙŠ if visible, else empty)",
      "email": "string (optional)",
      "phone": "string (optional)",
      "address": "string (default to 'Tunis' if missing)",
      "bloodType": "string (default to 'O+' if missing)",
      "birthday": "string (YYYY-MM-DD, estimate if year is missing)",
      "sex": "MALE | FEMALE (convert Ø°ÙƒØ± to MALE and Ø£Ù†Ø«Ù‰ to FEMALE)",
      "parentName": "string (First name of parent)",
      "parentSurname": "string (Last name of parent)",
      "parentPhone": "string (Mobile number)",
      "levelId": number (1 to 6 if level is known, default 1),
      "classId": number or null (null if unassigned / ØºÙŠØ± Ù…ÙˆØ²Ø¹ Ø¹Ù„Ù‰ Ù‚Ø³Ù…)
    }

    IMPORTANT: 
    - Return ONLY the JSON array. No markdown, no explanation.
    - If a 10-12 digit ID is present (Ø§Ù„Ù…Ø¹Ø±Ù Ø§Ù„ØªØ±Ø¨ÙˆÙŠ), extract it into "nationalId".
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

export async function parseStudentsFromExcel(formData: FormData) {
  try {
    const file = formData.get("file") as File;
    if (!file) return { error: "Aucun fichier Excel fourni." };

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = new Workbook();
    await workbook.xlsx.load(buffer as any);
    const worksheet = workbook.worksheets[0];

    if (!worksheet) {
      return { error: "La feuille Excel est vide." };
    }

    // 1. Detect headers and column mapping
    let headerRowIdx = -1;
    const colMap: Record<string, number> = {};

    worksheet.eachRow((row, rowNumber) => {
      if (headerRowIdx !== -1) return;
      const values = row.values as any[];
      if (!Array.isArray(values)) return;

      const rowText = values.map((v) => String(v || "").trim()).join(" ");
      if (
        rowText.includes("Ø§Ù„Ù…Ø¹Ø±Ù") ||
        rowText.includes("Ø§Ù„Ø§Ø³Ù…") ||
        rowText.includes("Ø§Ù„Ø¥Ø³Ù…") ||
        rowText.includes("Ø§Ù„Ù…Ø³ØªÙˆÙ‰")
      ) {
        headerRowIdx = rowNumber;
        values.forEach((val, colIdx) => {
          const str = String(val || "").trim();
          if (str.includes("Ø§Ù„Ù…Ø¹Ø±Ù") || str.toLowerCase().includes("national")) colMap["nationalId"] = colIdx;
          else if (str.includes("Ø§Ù„Ù„Ù‚b") || str.includes("Ø§Ù„Ù„Ù‚Ø¨") || str.toLowerCase().includes("nom") && !str.toLowerCase().includes("prÃ©nom")) colMap["surname"] = colIdx;
          else if (str.includes("Ø§Ù„Ø§Ø³Ù…") || str.includes("Ø§Ù„Ø¥Ø³Ù…") || str.toLowerCase().includes("prÃ©nom") || str.toLowerCase().includes("prenom")) colMap["name"] = colIdx;
          else if (str.includes("Ø§Ù„Ø¬Ù†Ø³") || str.toLowerCase().includes("sexe") || str.toLowerCase().includes("genre")) colMap["sex"] = colIdx;
          else if (str.includes("Ø§Ù„Ù…Ø³ØªÙˆÙ‰") || str.toLowerCase().includes("niveau")) colMap["level"] = colIdx;
          else if (str.includes("ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ³Ø¬ÙŠÙ„") || str.toLowerCase().includes("date")) colMap["registrationDate"] = colIdx;
        });
      }
    });

    if (headerRowIdx === -1) {
      return {
        error:
          "En-tÃªtes du ministÃ¨re introuvables dans le fichier Excel (Ø§Ù„Ù…Ø¹Ø±Ù Ø§Ù„ØªØ±Ø¨ÙˆÙŠ, Ø§Ù„Ø§Ø³Ù…, Ø§Ù„Ù…Ø³ØªÙˆÙ‰ Ø§Ù„Ø¯Ø±Ø§Ø³ÙŠ).",
      };
    }

    const students: any[] = [];

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRowIdx) return;
      const values = row.values as any[];
      if (!Array.isArray(values)) return;

      const rawNationalId = colMap["nationalId"] ? String(values[colMap["nationalId"]] || "").trim() : "";
      const rawName = colMap["name"] ? String(values[colMap["name"]] || "").trim() : "";
      const rawSurname = colMap["surname"] ? String(values[colMap["surname"]] || "").trim() : "";
      const rawSex = colMap["sex"] ? String(values[colMap["sex"]] || "").trim() : "";
      const rawLevel = colMap["level"] ? String(values[colMap["level"]] || "").trim() : "";

      if (!rawName && !rawNationalId) return;

      // Extract 10-14 digit national ID
      const nationalIdMatch = rawNationalId.match(/\d{10,14}/);
      const nationalId = nationalIdMatch ? nationalIdMatch[0] : rawNationalId;

      // Map level text from the ministry format:
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 1
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø«Ø§Ù†ÙŠØ© Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 2
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø«Ø§Ù„Ø«Ø© Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 3
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø±Ø§Ø¨Ø¹Ø© Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 4
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø®Ø§Ù…Ø³Ø© Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 5
      // "Ø§Ù„Ø³Ù†Ø© Ø§Ù„Ø³Ø§Ø¯Ø³Ø© Ù…Ù† Ø§Ù„ØªØ¹Ù„ÙŠÙ… Ø§Ù„Ø£Ø³Ø§Ø³ÙŠ" -> 6
      // "Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„ØªØ­Ø¶ÙŠØ±ÙŠØ©" -> 0
      let levelId = 1;
      if (rawLevel.includes("Ø§Ù„Ø£ÙˆÙ„Ù‰") || rawLevel.includes("1")) levelId = 1;
      else if (rawLevel.includes("Ø§Ù„Ø«Ø§Ù†ÙŠØ©") || rawLevel.includes("2")) levelId = 2;
      else if (rawLevel.includes("Ø§Ù„Ø«Ø§Ù„Ø«Ø©") || rawLevel.includes("3")) levelId = 3;
      else if (rawLevel.includes("Ø§Ù„Ø±Ø§Ø¨Ø¹Ø©") || rawLevel.includes("4")) levelId = 4;
      else if (rawLevel.includes("Ø§Ù„Ø®Ø§Ù…Ø³Ø©") || rawLevel.includes("5")) levelId = 5;
      else if (rawLevel.includes("Ø§Ù„Ø³Ø§Ø¯Ø³Ø©") || rawLevel.includes("6")) levelId = 6;
      else if (rawLevel.includes("Ø§Ù„ØªØ­Ø¶ÙŠØ±ÙŠØ©") || rawLevel.includes("0")) levelId = 0;

      // Map gender
      const sex =
        rawSex.includes("Ø£Ù†Ø«Ù‰") ||
        rawSex.toLowerCase().includes("fem") ||
        rawSex.toLowerCase().includes("girl")
          ? "FEMALE"
          : "MALE";

      students.push({
        nationalId: nationalId || null,
        name: rawName,
        surname: rawSurname,
        sex,
        levelId,
        classId: null, // non classÃ©
      });
    });

    return {
      success: true,
      data: students,
      count: students.length,
    };
  } catch (err: any) {
    console.error("[parseStudentsFromExcel] Error:", err);
    return {
      error: "Erreur lors de la lecture du fichier Excel : " + (err?.message || "Format invalide"),
    };
  }
}

