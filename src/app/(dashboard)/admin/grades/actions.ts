"use server";

import prisma from "../../../../lib/prisma";
import { revalidatePath } from "next/cache";

export interface GradeEntry {
  studentId: string;
  score: number | null; // null = absent/no grade
}

export async function createGradeSheet(data: {
  classId: number;
  subjectId: number;
  term: number;
  proofUrl: string;
  teacherId?: string;
  notes?: string;
  grades: GradeEntry[];
}) {
  const { classId, subjectId, term, proofUrl, teacherId, notes, grades } = data;

  // Upsert the GradeSheet record
  const sheet = await prisma.gradeSheet.upsert({
    where: { classId_subjectId_term: { classId, subjectId, term } },
    update: { proofUrl, notes, teacherId: teacherId || null },
    create: { classId, subjectId, term, proofUrl, teacherId: teacherId || null, notes },
  });

  // Bulk upsert individual grades
  const validGrades = grades.filter((g) => g.score !== null);

  await Promise.all(
    validGrades.map((g) =>
      prisma.grade.upsert({
        where: { studentId_subjectId_term: { studentId: g.studentId, subjectId, term } },
        update: { score: g.score!, sheetId: sheet.id },
        create: { studentId: g.studentId, subjectId, term, score: g.score!, sheetId: sheet.id },
      })
    )
  );

  revalidatePath("/admin/grades");
  revalidatePath("/list/results");
  return { success: true, sheetId: sheet.id };
}

export async function getGradeSheet(classId: number, subjectId: number, term: number) {
  const sheet = await prisma.gradeSheet.findUnique({
    where: { classId_subjectId_term: { classId, subjectId, term } },
    include: {
      grades: { include: { student: true } },
      teacher: true,
      subject: true,
      class: true,
    },
  });

  if (sheet) return sheet;

  // Fallback: If no sheet exists, check if any grades exist for this combination
  // (Handling legacy or orphaned grades before the sync fix was applied)
  const orphanedGrades = await prisma.grade.findMany({
    where: {
      term,
      subjectId,
      student: { classId }
    },
    include: { student: true }
  });

  if (orphanedGrades.length > 0) {
    return {
      id: null, // Indicates no physical sheet record yet
      classId,
      subjectId,
      term,
      proofUrl: "",
      notes: "FETCHED_ORPHANED_GRADES",
      teacherId: null,
      grades: orphanedGrades
    };
  }

  return null;
}

export async function getAllGradeSheets(classId?: number, subjectId?: number, term?: number) {
  return prisma.gradeSheet.findMany({
    where: {
      ...(classId ? { classId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(term ? { term } : {}),
    },
    include: {
      class: { select: { name: true } },
      subject: { select: { name: true } },
      teacher: { select: { name: true, surname: true } },
      grades: { select: { id: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}
