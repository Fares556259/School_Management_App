import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");

    if (!teacherId || !classId) {
      return NextResponse.json(
        { error: "teacherId and classId are required" },
        { status: 400 }
      );
    }

    // Fetch subjects directly assigned to the teacher and from lessons for this class
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        subjects: {
          select: { id: true, name: true, domain: true }
        },
        lessons: {
          where: { classId: Number(classId) },
          include: {
            subject: { select: { id: true, name: true, domain: true } }
          }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const subjectsMap = new Map();
    teacher.subjects.forEach(s => subjectsMap.set(s.id, s));
    teacher.lessons.forEach(l => {
      if (l.subject) subjectsMap.set(l.subject.id, l.subject);
    });

    const subjects = Array.from(subjectsMap.values());

    return NextResponse.json(subjects);
  } catch (error) {
    console.error("Failed to get subjects:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
