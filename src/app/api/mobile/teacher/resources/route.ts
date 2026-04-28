import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/teacher/resources?classId=X&teacherId=Y
 * Returns all resources uploaded for a class, grouped by lesson
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");

    if (!classId) return new NextResponse("Missing classId", { status: 400 });

    const resources = await prisma.resource.findMany({
      where: {
        lesson: { classId: parseInt(classId) }
      },
      include: {
        lesson: {
          include: { subject: true, teacher: { select: { name: true, surname: true } } }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(
      resources.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        url: r.url,
        createdAt: r.createdAt,
        subject: r.lesson.subject?.name || "General",
        teacher: `${r.lesson.teacher.name} ${r.lesson.teacher.surname}`,
        lessonId: r.lessonId,
      }))
    );
  } catch (error: any) {
    console.error("[Teacher Resources GET Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, title, description, url, subjectId } = body;

    if (!teacherId || !classId || !title || !url) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });
    if (!teacher) return new NextResponse("Teacher not found", { status: 404 });

    // Find or create a "General" lesson for this teacher+class+subject
    let lesson = await prisma.lesson.findFirst({
      where: { 
        classId: parseInt(classId), 
        teacherId, 
        subjectId: subjectId ? parseInt(subjectId) : undefined,
        name: "General Materials" 
      }
    });

    if (!lesson) {
      // If subjectId wasn't provided, try to find one for this teacher
      let finalSubjectId = subjectId ? parseInt(subjectId) : null;
      if (!finalSubjectId) {
        const subject = await prisma.subject.findFirst({
          where: { teachers: { some: { id: teacherId } } }
        });
        finalSubjectId = subject?.id || 1;
      }

      const now = new Date();
      lesson = await prisma.lesson.create({
        data: {
          name: "General Materials",
          classId: parseInt(classId),
          teacherId,
          subjectId: finalSubjectId,
          schoolId: teacher.schoolId,
          day: "MONDAY",
          startTime: now,
          endTime: now,
        }
      });
    }

    const resource = await prisma.resource.create({
      data: {
        title,
        description: description || "",
        url,
        lessonId: lesson.id,
        schoolId: teacher.schoolId,
      },
      include: {
        lesson: { include: { subject: true, teacher: { select: { name: true, surname: true } } } }
      }
    });

    return NextResponse.json({
      id: resource.id,
      title: resource.title,
      description: resource.description,
      url: resource.url,
      createdAt: resource.createdAt,
      subject: resource.lesson.subject?.name || "General",
      teacher: `${resource.lesson.teacher.name} ${resource.lesson.teacher.surname}`,
      lessonId: resource.lessonId,
    });
  } catch (error: any) {
    console.error("[Teacher Resources POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
