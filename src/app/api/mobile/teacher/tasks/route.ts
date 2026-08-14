import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { createAssignmentNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");

    if (!teacherId) {
      return new NextResponse(JSON.stringify({ error: "Missing teacherId" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const assignments = await prisma.assignment.findMany({
      where: {
        lesson: { teacherId }
      },
      include: {
        lesson: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
            subject: { select: { name: true } }
          }
        },
        _count: { select: { results: true } } // Optimize submission count without loading full result array
      },
      orderBy: { id: "desc" },
      take: 50 // Avoid massive payloads for mobile
    });

    // Map to a cleaner format for the mobile app
    const mappedTasks = assignments.map(a => {
      const totalStudents = a.lesson.class.id;
      const submitted = a._count.results;
      
      const now = new Date();
      const dueDate = new Date(a.dueDate);
      const isNoDueDate = !a.dueDate || dueDate.getFullYear() <= 1970;
      const isOverdue = !isNoDueDate && dueDate < now && submitted < totalStudents;

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
        startDate: a.startDate,
        dueDate: a.dueDate,
        dueDateLabel: isNoDueDate ? 'Non déterminée' : dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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
    studentCounts.forEach(c => {
      if (c.classId !== null) {
        studentCountMap[c.classId] = c._count.id;
      }
    });

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
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const body = await request.json();
    const { teacherId, classId, title, description, attachments, dueDate } = body;

    if (!title || !classId) {
      return new NextResponse(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse(JSON.stringify({ error: "Teacher not found" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
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

    const parsedDueDate = dueDate && !isNaN(new Date(dueDate).getTime()) ? new Date(dueDate) : new Date(0);

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description: description || "",
        startDate: now,
        dueDate: parsedDueDate,
        lessonId: lesson.id,
        schoolId: schoolId,
        img: attachments && attachments.length > 0 ? attachments.map((a: any) => a.uri).join(',') : null
      }
    });

    createAssignmentNotification(assignment.id).catch(console.error);

    return NextResponse.json({ success: true, id: assignment.id });
  } catch (error: any) {
    console.error("[Teacher Tasks POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
