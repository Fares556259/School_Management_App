import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, schoolId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // 1. Fetch student's grades
    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: {
        subject: true,
      },
      orderBy: { term: "desc" },
    });

    if (grades.length === 0) {
      return NextResponse.json({ results: [], summary: { average: 0, totalSubjects: 0 } });
    }

    // 2. Fetch all grades for the same class and terms to calculate averages
    const terms = Array.from(new Set(grades.map(g => g.term)));
    const subjectIds = Array.from(new Set(grades.map(g => g.subjectId)));

    const classGrades = await prisma.grade.findMany({
      where: {
        term: { in: terms },
        subjectId: { in: subjectIds },
        student: { classId: student.classId }
      },
      select: {
        score: true,
        subjectId: true,
        term: true
      }
    });

    // 3. Group class grades by Subject + Term
    const averagesMap: Record<string, { total: number, count: number }> = {};
    classGrades.forEach(g => {
      const key = `${g.subjectId}-${g.term}`;
      if (!averagesMap[key]) averagesMap[key] = { total: 0, count: 0 };
      averagesMap[key].total += g.score;
      averagesMap[key].count += 1;
    });

    // 4. Map results with class averages
    const results = grades.map(g => {
      const avgData = averagesMap[`${g.subjectId}-${g.term}`];
      const classAvg = avgData ? parseFloat((avgData.total / avgData.count).toFixed(2)) : g.score;
      
      return {
        id: g.id,
        subject: g.subject.name,
        score: g.score,
        classAverage: classAvg,
        term: g.term,
        date: g.updatedAt,
      };
    });

    // 5. Calculate overall term summary (assuming latest term)
    const latestTerm = Math.max(...terms);
    const termGrades = grades.filter(g => g.term === latestTerm);
    
    // Fetch total subjects for the student's class (in this system, all school subjects apply to all classes)
    const classSubjectsCount = await prisma.subject.count({
      where: { schoolId: student.schoolId }
    });

    let finalTermAvg: number | null = null;
    
    if (termGrades.length >= classSubjectsCount && classSubjectsCount > 0) {
      // Unify domain average logic for the mobile summary too
      const domainMap: Record<string, typeof termGrades> = {};
      termGrades.forEach(g => {
        const domain = g.subject.domain || "General";
        if (!domainMap[domain]) domainMap[domain] = [];
        domainMap[domain].push(g);
      });
      
      const domainAverages: number[] = [];
      Object.values(domainMap).forEach(domainGrades => {
        if (domainGrades.length > 0) {
          domainAverages.push(domainGrades.reduce((a, b) => a + b.score, 0) / domainGrades.length);
        }
      });
      
      const termAvg = domainAverages.length > 0
        ? domainAverages.reduce((a, b) => a + b, 0) / domainAverages.length
        : 0;
      finalTermAvg = parseFloat(termAvg.toFixed(2));
    }

    return NextResponse.json({
      results,
      summary: {
        latestTerm,
        average: finalTermAvg,
        totalSubjects: termGrades.length,
      }
    });

  } catch (error: any) {
    console.error("[Mobile Results Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
