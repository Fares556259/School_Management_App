import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId) {
      return new NextResponse("Missing classId", { status: 400 });
    }

    const today = date ? new Date(date) : new Date();
    today.setHours(0, 0, 0, 0);

    const students = await prisma.student.findMany({
      where: { classId: parseInt(classId) },
      include: {
        attendance: {
          where: {
            date: today,
          },
          take: 1,
        }
      },
      orderBy: { name: "asc" }
    });

    // Fetch assignments and resources for this class and date
    const dayName = moment(today).format('dddd').toUpperCase();
    
    const [assignments, resources, lessonCount] = await Promise.all([
      prisma.assignment.findMany({
        where: {
          lesson: { classId: parseInt(classId) },
          dueDate: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.resource.findMany({
        where: {
          lesson: { classId: parseInt(classId), day: dayName as any }
        }
      }),
      prisma.lesson.count({
        where: {
          classId: parseInt(classId),
          day: dayName as any
        }
      })
    ]);

    // Map to include status if it exists
    const studentData = students.map(s => ({
      id: s.id,
      name: s.name,
      surname: s.surname,
      img: s.img,
      attendanceStatus: s.attendance[0]?.status || null
    }));

    return NextResponse.json({
      students: studentData,
      assignments,
      resources,
      hasLesson: lessonCount > 0
    });
  } catch (error: any) {
    console.error("[Teacher Students API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
