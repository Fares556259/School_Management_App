import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const body = await request.json();
    const { teacherId, classId, title, description, date, subjectId } = body;

    if (!teacherId || !classId || !title) {
      return new NextResponse("Missing required fields", { status: 400 });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    // Find a subject for this teacher if not provided
    let finalSubjectId = subjectId;
    if (!finalSubjectId) {
      const subject = await prisma.subject.findFirst({
        where: { teachers: { some: { id: teacherId } } }
      });
      finalSubjectId = subject?.id;
    }

    const lesson = await prisma.lesson.create({
      data: {
        name: title,

        classId: parseInt(classId),
        teacherId: teacherId,
        subjectId: finalSubjectId || 1, // Fallback if no subject
        schoolId: teacher.schoolId,
        day: "MONDAY", // We should probably determine the day from the date
        startTime: new Date(date),
        endTime: new Date(new Date(date).getTime() + 60 * 60 * 1000), // Default 1 hour
      }
    });

    return NextResponse.json({ success: true, lesson });
  } catch (error: any) {
    console.error("[Teacher Lesson POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
