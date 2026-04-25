import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const schoolId = await getSchoolId();
    const { searchParams } = new URL(request.url);
    const teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    const lessons = await prisma.lesson.findMany({
      where: {
        schoolId,
        ...(teacherId && { teacherId }),
        ...(classId && { classId: parseInt(classId) }),
      },
      include: {
        subject: true,
        class: true,
        teacher: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(lessons);
  } catch (error) {
    console.error("Lessons API Error:", error);
    return NextResponse.json({ error: "Failed to fetch lessons" }, { status: 500 });
  }
}
