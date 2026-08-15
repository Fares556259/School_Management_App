import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, schoolId: true, parentId: true },
    });

    if (!student) {
      return new NextResponse("Student not found", { status: 404 });
    }

    // Enforce ownership & school isolation
    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const grades = await prisma.grade.findMany({
      where: { studentId },
      include: { subject: true },
      orderBy: { term: "desc" },
    });

    // If no grades, we will still generate placeholders if levelConfig exists.
    // Otherwise it will just return empty.

    const terms = Array.from(new Set(grades.map((g) => g.term)));
    const subjectIds = Array.from(new Set(grades.map((g) => g.subjectId)));

    const classGrades = await prisma.grade.findMany({
      where: { term: { in: terms }, subjectId: { in: subjectIds }, student: { classId: student.classId } },
      select: { score: true, subjectId: true, term: true },
    });

    const averagesMap: Record<string, { total: number; count: number }> = {};
    classGrades.forEach((g) => {
      const key = `${g.subjectId}-${g.term}`;
      if (!averagesMap[key]) averagesMap[key] = { total: 0, count: 0 };
      averagesMap[key].total += g.score;
      averagesMap[key].count += 1;
    });

    const classObj = await prisma.class.findUnique({
      where: { id: student.classId ?? undefined },
      select: { level: true }
    });

    const { LEVEL_CONFIGS } = await import("@/lib/report-cards/level-config");
    const levelNum = classObj?.level?.level;
    const levelConfig = levelNum ? LEVEL_CONFIGS[levelNum] : undefined;

    let finalResults: any[] = [];
    const latestTerm = terms.length > 0 ? Math.max(...terms) : 1;
    const targetTerms = terms.length > 0 ? terms : [1];

    if (levelConfig) {
      targetTerms.forEach(term => {
        levelConfig.domains.forEach(domain => {
          domain.subjects.forEach(sub => {
            const matchingGrade = grades.find(g => g.term === term && g.subject.name.toLowerCase().includes(sub.search.trim().toLowerCase()));
            if (matchingGrade) {
              const avgData = averagesMap[`${matchingGrade.subjectId}-${term}`];
              const classAvg = avgData ? parseFloat((avgData.total / avgData.count).toFixed(2)) : matchingGrade.score;
              finalResults.push({
                id: matchingGrade.id,
                subject: sub.display,
                domain: domain.name,
                score: matchingGrade.score,
                classAverage: classAvg,
                term: term,
                date: matchingGrade.updatedAt
              });
            } else {
              finalResults.push({
                id: `placeholder-${sub.search}-${term}`,
                subject: sub.display,
                domain: domain.name,
                score: null,
                classAverage: null,
                term: term,
                date: new Date().toISOString()
              });
            }
          });
        });
      });
    } else {
      finalResults = grades.map((g) => {
        const avgData = averagesMap[`${g.subjectId}-${g.term}`];
        const classAvg = avgData ? parseFloat((avgData.total / avgData.count).toFixed(2)) : g.score;
        return {
          id: g.id,
          subject: g.subject.name,
          domain: g.subject.domain || "General",
          score: g.score,
          classAverage: classAvg,
          term: g.term,
          date: g.updatedAt
        };
      });
    }

    const termGrades = finalResults.filter((g) => g.term === latestTerm);
    const classSubjectsCount = await prisma.subject.count({ where: { schoolId: student.schoolId } });

    let finalTermAvg: number | null = null;
    const validGrades = termGrades.filter(g => g.score !== null);
    if (validGrades.length >= classSubjectsCount && classSubjectsCount > 0) {
      const domainMap: Record<string, typeof validGrades> = {};
      validGrades.forEach((g) => {
        const domain = g.domain;
        if (!domainMap[domain]) domainMap[domain] = [];
        domainMap[domain].push(g);
      });
      const domainAverages = Object.values(domainMap).map((dg) => dg.reduce((a, b) => a + b.score, 0) / dg.length);
      finalTermAvg = parseFloat((domainAverages.reduce((a, b) => a + b, 0) / domainAverages.length).toFixed(2));
    }

    return NextResponse.json({ results: finalResults, summary: { latestTerm, average: finalTermAvg, totalSubjects: termGrades.length } });
  } catch (error: any) {
    console.error("[Mobile Results Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
