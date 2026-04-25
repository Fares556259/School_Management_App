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

    // Fetch classes assigned to this teacher
    // A teacher can be linked to classes via the 'classes' relation or 'timetable'
    // We'll use the classes relation on the Teacher model
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        classes: {
          include: {
            _count: {
              select: { students: true, lessons: true }
            }
          }
        }
      }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    const classes = teacher.classes.map(c => ({
      id: c.id,
      name: c.name,
      students: c._count.students,
      lessons: c._count.lessons,
      // We could add more stats here like average attendance
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
