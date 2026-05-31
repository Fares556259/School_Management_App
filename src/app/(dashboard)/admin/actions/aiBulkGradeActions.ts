"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { callGeminiDirect } from "./aiActions";

// A simple string similarity function (Levenshtein distance based or just substring match)
// For simplicity, we use a basic inclusion/token match.
function findBestMatch(query: string, candidates: { id: any, name: string }[]): any | null {
  if (!query) return null;
  const q = query.toLowerCase().trim();
  
  // 1. Exact match
  const exact = candidates.find(c => c.name.toLowerCase() === q);
  if (exact) return exact.id;

  // 2. Token inclusion (highest match)
  let bestMatch = null;
  let maxScore = 0;
  
  const qTokens = q.split(/\s+/);
  
  for (const c of candidates) {
    const cName = c.name.toLowerCase();
    let score = 0;
    
    // Check if the whole query is included
    if (cName.includes(q)) score += 5;
    if (q.includes(cName)) score += 5;
    
    // Token matching
    for (const t of qTokens) {
      if (t.length > 2 && cName.includes(t)) score += 1;
    }
    
    if (score > maxScore) {
      maxScore = score;
      bestMatch = c.id;
    }
  }
  
  return maxScore > 0 ? bestMatch : null;
}

export async function processBulkGrades(publicUrls: string[], termAssumed: number) {
  try {
    const results: any[] = [];
    
    // 1. Fetch Dictionary for Matching
    const classes = await prisma.class.findMany({ select: { id: true, name: true } });
    const subjects = await prisma.subject.findMany({ select: { id: true, name: true } });
    const students = await prisma.student.findMany({ select: { id: true, name: true, surname: true, classId: true } });
    
    const formattedStudents = students.map(s => ({
      id: s.id,
      name: `${s.name} ${s.surname}`.trim(),
      classId: s.classId
    }));

    const systemPrompt = `
      You are an OCR and data extraction AI for SnapSchool. 
      Analyze the provided image of a grade sheet. 
      Extract the following information:
      1. Class Name (e.g., '10A', 'Terminale Math', '4ème C')
      2. Subject Name (e.g., 'Mathematics', 'Physique', 'Arabic')
      3. Term Number (Extract the term, trimester, or semester if written, e.g., 1, 2, or 3. If not found, return null)
      4. Teacher Name (Extract if mentioned, e.g. 'Mr. Smith', 'Mme. Dubois'. If not found, return null)
      5. A list of students and their corresponding numerical scores (0-20 or 0-100).
      
      CRITICAL: Return ONLY a valid JSON object in this exact format, with no markdown formatting or extra text:
      {
        "className": "String",
        "subjectName": "String",
        "term": 1, 
        "teacherName": "String",
        "students": [
          { "name": "Student Full Name", "score": 18.5 }
        ]
      }
    `;

    for (const url of publicUrls) {
      let documentResult = { url, success: false, classMatch: null as any, subjectMatch: null as any, termMatch: null as any, teacherMatch: null as any, gradesImported: 0, errors: [] as string[] };
      
      try {
        // Fetch image and convert to base64
        const imageRes = await fetch(url);
        if (!imageRes.ok) throw new Error("Failed to fetch image from Supabase.");
        const arrayBuffer = await imageRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        // Call Gemini
        const aiResponse = await callGeminiDirect(systemPrompt, base64);
        
        // Clean JSON response (if wrapped in markdown)
        const cleanedJson = aiResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
        let extractedData;
        try {
          extractedData = JSON.parse(cleanedJson);
        } catch (e) {
          throw new Error("AI could not read any valid grades from this image. Ensure it is a clear grade sheet.");
        }
        
        if (!extractedData.className || !extractedData.subjectName) {
           throw new Error("AI could not detect Class or Subject.");
        }
        
        // 2. Fuzzy Matching
        const matchedClassId = findBestMatch(extractedData.className, classes);
        const matchedSubjectId = findBestMatch(extractedData.subjectName, subjects);
        
        if (!matchedClassId) {
          throw new Error(`Could not match extracted class name: '${extractedData.className}' to any database class.`);
        }
        if (!matchedSubjectId) {
           throw new Error(`Could not match extracted subject name: '${extractedData.subjectName}' to any database subject.`);
        }
        
        const matchedClass = classes.find(c => c.id === matchedClassId)?.name;
        const matchedSubject = subjects.find(s => s.id === matchedSubjectId)?.name;
        
        documentResult.classMatch = matchedClass;
        documentResult.subjectMatch = matchedSubject;
        
        const finalTerm = (extractedData.term !== null && !isNaN(Number(extractedData.term))) 
          ? Number(extractedData.term) 
          : termAssumed;

        documentResult.termMatch = finalTerm;
        documentResult.teacherMatch = extractedData.teacherName || null;

        // 3. Database Operations (Upsert GradeSheet)
        const schoolId = "default_school"; // Assuming single school architecture for now based on schema
        
        let gradeSheet = await prisma.gradeSheet.findUnique({
          where: {
            classId_subjectId_term: {
              classId: matchedClassId,
              subjectId: matchedSubjectId,
              term: finalTerm
            }
          }
        });
        
        if (!gradeSheet) {
          gradeSheet = await prisma.gradeSheet.create({
            data: {
              classId: matchedClassId,
              subjectId: matchedSubjectId,
              term: finalTerm,
              proofUrl: url,
              schoolId: schoolId
            }
          });
        } else if (!gradeSheet.proofUrl) {
          await prisma.gradeSheet.update({
            where: { id: gradeSheet.id },
            data: { proofUrl: url }
          });
        }
        
        // 4. Student Matching & Grades Upsert
        let imported = 0;
        const classStudents = formattedStudents.filter(s => s.classId === matchedClassId);
        
        for (const extStudent of extractedData.students || []) {
           const matchedStudentId = findBestMatch(extStudent.name, classStudents);
           if (!matchedStudentId) {
             documentResult.errors.push(`Could not match student: '${extStudent.name}'`);
             continue;
           }
           
           const score = parseFloat(extStudent.score);
           if (isNaN(score)) {
             documentResult.errors.push(`Invalid score for student '${extStudent.name}': ${extStudent.score}`);
             continue;
           }
           
           // Upsert Grade
           await prisma.grade.upsert({
              where: {
                studentId_subjectId_term: {
                  studentId: matchedStudentId,
                  subjectId: matchedSubjectId,
                  term: finalTerm
                }
              },
              create: {
                studentId: matchedStudentId,
                subjectId: matchedSubjectId,
                term: finalTerm,
                score: score,
                schoolId: schoolId,
                sheetId: gradeSheet.id
              },
              update: {
                score: score,
                sheetId: gradeSheet.id
              }
           });
           imported++;
        }
        
        documentResult.success = true;
        documentResult.gradesImported = imported;
        
      } catch (err: any) {
        documentResult.success = false;
        documentResult.errors.push(err.message);
      }
      
      results.push(documentResult);
    }
    
    revalidatePath("/list/results");
    revalidatePath("/list/results", "page");
    revalidatePath("/(dashboard)/list/results", "page");
    return { success: true, results };
    
  } catch (error: any) {
    console.error("Bulk AI Grade Processing Error:", error);
    return { success: false, error: error.message };
  }
}
