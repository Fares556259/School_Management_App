"use server";

import prisma from "../../../../lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Bulk initializes GradeSheets for all subjects in a given class and term.
 * Each sheet will have all existing students initialized with a score of 0.
 */
export async function initializeClassSheets(classId: number, term: number) {
  try {
    // 1. Get all subjects and all students in this class
    const [subjects, students] = await Promise.all([
      prisma.subject.findMany(),
      prisma.student.findMany({ where: { classId } }),
    ]);

    if (students.length === 0) {
      return { success: false, error: "No students found in this class." };
    }

    // 2. Perform initialization in a transaction with an extended timeout
    await prisma.$transaction(async (tx) => {
      for (const subject of subjects) {
        // Create/find the sheet
        const sheet = await tx.gradeSheet.upsert({
          where: {
            classId_subjectId_term: {
              classId,
              subjectId: subject.id,
              term,
            },
          },
          update: {}, 
          create: {
            classId,
            subjectId: subject.id,
            term,
            proofUrl: "", 
            notes: "INITIALIZED_BULK",
          },
        });

        // 3. Optimized Bulk Grade Creation
        // Find students who DON'T have a grade for this subject/term yet
        const existingGrades = await tx.grade.findMany({
          where: {
            subjectId: subject.id,
            term,
            studentId: { in: students.map(s => s.id) }
          },
          select: { studentId: true }
        });

        const existingStudentIds = new Set(existingGrades.map(g => g.studentId));
        const missingStudents = students.filter(s => !existingStudentIds.has(s.id));

        if (missingStudents.length > 0) {
          // Use createMany for high-speed bulk insertion
          await tx.grade.createMany({
            data: missingStudents.map(s => ({
              studentId: s.id,
              subjectId: subject.id,
              term,
              score: 0,
              sheetId: sheet.id,
            })),
            skipDuplicates: true,
          });
        }
      }
    }, {
      timeout: 30000 // Extend to 30 seconds to prevent timeout on large classes
    });

    revalidatePath("/list/results");
    revalidatePath("/admin/grades");
    return { success: true };
  } catch (error: any) {
    console.error("Initialization Error:", error);
    return { success: false, error: error.message || "Failed to initialize sheets." };
  }
}
