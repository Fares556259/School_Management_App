import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import moment from "moment";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const teacherId = searchParams.get("teacherId");
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
    // Use the date string directly for moment to avoid timezone shifting issues with new Date()
    const dayName = moment(date || new Date()).format('dddd').toUpperCase();

    if (dayName === "SUNDAY") {
      return NextResponse.json({
        students: students.map(s => ({
          id: s.id,
          name: s.name,
          surname: s.surname,
          img: s.img,
          attendanceStatus: s.attendance[0]?.status || null
        })),
        assignments: [],
        resources: [],
        hasLesson: false
      });
    }
    
    const [assignments, resources, lessonCount, timetableCount] = await Promise.all([
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
          teacherId: teacherId || undefined,
          day: dayName as any
        }
      }),
      prisma.timetableSlot.count({
        where: {
          classId: parseInt(classId),
          teacherId: teacherId || undefined,
          day: dayName as any
        }
      })
    ]);

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
      hasLesson: lessonCount > 0 || timetableCount > 0
    });
  } catch (error: any) {
    console.error("[Teacher Students API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
