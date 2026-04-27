import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/teacher/task-submissions?assignmentId=123
 * Returns all students in the class for this assignment,
 * split into submitted (with photo if any) and pending lists.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return new NextResponse("Missing assignmentId", { status: 400 });
    }

    const assignment = await prisma.assignment.findUnique({
      where: { id: parseInt(assignmentId) },
      include: {
        lesson: {
          include: {
            class: {
              include: {
                students: {
                  select: {
                    id: true,
                    name: true,
                    surname: true,
                    img: true,
                  }
                }
              }
            }
          }
        },
        results: {
          where: { assignmentId: parseInt(assignmentId) },
          select: {
            studentId: true,
            img: true,
            submittedAt: true,
            score: true,
          }
        }
      }
    });

    if (!assignment) {
      return new NextResponse("Assignment not found", { status: 404 });
    }

    const submittedMap = new Map(
      assignment.results.map(r => [r.studentId, { img: r.img, submittedAt: r.submittedAt }])
    );

    // Try students from the nested include first; if empty (e.g. dummy lesson),
    // fall back to a direct query by classId
    let rawStudents = assignment.lesson.class?.students || [];
    if (rawStudents.length === 0 && assignment.lesson.classId) {
      rawStudents = await prisma.student.findMany({
        where: { classId: assignment.lesson.classId },
        select: { id: true, name: true, surname: true, img: true }
      });
    }

    const students = rawStudents.map((s: any) => ({
      id: s.id,
      name: `${s.name} ${s.surname}`,
      avatar: s.img,
      submitted: submittedMap.has(s.id),
      submissionImg: submittedMap.get(s.id)?.img || null,
      submittedAt: submittedMap.get(s.id)?.submittedAt || null,
    }));

    const submitted = students.filter((s: any) => s.submitted);
    const pending = students.filter((s: any) => !s.submitted);

    const total = students.length;
    const submittedCount = submitted.length;

    console.log(`[TaskSubmissions] assignmentId=${assignmentId} class=${assignment.lesson.classId} total=${total} submitted=${submittedCount}`);

    return NextResponse.json({
      assignmentId: assignment.id,
      title: assignment.title,
      className: assignment.lesson.class?.name || 'Class',
      totalStudents: total,
      submittedCount,
      submitted,
      pending,
    });
  } catch (error: any) {
    console.error("[Task Submissions Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
