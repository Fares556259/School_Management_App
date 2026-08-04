import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");
  const classId = searchParams.get("classId");
  const termStr = searchParams.get("term");

  if (!termStr || (!studentId && !classId)) {
    return NextResponse.json({ error: "Missing studentId/classId or term" }, { status: 400 });
  }

  const term = parseInt(termStr);

  try {
    const schoolId = await getSchoolId();
    // Fetch ALL subjects for this school, grouped by domain
    const allSubjects = await prisma.subject.findMany({
      where: { schoolId },
      orderBy: [{ domain: "asc" }, { name: "asc" }],
    });

    // Group subjects by domain
    const domainMap: Record<string, typeof allSubjects> = {};
    allSubjects.forEach((s) => {
      if (!domainMap[s.domain]) domainMap[s.domain] = [];
      domainMap[s.domain].push(s);
    });

    // 1. Fetch Students
    let studentsToProcess: any[] = [];
    let targetClassId: number = 0;

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, schoolId },
        include: { class: true },
      });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      studentsToProcess = [student];
      targetClassId = student.classId!;
    } else if (classId) {
      const classIdNum = parseInt(classId);
      const students = await prisma.student.findMany({
        where: { classId: classIdNum, schoolId },
        include: { class: true },
      });
      studentsToProcess = students;
      targetClassId = classIdNum;
    }

    // 2. Fetch All Students in the same Class for Ranking and Stats
    const classStudents = await prisma.student.findMany({
      where: { classId: targetClassId, schoolId },
      include: {
        grades: {
          where: { term },
        },
      },
    });

    // 3. Helper: calculate domain averages dynamically from DB subjects
    const calculateStudentAverages = (grades: { score: number; subjectId: number }[]) => {
      // If student hasn't received a grade for all subjects, don't compute average
      if (grades.length < allSubjects.length) {
        return { domainAverages: {}, generalAverage: 0 };
      }

      const gradeMap: Record<number, number> = {};
      grades.forEach((g) => { gradeMap[g.subjectId] = g.score; });

      // Domain averages: average of all subject scores in that domain
      const domainAverages: Record<string, number> = {};
      Object.entries(domainMap).forEach(([domain, subjects]) => {
        const domainScores = subjects
          .filter(s => gradeMap[s.id] !== undefined)
          .map(s => gradeMap[s.id]);
          
        if (domainScores.length > 0) {
          domainAverages[domain] = domainScores.reduce((a, b) => a + b, 0) / domainScores.length;
        }
      });

      // General average: simple average of domain averages
      const domainAvgValues = Object.values(domainAverages);
      const generalAverage = domainAvgValues.length > 0
        ? domainAvgValues.reduce((a, b) => a + b, 0) / domainAvgValues.length
        : 0;

      return { domainAverages, generalAverage };
    };

    // 4. Pre-calculate averages for all students in class for rank and max/min
    const studentAveragesList = classStudents.map((s) => ({
      id: s.id,
      averages: calculateStudentAverages(s.grades),
    }));

    const sortedAverages = [...studentAveragesList].sort(
      (a, b) => b.averages.generalAverage - a.averages.generalAverage
    );
    const generalAverages = studentAveragesList.map((a) => a.averages.generalAverage);
    const maxAverage = generalAverages.length > 0 ? Math.max(...generalAverages) : 0;
    const minAverage = generalAverages.length > 0 ? Math.min(...generalAverages) : 0;

    // 5. Build full report for a specific student instance
    const generateFullReport = (targetStudent: any) => {
      const studentDataWithGrades = classStudents.find((s) => s.id === targetStudent.id);
      if (!studentDataWithGrades) return null;

      const studentGrades = studentDataWithGrades.grades;
      const gradeMap: Record<number, number> = {};
      studentGrades.forEach((g) => { gradeMap[g.subjectId] = g.score; });

      const myAverages = studentAveragesList.find((s) => s.id === targetStudent.id)!.averages;
      const rank = sortedAverages.findIndex((a) => a.id === targetStudent.id) + 1;

      // Build domain data dynamically from DB subjects
      const domains = Object.entries(domainMap).map(([domainName, subjects]) => {
        const subjectsWithScores = subjects.map((s) => {
          const allGradesForSubject = classStudents
            .flatMap((st) => st.grades.filter((g) => g.subjectId === s.id))
            .map((g) => g.score);

          const maxScore = allGradesForSubject.length > 0 ? Math.max(...allGradesForSubject) : 0;
          const minScore = allGradesForSubject.length > 0 ? Math.min(...allGradesForSubject) : 0;

          return {
            id: s.id,
            name: s.name,
            score: gradeMap[s.id] ?? 0,
            maxScore,
            minScore,
          };
        });

        return {
          domain: domainName,
          subjects: subjectsWithScores,
          domainAverage: myAverages.domainAverages[domainName] ?? 0,
        };
      });

      return {
        header: {
          studentName: `${targetStudent.name} ${targetStudent.surname}`,
          class: targetStudent.class?.name ?? "",
          term,
          generalAverage: myAverages.generalAverage,
          maxAverage,
          minAverage,
          rank,
        },
        domains,
      };
    };

    // 6. Final Result
    if (studentId) {
      const report = generateFullReport(studentsToProcess[0]);
      return NextResponse.json(report);
    } else {
      const reports = studentsToProcess
        .map((s) => generateFullReport(s))
        .filter((r) => r !== null);
      return NextResponse.json(reports);
    }
  } catch (error) {
    console.error("Error generating report card data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
