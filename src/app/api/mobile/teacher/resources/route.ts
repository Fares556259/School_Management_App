import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/teacher/resources?classId=X&teacherId=Y
 * Returns all resources uploaded for a class, grouped by lesson
 */
export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");

    if (!classId || !teacherId) {
      return new NextResponse("Missing classId or teacherId", { status: 400 });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

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

    const slots: any[] = await prisma.timetableSlot.findMany({
      where: { classId: parseInt(classId), teacherId: teacherId || undefined, isDraft: false },
      include: { subject: true }
    });
    const subjectMap = new Map();
    slots.forEach(s => {
      if (s.subject) {
        subjectMap.set(s.subject.id, { id: s.subject.id, name: s.subject.name });
      }
    });

    if (subjectMap.size === 0) {
      const teacherSubjects = await prisma.subject.findMany({
        where: { teachers: { some: { id: teacherId } } }
      });
      teacherSubjects.forEach(s => {
        subjectMap.set(s.id, { id: s.id, name: s.name });
      });
    }

    const classSubjects = Array.from(subjectMap.values());

    const formatted = resources.flatMap(r => {
      const urls = r.url ? r.url.split(',') : [];
      return urls.map((url, idx) => ({
        id: urls.length > 1 ? `${r.id}-${idx}` : r.id,
        title: urls.length > 1 ? `${r.title} (${idx + 1})` : r.title,
        description: r.description,
        url: url,
        createdAt: r.createdAt,
        subject: r.lesson.subject?.name || "General",
        teacher: `${r.lesson.teacher.name} ${r.lesson.teacher.surname}`,
        lessonId: r.lessonId,
      }));
    });

    return NextResponse.json({
      resources: formatted,
      classSubjects
    });
  } catch (error: any) {
    console.error("[Teacher Resources GET Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const body = await request.json();
    const { teacherId, classId, title, description, url, subjectId } = body;

    if (!teacherId || !classId || !title || !url) {
      return new NextResponse("Missing required fields", { status: 400 });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });
    if (!teacher) return new NextResponse("Teacher not found", { status: 404 });

    // Determine the subjectId to use
    let finalSubjectId = subjectId ? parseInt(subjectId) : null;
    if (!finalSubjectId) {
      // Find the first subject this teacher teaches in this specific class
      const classSlot = await prisma.timetableSlot.findFirst({
        where: { classId: parseInt(classId), teacherId, isDraft: false },
        select: { subjectId: true }
      });
      if (classSlot && classSlot.subjectId) {
        finalSubjectId = classSlot.subjectId;
      } else {
        const classLesson = await prisma.lesson.findFirst({
          where: { classId: parseInt(classId), teacherId },
          select: { subjectId: true }
        });
        if (classLesson) {
          finalSubjectId = classLesson.subjectId;
        } else {
          // Fallback to global profile subject
          const subject = await prisma.subject.findFirst({
            where: { teachers: { some: { id: teacherId } } }
          });
          finalSubjectId = subject?.id || 1;
        }
      }
    }

    // Find or create a "General" lesson for this teacher+class+subject strictly
    let lesson = await prisma.lesson.findFirst({
      where: { 
        classId: parseInt(classId), 
        teacherId, 
        subjectId: finalSubjectId,
        name: "General Materials" 
      }
    });

    if (!lesson) {
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

    const urls = resource.url ? resource.url.split(',') : [];
    const expanded = urls.map((u, idx) => ({
      id: urls.length > 1 ? `${resource.id}-${idx}` : resource.id,
      title: urls.length > 1 ? `${resource.title} (${idx + 1})` : resource.title,
      description: resource.description,
      url: u,
      createdAt: resource.createdAt,
      subject: resource.lesson.subject?.name || "General",
      teacher: `${resource.lesson.teacher.name} ${resource.lesson.teacher.surname}`,
      lessonId: resource.lessonId,
    }));

    try {
      const { invalidateTenantTags } = await import("@/lib/cache");
      invalidateTenantTags(teacher.schoolId, 'resources');
    } catch (cacheErr) {
      console.warn("[Cache Invalidation Error]", cacheErr);
    }

    return NextResponse.json(expanded);
  } catch (error: any) {
    console.error("[Teacher Resources POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
