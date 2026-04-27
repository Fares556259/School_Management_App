import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

// GET: Check if a student has completed a specific task
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const assignmentId = searchParams.get("assignmentId");

    if (!studentId || !assignmentId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const existing = await prisma.result.findFirst({
      where: {
        studentId,
        assignmentId: parseInt(assignmentId)
      }
    });

    return NextResponse.json({ isCompleted: !!existing, img: existing?.img || null });
  } catch (error: any) {
    return NextResponse.json({ isCompleted: false });
  }
}

// POST: Mark a task as completed
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, assignmentId, imageUrl } = body;

    if (!studentId || !assignmentId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Check if already submitted
    const existing = await prisma.result.findFirst({
      where: {
        studentId,
        assignmentId: parseInt(assignmentId)
      }
    });

    if (existing) {
      return NextResponse.json({ success: true, message: "Already submitted" });
    }

    // Look up the student's schoolId
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true }
    });

    await prisma.result.create({
      data: {
        score: 100,
        studentId,
        assignmentId: parseInt(assignmentId),
        schoolId: student?.schoolId || "default_school",
        img: imageUrl || null,
        submittedAt: new Date(),
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Task Submit Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
