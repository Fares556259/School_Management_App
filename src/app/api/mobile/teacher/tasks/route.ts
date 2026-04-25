import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");

    if (!teacherId) {
      return new NextResponse("Missing teacherId", { status: 400 });
    }

    // Fetch assignments given by this teacher
    const assignments = await prisma.assignment.findMany({
      where: {
        lesson: { teacherId }
      },
      include: {
        lesson: {
          include: {
            class: true,
            subject: true
          }
        },
        results: true // To calculate submission rate
      },
      orderBy: { dueDate: "desc" }
    });

    // Map to a cleaner format for the mobile app
    const mappedTasks = assignments.map(a => {
      const totalStudents = a.lesson.class.id; // We'll get actual count below
      const submitted = a.results.length;
      
      const now = new Date();
      const dueDate = new Date(a.dueDate);
      const isOverdue = dueDate < now && submitted < totalStudents;

      return {
        id: a.id,
        title: a.title,
        subject: a.lesson.subject.name,
        className: a.lesson.class.name,
        submitted: submitted,
        total: 0, // Placeholder
        dueDateLabel: dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isOverdue
      };
    });

    // Get actual student counts per class to calculate submission rate correctly
    const classIds = Array.from(new Set(assignments.map(a => a.lesson.classId)));
    const studentCounts = await prisma.student.groupBy({
      by: ['classId'],
      _count: { id: true },
      where: { classId: { in: classIds } }
    });

    const studentCountMap: Record<string, number> = {};
    studentCounts.forEach(c => studentCountMap[c.classId] = c._count.id);

    mappedTasks.forEach((task, index) => {
      const classId = assignments[index].lesson.classId;
      task.total = studentCountMap[classId] || 0;
    });

    return NextResponse.json(mappedTasks);
  } catch (error: any) {
    console.error("[Teacher Tasks API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
