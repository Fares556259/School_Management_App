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

    // Fetch classes via lessons/timetable to identify what they actually teach
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        lessons: { select: { classId: true } },
        timetable: { select: { classId: true } }
      }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    // Get unique class IDs strictly from lessons and timetable
    const allClassIds = Array.from(new Set([
      ...teacher.lessons.map(l => l.classId),
      ...teacher.timetable.map(t => t.classId)
    ]));

    // Fetch full details for all these classes
    const classesData = await prisma.class.findMany({
      where: { id: { in: allClassIds } },
      include: {
        _count: {
          select: { students: true, lessons: true }
        },
        level: true
      },
      orderBy: { name: 'asc' }
    });

    const classes = classesData.map(c => ({
      id: c.id,
      name: c.name,
      students: c._count.students,
      lessons: c._count.lessons,
      level: `${c.level.level}${c.name.match(/[a-zA-Z]/)?.[0] || ''}` // e.g. 1A, 2B
    }));

    return NextResponse.json(classes);
  } catch (error: any) {
    console.error("[Teacher Classes API Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
