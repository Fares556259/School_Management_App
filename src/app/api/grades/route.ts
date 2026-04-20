import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const gradeSchema = z.object({
  studentId: z.string(),
  term: z.number().min(1).max(3),
  scores: z.array(z.object({
    subjectId: z.number(),
    score: z.number().min(0).max(20),
  })),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const term = searchParams.get("term");

  if (!studentId || !term) {
    return NextResponse.json({ error: "Missing studentId or term" }, { status: 400 });
  }

  try {
    const grades = await prisma.grade.findMany({
      where: {
        studentId,
        term: parseInt(term),
      },
      include: {
        subject: true,
      },
    });
    return NextResponse.json(grades);
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const role = await getRole();
  if (role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const validatedData = gradeSchema.parse(body);
    const { studentId, term, scores } = validatedData;

    // 1. Find the student's class to look for corresponding sheets
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // Use a transaction to ensure all grades are saved correctly
    const results = await prisma.$transaction(async (tx) => {
      const updates = [];
      
      for (const s of scores) {
        // 2. Look for an existing GradeSheet for this Class + Subject + Term
        const existingSheet = await tx.gradeSheet.findUnique({
          where: {
            classId_subjectId_term: {
              classId: student.classId,
              subjectId: s.subjectId,
              term,
            },
          },
          select: { id: true },
        });

        const update = tx.grade.upsert({
          where: {
            studentId_subjectId_term: {
              studentId,
              subjectId: s.subjectId,
              term,
            },
          },
          update: {
            score: s.score,
            sheetId: existingSheet?.id || undefined,
          },
          create: {
            studentId,
            subjectId: s.subjectId,
            term,
            score: s.score,
            sheetId: existingSheet?.id || undefined,
          },
        });
        updates.push(update);
      }
      
      return Promise.all(updates);
    });

    // 3. Trigger Revalidation for all relevant dashboards
    revalidatePath("/admin/grades");
    revalidatePath("/list/results");

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error saving grades:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
