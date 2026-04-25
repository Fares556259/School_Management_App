import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { getRole } from "@/lib/role";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const schoolId = await getSchoolId();
    const role = await getRole();
    const { userId } = auth();
    const { searchParams } = new URL(request.url);
    
    let teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    // If teacher role, force filter by their own ID unless specified (or even if specified for security)
    if (role === "teacher" && userId) {
      teacherId = userId;
    }

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
