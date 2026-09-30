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
    try {
      await workbook.xlsx.load(buffer as any);
    } catch (loadErr: any) {
      console.warn("[parseStudentsFromExcel] workbook.xlsx.load failed, trying text fallback:", loadErr?.message);
      // Fallback if the file is CSV or plain text
      const text = buffer.toString("utf-8");
      if (text && text.length > 20) {
        const aiRes = await parseStudentsFromText(text.slice(0, 10000));
        if (aiRes.data && aiRes.data.length > 0) {
          return {
            success: true,
            data: aiRes.data,
            count: aiRes.data.length,
          };
        }
      }
      throw loadErr;
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return { error: "La feuille Excel est vide." };
    }

    // 1. Detect headers and column mapping (supporting Arabic, French, and English)
    let headerRowIdx = -1;
    const colMap: Record<string, number> = {};

    const maxScanRows = Math.min(25, worksheet.rowCount || 25);
    for (let r = 1; r <= maxScanRows; r++) {
      if (headerRowIdx !== -1) break;
      const row = worksheet.getRow(r);
      const values = row.values as any[];
      if (!Array.isArray(values)) continue;

      const rowText = values.map((v) => String(v || "").toLowerCase().trim()).join(" ");

      const hasNational =
        rowText.includes("المعرف") ||
        rowText.includes("معرف") ||
        rowText.includes("national") ||
        rowText.includes("matricule") ||
        rowText.includes("identifiant") ||
        rowText.includes("cin");
      const hasName =
        rowText.includes("الاسم") ||
        rowText.includes("الإسم") ||
        rowText.includes("nom") ||
        rowText.includes("prénom") ||
        rowText.includes("prenom") ||
        rowText.includes("first") ||
        rowText.includes("last");
      const hasLevel =
        rowText.includes("المستوى") ||
        rowText.includes("مستوى") ||
        rowText.includes("niveau") ||
        rowText.includes("classe") ||
        rowText.includes("قسم");

      if (
        (hasNational && hasName) ||
        (hasName && hasLevel) ||
        (hasNational && hasLevel) ||
        (rowText.includes("الاسم") && rowText.includes("اللقب")) ||
        (rowText.includes("nom") && rowText.includes("prénom")) ||
        (rowText.includes("nom") && rowText.includes("prenom"))
      ) {
        headerRowIdx = r;
        values.forEach((val, colIdx) => {
          if (!val) return;
          const str = String(val).toLowerCase().trim();

          // Full Name combined
          if (
            str.includes("الاسم واللقب") ||
            str.includes("اللقب والاسم") ||
            str.includes("nom et prénom") ||
            str.includes("nom et prenom") ||
            str.includes("nom complet") ||
            str.includes("full name")
          ) {
            colMap["fullName"] = colIdx;
          }
          // National ID
          else if (
            str.includes("المعرف") ||
            str.includes("معرف") ||
            str.includes("national") ||
            str.includes("matricule") ||
            str.includes("identifiant") ||
            str === "cin" ||
            str === "id"
          ) {
            colMap["nationalId"] = colIdx;
          }
          // Surname / Nom
          else if (
            str.includes("اللقب") ||
            str.includes("لقب") ||
            ((str.includes("nom") || str.includes("last")) &&
              !str.includes("prénom") &&
              !str.includes("prenom"))
          ) {
            colMap["surname"] = colIdx;
          }
          // First name / Prénom
          else if (
            str.includes("الاسم") ||
            str.includes("الإسم") ||
            str.includes("إسم") ||
            str.includes("prénom") ||
            str.includes("prenom") ||
            str.includes("first")
          ) {
            colMap["name"] = colIdx;
          }
          // Sex / Genre
          else if (
            str.includes("الجنس") ||
            str.includes("النوع") ||
            str.includes("sexe") ||
            str.includes("genre") ||
            str.includes("gender")
          ) {
            colMap["sex"] = colIdx;
          }
          // Level / Niveau
          else if (
            str.includes("المستوى") ||
            str.includes("مستوى") ||
            str.includes("niveau") ||
            str.includes("grade") ||
            str.includes("cycle")
          ) {
            colMap["level"] = colIdx;
          }
          // Class / Section
          else if (
            str.includes("القسم") ||
            str.includes("قسم") ||
            str.includes("classe") ||
            str.includes("class") ||
            str.includes("section") ||
            str.includes("groupe")
          ) {
            colMap["class"] = colIdx;
          }
          // Birthday
          else if (
            str.includes("تاريخ الولادة") ||
            str.includes("تاريخ الميلاد") ||
            str.includes("ميلاد") ||
            str.includes("ولادة") ||
            str.includes("naissance") ||
            str.includes("birthday") ||
            str.includes("dob")
          ) {
            colMap["birthday"] = colIdx;
          }
          // Phone / Parent Phone
          else if (
            str.includes("هاتف") ||
            str.includes("téléphone") ||
            str.includes("telephone") ||
            str.includes("tel") ||
            str.includes("mobile") ||
            str.includes("contact")
          ) {
            colMap["phone"] = colIdx;
          }
          // Parent Name
          else if (
            str.includes("ولي") ||
            str.includes("parent") ||
            str.includes("tuteur")
          ) {
            colMap["parentName"] = colIdx;
          }
        });
      }
    }

    const students: any[] = [];

    if (headerRowIdx !== -1) {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber <= headerRowIdx) return;
        const values = row.values as any[];
        if (!Array.isArray(values)) return;

        const rawNationalId = colMap["nationalId"] ? String(values[colMap["nationalId"]] || "").trim() : "";
        let rawName = colMap["name"] ? String(values[colMap["name"]] || "").trim() : "";
        let rawSurname = colMap["surname"] ? String(values[colMap["surname"]] || "").trim() : "";
        const rawSex = colMap["sex"] ? String(values[colMap["sex"]] || "").trim() : "";
        const rawLevel = colMap["level"] ? String(values[colMap["level"]] || "").trim() : "";
        const rawClass = colMap["class"] ? String(values[colMap["class"]] || "").trim() : "";
        const rawPhone = colMap["phone"] ? String(values[colMap["phone"]] || "").trim() : "";
        const rawParentName = colMap["parentName"] ? String(values[colMap["parentName"]] || "").trim() : "";
        const rawBirthday = colMap["birthday"] ? String(values[colMap["birthday"]] || "").trim() : "";

        // Handle single Full Name column if separate name/surname not found
        if ((!rawName || !rawSurname) && colMap["fullName"]) {
          const full = String(values[colMap["fullName"]] || "").trim();
          if (full) {
            const parts = full.split(/\s+/);
            if (parts.length === 1) {
              rawName = rawName || parts[0];
            } else {
              rawSurname = rawSurname || parts[0];
              rawName = rawName || parts.slice(1).join(" ");
            }
          }
        }

        if (!rawName && !rawNationalId && !rawSurname) return;

        // Extract 10-14 digit national ID or keep original if clean
        const nationalIdMatch = rawNationalId.match(/\d{8,14}/);
        const nationalId = nationalIdMatch ? nationalIdMatch[0] : rawNationalId;

        // Map level text (Arabic and French support)
        let levelId = 1;
        const lvlStr = (rawLevel + " " + rawClass).toLowerCase();
        if (
          lvlStr.includes("الأولى") ||
          lvlStr.includes("1ère") ||
          lvlStr.includes("1ere") ||
          lvlStr.includes("cp") ||
          /\b1\b/.test(lvlStr)
        )
          levelId = 1;
        else if (
          lvlStr.includes("الثانية") ||
          lvlStr.includes("2ème") ||
          lvlStr.includes("2eme") ||
          lvlStr.includes("ce1") ||
          /\b2\b/.test(lvlStr)
        )
          levelId = 2;
        else if (
          lvlStr.includes("الثالثة") ||
          lvlStr.includes("3ème") ||
          lvlStr.includes("3eme") ||
          lvlStr.includes("ce2") ||
          /\b3\b/.test(lvlStr)
        )
          levelId = 3;
        else if (
          lvlStr.includes("الرابعة") ||
          lvlStr.includes("4ème") ||
          lvlStr.includes("4eme") ||
          lvlStr.includes("cm1") ||
          /\b4\b/.test(lvlStr)
        )
          levelId = 4;
        else if (
          lvlStr.includes("الخامسة") ||
          lvlStr.includes("5ème") ||
          lvlStr.includes("5eme") ||
          lvlStr.includes("cm2") ||
          /\b5\b/.test(lvlStr)
        )
          levelId = 5;
        else if (
          lvlStr.includes("السادسة") ||
          lvlStr.includes("6ème") ||
          lvlStr.includes("6eme") ||
          /\b6\b/.test(lvlStr)
        )
          levelId = 6;
        else if (
          lvlStr.includes("التحضيرية") ||
          lvlStr.includes("0") ||
          lvlStr.includes("préscolaire") ||
          lvlStr.includes("prescolaire") ||
          lvlStr.includes("maternelle")
        )
          levelId = 0;

        // Map gender
        const lowerSex = rawSex.toLowerCase();
        const sex =
          rawSex.includes("أنثى") ||
          lowerSex.startsWith("f") ||
          lowerSex.includes("fem") ||
          lowerSex.includes("fille") ||
          lowerSex.includes("girl")
            ? "FEMALE"
            : "MALE";

        const username = nationalId
          ? `std_${nationalId.slice(-8)}`
          : `std_${Math.random().toString(36).substring(2, 8)}`;

        students.push({
          username,
          nationalId: nationalId || null,
          name: rawName,
          surname: rawSurname,
          sex,
          levelId,
          classId: null, // non classé
          parentPhone: rawPhone || undefined,
          parentName: rawParentName || undefined,
          birthday: rawBirthday || undefined,
        });
      });
    }

    // 2. Automatic AI Fallback if headers were not recognized or 0 students were parsed
    if (headerRowIdx === -1 || students.length === 0) {
      console.log("ℹ️ [parseStudentsFromExcel] Standard headers not detected or 0 rows parsed. Using AI fallback...");
      const textLines: string[] = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 100) return; // Keep context reasonable
        const vals = row.values as any[];
        if (!Array.isArray(vals)) return;
        const line = vals
          .map((v) => (v !== null && v !== undefined ? String(v).trim() : ""))
          .filter(Boolean)
          .join(" | ");
        if (line) textLines.push(line);
      });

      if (textLines.length > 0) {
        const textPayload = textLines.join("\n");
        const aiResult = await parseStudentsFromText(textPayload);
        if (aiResult.data && aiResult.data.length > 0) {
          return {
            success: true,
            data: aiResult.data,
            count: aiResult.data.length,
          };
        }
      }

      return {
        error:
          "En-têtes introuvables dans le fichier Excel (المعرف التربوي, الاسم, المستوى الدراسي). Veuillez vérifier les colonnes ou utiliser l'onglet Texte.",
      };
    }

    return {
      success: true,
      data: students,
      count: students.length,
    };
  } catch (err: any) {
    console.error("[parseStudentsFromExcel] Error:", err);

    // Fallback: try reading the file as text/CSV with AI
    try {
      const file = formData.get("file") as File;
      if (file) {
        const text = await file.text();
        if (text && text.length > 20) {
          const aiRes = await parseStudentsFromText(text.slice(0, 10000));
          if (aiRes.data && aiRes.data.length > 0) {
            return {
              success: true,
              data: aiRes.data,
              count: aiRes.data.length,
            };
          }
        }
      }
    } catch (_) {}

    return {
      error: "Erreur lors de la lecture du fichier Excel : " + (err?.message || "Format invalide"),
    };
  }
}
