import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = authenticateMobileRequest(req);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;
  if (userType !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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
    if (teacherId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch subjects directly assigned to the teacher and from lessons for this class
    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        subjects: {
          select: { 
            id: true, 
            name: true, 
            domain: true, 
            parentId: true,
            components: { select: { id: true, name: true, domain: true, parentId: true } }
          }
        },
        lessons: {
          where: { classId: Number(classId) },
          include: {
            subject: { 
              select: { 
                id: true, 
                name: true, 
                domain: true,
                parentId: true,
                components: { select: { id: true, name: true, domain: true, parentId: true } }
              } 
            }
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
