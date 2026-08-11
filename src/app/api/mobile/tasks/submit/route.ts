import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

// GET: Check if a student has completed a specific task
export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const assignmentId = searchParams.get("assignmentId");

    if (!studentId || !assignmentId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Verify student belongs to authenticated parent
    if (userType === "parent") {
      const student = await prisma.student.findUnique({
        where: { id: studentId, schoolId },
        select: { parentId: true },
      });
      if (!student || student.parentId !== userId) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    const existing = await prisma.result.findFirst({
      where: { studentId, assignmentId: parseInt(assignmentId) },
    });

    return NextResponse.json({ isCompleted: !!existing, img: existing?.img || null });
  } catch (error: any) {
    return NextResponse.json({ isCompleted: false });
  }
}

// POST: Mark a task as completed
export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const body = await request.json();
    const { studentId, assignmentId, imageUrl, files } = body;

    if (!studentId || !assignmentId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    // Verify student belongs to authenticated parent
    const student = await prisma.student.findUnique({
      where: { id: studentId, schoolId },
      select: { parentId: true, schoolId: true },
    });

    if (!student) {
      return new NextResponse(JSON.stringify({ error: "Student not found" }), { status: 404 });
    }

    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Check if already submitted
    const existing = await prisma.result.findFirst({
      where: { studentId, assignmentId: parseInt(assignmentId) },
    });

    if (existing) {
      return NextResponse.json({ success: true, message: "Already submitted" });
    }

    // Handle multiple file submissions
    const submissionImg = files && files.length > 0
      ? files.map((f: any) => f.url).join(",")
      : imageUrl || null;

    await prisma.result.create({
      data: {
        score: 100,
        studentId,
        assignmentId: parseInt(assignmentId),
        schoolId: student.schoolId || schoolId,
        img: submissionImg,
        submittedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Task Submit Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
