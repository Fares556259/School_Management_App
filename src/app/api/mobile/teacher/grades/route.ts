import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = authenticateMobileRequest(req);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;
  if (userType !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = await req.json();
    const { teacherId, classId, subjectId, term, grades, proofUrl } = body;

    if (!teacherId || classId === undefined || subjectId === undefined || term === undefined) {
      return NextResponse.json(
        { error: "teacherId, classId, subjectId, term are required" },
        { status: 400 }
      );
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return NextResponse.json(
        { error: "Teacher not found" },
        { status: 404 }
      );
    }

    const sheetUpdateData: any = { teacherId, schoolId: teacher.schoolId };
    if (proofUrl) sheetUpdateData.proofUrl = proofUrl;

    const sheet = await prisma.gradeSheet.upsert({
      where: {
        classId_subjectId_term: { classId, subjectId, term }
      },
      update: sheetUpdateData,
      create: { 
        classId, 
        subjectId, 
        term, 
        proofUrl: proofUrl || "", 
        teacherId, 
        schoolId: teacher.schoolId 
      }
    });

    const validGrades = (grades || [])
      .filter((g: any) => g.score !== null && g.score !== undefined && !isNaN(parseFloat(g.score)))
      .map((g: any) => ({
        ...g,
        score: Math.min(20, Math.max(0, parseFloat(g.score)))
      }));

    await prisma.$transaction(
      validGrades.map((g: any) =>
        prisma.grade.upsert({
          where: {
            studentId_subjectId_term: {
              studentId: g.studentId,
              subjectId,
              term
            }
          },
          update: {
            score: g.score,
            sheetId: sheet.id,
            schoolId: teacher.schoolId
          },
          create: {
            studentId: g.studentId,
            subjectId,
            term,
            score: g.score,
            sheetId: sheet.id,
            schoolId: teacher.schoolId
          }
        })
      )
    );

    return NextResponse.json({
      success: true,
      gradedCount: validGrades.length,
      sheetId: sheet.id
    });
  } catch (error) {
    console.error("Failed to save grades:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const auth = authenticateMobileRequest(req);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;
  if (userType !== "teacher") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const searchParams = req.nextUrl.searchParams;
    const teacherId = searchParams.get("teacherId");
    const classId = searchParams.get("classId");
    const termStr = searchParams.get("term");

    if (!teacherId || !classId || !termStr) {
      return NextResponse.json(
        { error: "teacherId, classId, and term are required" },
        { status: 400 }
      );
    }

    const term = Number(termStr);

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      include: {
        subjects: true,
        lessons: {
          where: { classId: Number(classId) },
          include: { subject: true }
        }
      }
    });

    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
    }

    const subjectsMap = new Map();
    teacher.subjects.forEach((s: any) => subjectsMap.set(s.id, s));
    teacher.lessons.forEach((l: any) => {
      if (l.subject) subjectsMap.set(l.subject.id, l.subject);
    });

    const subjectsData = Array.from(subjectsMap.values());

    const students = await prisma.student.findMany({
      where: { classId: Number(classId) },
      select: { id: true, name: true, surname: true },
      orderBy: { name: 'asc' }
    });

    const totalStudents = students.length;

    const subjectIds = subjectsData.map((s: any) => s.id);

    const allSheets = await prisma.gradeSheet.findMany({
      where: {
        classId: Number(classId),
        subjectId: { in: subjectIds },
        term
      }
    });

    const allGrades = await prisma.grade.findMany({
      where: {
        subjectId: { in: subjectIds },
        term,
        student: { classId: Number(classId) }
      }
    });

    const gradesBySubject = new Map();
    allGrades.forEach(grade => {
      if (!gradesBySubject.has(grade.subjectId)) {
        gradesBySubject.set(grade.subjectId, []);
      }
      gradesBySubject.get(grade.subjectId).push(grade);
    });

    const subjects = subjectsData.map((subject: any) => {
      const gradesForSubject = gradesBySubject.get(subject.id) || [];
      
      let gradesObj: Record<string, number> = {};
      for (const g of gradesForSubject) {
        gradesObj[g.studentId] = g.score;
      }
      
      const gradedCount = gradesForSubject.length;
      const graded = gradedCount > 0;

      return {
        id: subject.id,
        name: subject.name,
        domain: subject.domain,
        graded,
        gradedCount,
        totalStudents,
        grades: gradesObj
      };
    });

    return NextResponse.json({
      students,
      subjects
    });
  } catch (error) {
    console.error("Failed to get grades:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
