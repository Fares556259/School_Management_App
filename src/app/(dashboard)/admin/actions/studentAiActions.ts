"use server";

import { callGeminiDirect } from "@/app/(dashboard)/admin/actions/aiActions";
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
        rowText.includes("المعرف") ||
        rowText.includes("الاسم") ||
        rowText.includes("الإسم") ||
        rowText.includes("المستوى")
      ) {
        headerRowIdx = rowNumber;
        values.forEach((val, colIdx) => {
          const str = String(val || "").trim();
          if (str.includes("المعرف") || str.toLowerCase().includes("national")) colMap["nationalId"] = colIdx;
          else if (str.includes("اللقb") || str.includes("اللقب") || str.toLowerCase().includes("nom") && !str.toLowerCase().includes("prénom")) colMap["surname"] = colIdx;
          else if (str.includes("الاسم") || str.includes("الإسم") || str.toLowerCase().includes("prénom") || str.toLowerCase().includes("prenom")) colMap["name"] = colIdx;
          else if (str.includes("الجنس") || str.toLowerCase().includes("sexe") || str.toLowerCase().includes("genre")) colMap["sex"] = colIdx;
          else if (str.includes("المستوى") || str.toLowerCase().includes("niveau")) colMap["level"] = colIdx;
          else if (str.includes("تاريخ التسجيل") || str.toLowerCase().includes("date")) colMap["registrationDate"] = colIdx;
        });
      }
    });

    if (headerRowIdx === -1) {
      return {
        error:
          "En-têtes du ministère introuvables dans le fichier Excel (المعرف التربوي, الاسم, المستوى الدراسي).",
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
      // "السنة الأولى من التعليم الأساسي" -> 1
      // "السنة الثانية من التعليم الأساسي" -> 2
      // "السنة الثالثة من التعليم الأساسي" -> 3
      // "السنة الرابعة من التعليم الأساسي" -> 4
      // "السنة الخامسة من التعليم الأساسي" -> 5
      // "السنة السادسة من التعليم الأساسي" -> 6
      // "المرحلة التحضيرية" -> 0
      let levelId = 1;
      if (rawLevel.includes("الأولى") || rawLevel.includes("1")) levelId = 1;
      else if (rawLevel.includes("الثانية") || rawLevel.includes("2")) levelId = 2;
      else if (rawLevel.includes("الثالثة") || rawLevel.includes("3")) levelId = 3;
      else if (rawLevel.includes("الرابعة") || rawLevel.includes("4")) levelId = 4;
      else if (rawLevel.includes("الخامسة") || rawLevel.includes("5")) levelId = 5;
      else if (rawLevel.includes("السادسة") || rawLevel.includes("6")) levelId = 6;
      else if (rawLevel.includes("التحضيرية") || rawLevel.includes("0")) levelId = 0;

      // Map gender
      const sex =
        rawSex.includes("أنثى") ||
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
        classId: null, // non classé
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
