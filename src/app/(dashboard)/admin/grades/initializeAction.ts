"use server";

import prisma from "../../../../lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Bulk initializes GradeSheets for all subjects in a given class and term.
 * Optimized with high-efficiency batch operations to prevent database timeouts.
 */
export async function initializeClassSheets(classId: number, term: number) {
  try {
    // 1. Parallel Fetch of foundational data
    const [subjects, students] = await Promise.all([
      prisma.subject.findMany(),
      prisma.student.findMany({ 
        where: { classId },
        select: { id: true } 
      }),
    ]);

    if (students.length === 0) {
      return { success: false, error: "No students found in this class." };
    }

    const studentIds = students.map(s => s.id);
    const subjectIds = subjects.map(s => s.id);

    // 2. Step 1: Bulk Create missing GradeSheets
    // Using createMany with skipDuplicates is significantly faster than upserting in a loop
    await prisma.gradeSheet.createMany({
      data: subjects.map(s => ({
        classId,
        subjectId: s.id,
        term,
        proofUrl: "",
        notes: "INITIALIZED_BULK",
      })),
      skipDuplicates: true,
    });

    // 3. Step 2: Retrieve the Sheet ID mapping
    // We need the IDs to link grades to their respective sheets
    const sheets = await prisma.gradeSheet.findMany({
      where: {
        classId,
        term,
      },
      select: {
        id: true,
        subjectId: true,
      }
    });

    const subjectToSheetMap = new Map(sheets.map(s => [s.subjectId, s.id]));

    // 4. Step 3: Identify missing grades across all subjects/students
    // Fetch all existing grades for this class/term in one go
    const existingGrades = await prisma.grade.findMany({
      where: {
        term,
        studentId: { in: studentIds },
        subjectId: { in: subjectIds },
      },
      select: {
        studentId: true,
        subjectId: true,
      }
    });

    const existingGradeSet = new Set(existingGrades.map(g => `${g.studentId}-${g.subjectId}`));

    // 5. Step 4: Construct the bulk insertion payload
    const gradesToCreate = [];
    for (const subject of subjects) {
      const sheetId = subjectToSheetMap.get(subject.id);
      if (!sheetId) continue;

      for (const studentId of studentIds) {
        if (!existingGradeSet.has(`${studentId}-${subject.id}`)) {
          gradesToCreate.push({
            studentId: studentId,
            subjectId: subject.id,
            term,
            score: 0,
            sheetId: sheetId,
          });
        }
      }
    }

    // 6. Step 5: Execute final bulk insertion
    if (gradesToCreate.length > 0) {
      // Chunking if necessary for very large classes (e.g., thousands of combinations)
      // but for standard school classes, createMany is extremely efficient.
      await prisma.grade.createMany({
        data: gradesToCreate,
        skipDuplicates: true,
      });
    }

    revalidatePath("/list/results");
    revalidatePath("/admin/grades");
    
    return { success: true };
  } catch (error: any) {
    console.error("Initialization Error:", error);
    return { 
      success: false, 
      error: error.message || "Failed to initialize sheets. Please try again." 
    };
  }
}
