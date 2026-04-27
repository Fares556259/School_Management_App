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
        description: a.description,
        attachments: a.img ? a.img.split(',').map((uri: string) => ({ 
          type: uri.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE', 
          uri: uri 
        })) : [],
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, title, description, attachments } = body;

    if (!teacherId || !classId || !title) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    const schoolId = teacher.schoolId;
    const now = new Date();
    
    // Find a lesson for this class/teacher today or the most recent one
    let lesson = await prisma.lesson.findFirst({
      where: {
        schoolId,
        classId: parseInt(classId),
        teacherId
      },
      orderBy: { startTime: 'desc' }
    });

    // If no lesson exists, create a dummy one to hold the task
    if (!lesson) {
      lesson = await prisma.lesson.create({
        data: {
          name: "General Session",
          day: "MONDAY", // Placeholder
          startTime: now,
          endTime: now,
          subjectId: (await prisma.subject.findFirst({ where: { schoolId } }))?.id || 1,
          classId: parseInt(classId),
          teacherId,
          schoolId
        }
      });
    }

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || "",
        startDate: now,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        lessonId: lesson.id,
        schoolId: schoolId,
        img: attachments && attachments.length > 0 ? attachments.map((a: any) => a.uri).join(',') : null
      }
    });

    return NextResponse.json({ success: true, id: assignment.id });
  } catch (error: any) {
    console.error("[Teacher Tasks POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
