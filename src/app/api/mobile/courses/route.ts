import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true }
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // 1. Get all subjects for this class
    const subjects = await prisma.subject.findMany({
      where: { 
        lessons: { some: { classId: student.classId } } 
      },
      include: {
        lessons: {
          where: { classId: student.classId },
          include: {
            assignments: {
              orderBy: { dueDate: 'desc' }
            },
            resources: {
              orderBy: { createdAt: 'desc' }
            },
            teacher: {
              select: { name: true, surname: true }
            }
          }
        }
      }
    });

    // 2. Format data grouped by subject
    const courseSummary = subjects.map(subject => {
      const allTasks = subject.lessons.flatMap(l => 
        l.assignments.map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDate,
          teacher: `${l.teacher?.name} ${l.teacher?.surname}`
        }))
      );

      const allResources = subject.lessons.flatMap(l => 
        l.resources.map(r => ({
          id: r.id,
          title: r.title,
          url: r.url,
          createdAt: r.createdAt,
          teacher: `${l.teacher?.name} ${l.teacher?.surname}`
        }))
      );

      return {
        id: subject.id,
        name: subject.name,
        teacher: subject.lessons[0]?.teacher ? `${subject.lessons[0].teacher.name} ${subject.lessons[0].teacher.surname}` : "Multiple Teachers",
        tasksCount: allTasks.length,
        resourcesCount: allResources.length,
        tasks: allTasks,
        resources: allResources
      };
    });

    return NextResponse.json(courseSummary);
  } catch (error: any) {
    console.error("[Courses API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
