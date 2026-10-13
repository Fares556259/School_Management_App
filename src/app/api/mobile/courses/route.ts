import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { getCachedTenantData } from "@/lib/cache";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, schoolId: true, parentId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // Enforce ownership & school isolation
    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    if (!student.classId) return NextResponse.json([]);
    const classId = student.classId;

    const courseSummary = await getCachedTenantData(
      student.schoolId,
      "resources",
      ["mobile-course-summary-v2", classId],
      async () => {
        const lessonSelect = {
          assignments: { select: { id: true } },
          resources: {
            orderBy: { createdAt: "desc" as const },
            select: { id: true, title: true, description: true, url: true, createdAt: true },
          },
          teacher: { select: { name: true, surname: true } },
        };

        const subjects = await prisma.subject.findMany({
          where: { schoolId: student.schoolId, parentId: null },
          select: {
            id: true,
            name: true,
            lessons: {
              where: { classId },
              select: lessonSelect,
            },
            components: {
              select: {
                lessons: {
                  where: { classId },
                  select: lessonSelect,
                },
              },
            },
          },
        });

        return subjects.map((subject) => {
          const allLessons = [
            ...subject.lessons,
            ...subject.components.flatMap((component) => component.lessons),
          ];

          const tasksCount = allLessons.reduce(
            (count, lesson) => count + lesson.assignments.length,
            0
          );

          const allResources = allLessons.flatMap((lesson) =>
            lesson.resources.flatMap((resource) => {
              const urls = resource.url ? resource.url.split(",") : [];
              return urls.map((url, index) => ({
                id: urls.length > 1 ? `${resource.id}-${index}` : resource.id,
                title: urls.length > 1 ? `${resource.title} (${index + 1})` : resource.title,
                description: resource.description,
                url,
                createdAt: resource.createdAt,
                teacher: `${lesson.teacher?.name || ""} ${lesson.teacher?.surname || ""}`.trim() || undefined,
              }));
            })
          );

          const primaryTeacher = allLessons.find((lesson) => lesson.teacher)?.teacher;
          const teacherName = primaryTeacher
            ? `${primaryTeacher.name} ${primaryTeacher.surname}`
            : "Multiple Teachers";

          return {
            id: subject.id,
            name: subject.name,
            teacher: teacherName,
            tasksCount,
            resourcesCount: allResources.length,
            resources: allResources,
          };
        });
      },
      120
    );

    return NextResponse.json(courseSummary);
  } catch (error: any) {
    console.error("[Courses API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
