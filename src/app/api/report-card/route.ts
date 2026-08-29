import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import { NextRequest, NextResponse } from "next/server";
import { LEVEL_CONFIGS } from "@/lib/report-cards/level-config";

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

    // 1. Fetch Students
    let studentsToProcess: any[] = [];
    let targetClassId: number = 0;

    if (studentId) {
      const student = await prisma.student.findFirst({
        where: { id: studentId },
        include: { class: { include: { level: true } } },
      });
      if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      studentsToProcess = [student];
      targetClassId = student.classId!;
    } else if (classId) {
      const classIdNum = parseInt(classId);
      const students = await prisma.student.findMany({
        where: { classId: classIdNum },
        include: { class: { include: { level: true } } },
      });
      studentsToProcess = students;
      targetClassId = classIdNum;
    }

    if (studentsToProcess.length === 0) {
      return NextResponse.json([]);
    }

    // Determine level config based on the class of the first student (they are all in the same class)
    const levelNum = studentsToProcess[0].class?.level?.level;
    const levelConfig = levelNum ? LEVEL_CONFIGS[levelNum] : undefined;

    // Build the effective domain map based on level config or legacy fallback
    const effectiveDomainMap: Record<string, typeof allSubjects> = {};
    const domainCoefficients: Record<string, number> = {};
    const displayMap: Record<number, string> = {};
    let expectedSubjectCount = 0;

    if (levelConfig) {
      // Level-specific configuration logic
      levelConfig.domains.forEach(domainConfig => {
        effectiveDomainMap[domainConfig.name] = [];
        domainCoefficients[domainConfig.name] = domainConfig.coefficient ?? 1;
        domainConfig.subjects.forEach(sub => {
          const dbSubject = allSubjects.find(s => s.name.includes(sub.search.trim()));
          if (dbSubject) {
            effectiveDomainMap[domainConfig.name].push(dbSubject);
            displayMap[dbSubject.id] = sub.display;
            expectedSubjectCount++;
          }
        });
      });
    } else {
      // Legacy fallback logic
      allSubjects.forEach((s) => {
        if (!effectiveDomainMap[s.domain]) effectiveDomainMap[s.domain] = [];
        effectiveDomainMap[s.domain].push(s);
        domainCoefficients[s.domain] = 1;
        expectedSubjectCount++;
      });
    }

    // 2. Fetch All Students in the same Class for Ranking and Stats
    const classStudents = await prisma.student.findMany({
      where: { classId: targetClassId },
      include: {
        grades: {
          where: { term },
        },
      },
    });

    // 3. Helper: calculate domain averages dynamically
    const calculateStudentAverages = (grades: { score: number; subjectId: number }[]) => {
      // Filter grades to only include those in our effective domains
      const validSubjectIds = new Set();
      Object.values(effectiveDomainMap).forEach(subs => subs.forEach(s => validSubjectIds.add(s.id)));
      
      const relevantGrades = grades.filter(g => validSubjectIds.has(g.subjectId));

      // If student hasn't received a grade for all expected subjects, we still compute but it might be incomplete.
      // Previously it returned 0 if grades.length < expectedSubjectCount. We keep this safety.
      if (relevantGrades.length < expectedSubjectCount) {
        return { domainAverages: {}, generalAverage: 0 };
      }

      const gradeMap: Record<number, number> = {};
      relevantGrades.forEach((g) => { gradeMap[g.subjectId] = g.score; });

      // Domain averages: average of all subject scores in that domain
      const domainAverages: Record<string, number> = {};
      let totalWeightedSum = 0;
      let totalCoefficients = 0;

      Object.entries(effectiveDomainMap).forEach(([domain, subjects]) => {
        const domainScores = subjects
          .filter(s => gradeMap[s.id] !== undefined)
          .map(s => gradeMap[s.id]);
          
        if (domainScores.length > 0) {
          const domainAvg = domainScores.reduce((a, b) => a + b, 0) / domainScores.length;
          domainAverages[domain] = domainAvg;
          
          const coef = domainCoefficients[domain] ?? 1;
          totalWeightedSum += (domainAvg * coef);
          totalCoefficients += coef;
        }
      });

      // General average: weighted average of domain averages
      const generalAverage = totalCoefficients > 0
        ? totalWeightedSum / totalCoefficients
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
    const generalAverages = studentAveragesList.map((a) => a.averages.generalAverage).filter(avg => avg > 0);
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
      // Filter out those with 0 average for ranking so they don't get ranked 1 if everyone is 0
      const rankedStudents = sortedAverages.filter(a => a.averages.generalAverage > 0);
      let rank = rankedStudents.findIndex((a) => a.id === targetStudent.id) + 1;
      if (myAverages.generalAverage === 0) rank = 0; // Not ranked

      // Build domain data dynamically from our effective map
      const domains = Object.entries(effectiveDomainMap).map(([domainName, subjects]) => {
        const subjectsWithScores = subjects.map((s) => {
          const allGradesForSubject = classStudents
            .flatMap((st) => st.grades.filter((g) => g.subjectId === s.id))
            .map((g) => g.score);

          const maxScore = allGradesForSubject.length > 0 ? Math.max(...allGradesForSubject) : 0;
          const minScore = allGradesForSubject.length > 0 ? Math.min(...allGradesForSubject) : 0;

          return {
            id: s.id,
            name: displayMap[s.id] || s.name,
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
