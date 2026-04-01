import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const termStr = searchParams.get("term");

  if (!studentId || !termStr) {
    return NextResponse.json({ error: "Missing studentId or term" }, { status: 400 });
  }

  const term = parseInt(termStr);

  try {
    // 1. Fetch Student, Class, and All Subjects
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: { class: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const allSubjects = await prisma.subject.findMany();
    const studentGrades = await prisma.grade.findMany({
      where: { studentId, term },
    });

    // 2. Fetch All Students in the same Class for Ranking and Stats
    const classStudents = await prisma.student.findMany({
      where: { classId: student.classId },
      include: {
        grades: {
          where: { term },
        },
      },
    });

    // 3. Helper to calculate student general average
    const calculateAverage = (grades: { score: number; subjectId: number }[]) => {
      // Logic: Only divide by subjects that have a grade
      const subjectsWithGrades = new Set(grades.map(g => g.subjectId));
      if (subjectsWithGrades.size === 0) return 0;
      const totalScore = grades.reduce((acc, g) => acc + g.score, 0);
      return totalScore / subjectsWithGrades.size;
    };

    // 4. Calculate averages for all students in class to find rank and max/min
    const studentAverages = classStudents.map((s) => ({
      id: s.id,
      average: calculateAverage(s.grades),
    }));

    // Sort by average descending
    const sortedAverages = [...studentAverages].sort((a, b) => b.average - a.average);
    const rank = sortedAverages.findIndex((a) => a.id === studentId) + 1;

    const averagesList = studentAverages.map((a) => a.average);
    const maxAverage = Math.max(...averagesList);
    const minAverage = Math.min(...averagesList);

    // 5. Group student's own grades by domain
    const domains = Array.from(new Set(allSubjects.map((s) => s.domain)));
    const reportData = domains.map((domain) => {
      const subjectList = allSubjects.filter((s) => s.domain === domain);
      const domainGrades = studentGrades.filter((g) => 
        subjectList.some((s) => s.id === g.subjectId)
      );

      const subjectsWithScores = subjectList.map((s) => {
        const grade = domainGrades.find((g) => g.subjectId === s.id);
        
        // Calculate class-wide max/min for this subject
        const allGradesForSubject = classStudents.flatMap(student => 
          student.grades.filter(g => g.subjectId === s.id)
        ).map(g => g.score);

        const maxScore = allGradesForSubject.length > 0 ? Math.max(...allGradesForSubject) : 0;
        const minScore = allGradesForSubject.length > 0 ? Math.min(...allGradesForSubject) : 0;

        return {
          id: s.id,
          name: s.name,
          score: grade ? grade.score : 0,
          maxScore,
          minScore,
          hasGrade: !!grade
        };
      });

      const domainTotal = subjectsWithScores.reduce((acc, s) => acc + s.score, 0);
      // Logic: Only divide by subjects that have a score for domain average
      const subjectsWithActualScores = subjectsWithScores.filter(s => s.hasGrade);
      const domainAverage = subjectsWithActualScores.length > 0 
        ? domainTotal / subjectsWithActualScores.length 
        : 0;

      return {
        domain,
        subjects: subjectsWithScores,
        domainAverage,
      };
    });

    const generalAverage = calculateAverage(studentGrades);

    return NextResponse.json({
      header: {
        studentName: `${student.name} ${student.surname}`,
        class: student.class.name,
        term,
        generalAverage,
        maxAverage,
        minAverage,
        rank,
      },
      domains: reportData,
    });
  } catch (error) {
    console.error("Error generating report card data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
