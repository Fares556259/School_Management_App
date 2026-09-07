"use server";

import prisma from "../../../../lib/prisma";
import { revalidatePath } from "next/cache";
import { getSchoolId } from "@/lib/school";
import { invalidateTenantTags } from "@/lib/cache";
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
  const schoolId = await getSchoolId();

  // Upsert the GradeSheet record
  const sheet = await prisma.gradeSheet.upsert({
    where: { classId_subjectId_term: { classId, subjectId, term } },
    update: { proofUrl, notes, teacherId: teacherId || null, schoolId },
    create: { classId, subjectId, term, proofUrl, teacherId: teacherId || null, notes, schoolId },
  });

  // Filter valid grades (strictly capped between 0 and 20)
  const validGrades = grades
    .filter((g) => g.score !== null && g.score !== undefined && !isNaN(g.score))
    .map((g) => ({
      ...g,
      score: Math.min(20, Math.max(0, g.score!))
    }));

  if (validGrades.length > 0) {
    const studentIds = validGrades.map((g) => g.studentId);

    // Batch lookup all existing grades for these students in this subject/term in 1 query
    const existingGrades = await prisma.grade.findMany({
      where: {
        subjectId,
        term,
        studentId: { in: studentIds },
      },
      select: { id: true, studentId: true, score: true, sheetId: true },
    });

    const existingMap = new Map(existingGrades.map((eg) => [eg.studentId, eg]));

    const toCreate: {
      studentId: string;
      subjectId: number;
      term: number;
      score: number;
      sheetId: number;
      schoolId: string;
    }[] = [];

    const toUpdate: {
      id: number;
      score: number;
      sheetId: number;
    }[] = [];

    for (const g of validGrades) {
      const existing = existingMap.get(g.studentId);
      if (!existing) {
        toCreate.push({
          studentId: g.studentId,
          subjectId,
          term,
          score: g.score,
          sheetId: sheet.id,
          schoolId,
        });
      } else if (existing.score !== g.score || existing.sheetId !== sheet.id) {
        toUpdate.push({
          id: existing.id,
          score: g.score,
          sheetId: sheet.id,
        });
      }
    }

    // 1 single batch insert for all new grades
    if (toCreate.length > 0) {
      await prisma.grade.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    // Single batched transaction for only the grades that actually changed
    if (toUpdate.length > 0) {
      await prisma.$transaction(
        toUpdate.map((u) =>
          prisma.grade.update({
            where: { id: u.id },
            data: { score: u.score, sheetId: u.sheetId },
          })
        )
      );
    }
  }

  invalidateTenantTags(schoolId, 'exams');
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
  const schoolId = await getSchoolId();
  return prisma.gradeSheet.findMany({
    where: {
      schoolId,
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
