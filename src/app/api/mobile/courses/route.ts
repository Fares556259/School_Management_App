import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

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

    const subjects = await prisma.subject.findMany({
      where: { schoolId: student.schoolId },
      include: {
        lessons: {
          where: { classId: student.classId },
          include: {
            assignments: { orderBy: { dueDate: "desc" } },
            resources: { orderBy: { createdAt: "desc" } },
            teacher: { select: { name: true, surname: true } },
          },
        },
      },
    });

    const courseSummary = subjects.map((subject) => {
      const allTasks = subject.lessons.flatMap((l) =>
        l.assignments.map((a) => ({ id: a.id, title: a.title, description: a.description, dueDate: a.dueDate, teacher: `${l.teacher?.name} ${l.teacher?.surname}` }))
      );
      const allResources = subject.lessons.flatMap((l) =>
        l.resources.flatMap((r) => {
          const urls = r.url ? r.url.split(",") : [];
          return urls.map((url, idx) => ({ id: urls.length > 1 ? `${r.id}-${idx}` : r.id, title: urls.length > 1 ? `${r.title} (${idx + 1})` : r.title, description: r.description, url, createdAt: r.createdAt, teacher: `${l.teacher?.name} ${l.teacher?.surname}` }));
        })
      );
      return { id: subject.id, name: subject.name, teacher: subject.lessons[0]?.teacher ? `${subject.lessons[0].teacher.name} ${subject.lessons[0].teacher.surname}` : "Multiple Teachers", tasksCount: allTasks.length, resourcesCount: allResources.length, tasks: allTasks, resources: allResources };
    });

    return NextResponse.json(courseSummary);
  } catch (error: any) {
    console.error("[Courses API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
