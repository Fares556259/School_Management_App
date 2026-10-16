import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { notifyTeacherTaskSubmitted } from "@/lib/notifications";
import { waitUntil } from "@vercel/functions";

function notifyTeacherInBackground(studentId: string, assignmentId: number) {
  const notification = notifyTeacherTaskSubmitted(studentId, assignmentId).catch((error) => {
    console.error("[Task Submit Notification Error]", error);
  });
  try {
    waitUntil(notification);
  } catch {
    void notification;
  }
}

// GET: Check if a student has completed a specific task
export async function GET(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const assignmentId = searchParams.get("assignmentId");

    if (!studentId || !assignmentId) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const student = await prisma.student.findFirst({
      where: { id: studentId, schoolId },
      select: { parentId: true, classId: true },
    });
    if (!student || (userType === "parent" && student.parentId !== userId)) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const numericAssignmentId = parseInt(assignmentId, 10);
    const [assignment, existing] = await Promise.all([
      prisma.assignment.findFirst({
        where: {
          id: numericAssignmentId,
          schoolId,
          lesson: { classId: student.classId ?? -1 },
        },
        include: { lesson: { include: { subject: true, teacher: true } } },
      }),
      prisma.result.findFirst({ where: { studentId, assignmentId: numericAssignmentId, schoolId } }),
    ]);

    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({
      isCompleted: !!existing,
      img: existing?.img || null,
      task: {
        id: assignment.id,
        isCompleted: !!existing,
        title: assignment.title,
        description: assignment.description,
        img: assignment.img,
        attachments: assignment.img
          ? assignment.img.split(",").map((url) => ({
              type: url.toLowerCase().split("?")[0].endsWith(".pdf") ? "PDF" : "IMAGE",
              url,
            }))
          : [],
        subject: assignment.lesson.subject.name,
        teacher: `${assignment.lesson.teacher.name} ${assignment.lesson.teacher.surname}`,
        dueDate: assignment.dueDate,
        startDate: assignment.startDate,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ isCompleted: false });
  }
}

// POST: Mark a task as completed
export async function POST(request: NextRequest) {
  const auth = await authenticateMobileRequest(request);
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
      where: { id: studentId },
      select: { parentId: true, schoolId: true, classId: true },
    });

    if (!student) {
      return new NextResponse(JSON.stringify({ error: "Student not found" }), { status: 404 });
    }

    if (student.schoolId !== schoolId || (userType === "parent" && student.parentId !== userId)) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const numericAssignmentId = parseInt(String(assignmentId), 10);
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: numericAssignmentId,
        schoolId,
        lesson: { classId: student.classId ?? -1 },
      },
      select: { id: true },
    });
    if (!assignment) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Handle multiple file submissions
    const submissionImg = files && files.length > 0
      ? files.map((f: any) => (typeof f === 'string' ? f : f.url)).join(",")
      : imageUrl || null;

    // Check if already submitted
    const existing = await prisma.result.findFirst({
      where: { studentId, assignmentId: numericAssignmentId, schoolId },
    });

    if (existing) {
      await prisma.result.update({
        where: { id: existing.id },
        data: {
          img: submissionImg,
          submittedAt: new Date(),
        }
      });
      notifyTeacherInBackground(studentId, numericAssignmentId);
      return NextResponse.json({ success: true, message: "Submission updated" });
    }

    await prisma.result.create({
      data: {
        score: 100,
        studentId,
        assignmentId: numericAssignmentId,
        schoolId: student.schoolId || schoolId,
        img: submissionImg,
        submittedAt: new Date(),
      },
    });

    notifyTeacherInBackground(studentId, numericAssignmentId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Task Submit Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
