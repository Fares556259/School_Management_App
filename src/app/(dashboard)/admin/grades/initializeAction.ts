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

    // 2. Perform initialization in a transaction
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
          update: {}, // Don't overwrite existing notes/proof if they already exist
          create: {
            classId,
            subjectId: subject.id,
            term,
            proofUrl: "", // Empty proof initially
            notes: "INITIALIZED_BULK",
          },
        });

        // Initialize grades for all students to 0 if not already present
        // We use createMany for performance, but need to skip duplicates
        // Since sqlite doesn't support skipDuplicates in createMany well with composite keys sometimes,
        // we'll loop or use a more robust upsert strategy.
        // Actually, let's use a batch approach to find existing and add missing.
        
        for (const student of students) {
          await tx.grade.upsert({
            where: {
              studentId_subjectId_term: {
                studentId: student.id,
                subjectId: subject.id,
                term,
              },
            },
            update: {}, // Don't overwrite existing grades if they are already higher/different
            create: {
              studentId: student.id,
              subjectId: subject.id,
              term,
              score: 0,
              sheetId: sheet.id,
            },
          });
        }
      }
    });

    revalidatePath("/list/results");
    revalidatePath("/admin/grades");
    return { success: true };
  } catch (error: any) {
    console.error("Initialization Error:", error);
    return { success: false, error: error.message || "Failed to initialize sheets." };
  }
}
