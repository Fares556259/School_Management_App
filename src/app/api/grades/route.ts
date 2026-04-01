import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
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

    // Use a transaction to ensure all grades are saved correctly
    const results = await prisma.$transaction(
      scores.map((s) =>
        prisma.grade.upsert({
          where: {
            studentId_subjectId_term: {
              studentId,
              subjectId: s.subjectId,
              term,
            },
          },
          update: {
            score: s.score,
          },
          create: {
            studentId,
            subjectId: s.subjectId,
            term,
            score: s.score,
          },
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error saving grades:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
