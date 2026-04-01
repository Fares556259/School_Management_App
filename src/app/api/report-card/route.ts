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
    
    // 2. Fetch All Students in the same Class for Ranking and Stats
    const classStudents = await prisma.student.findMany({
      where: { classId: student.classId },
      include: {
        grades: {
          where: { term },
        },
      },
    });

    // Helper: Find student grades
    const getStudentGrades = (studentId: string) => {
      return classStudents.find(s => s.id === studentId)?.grades || [];
    };

    const studentGrades = getStudentGrades(studentId);

    // 3. Helper to calculate Tunisian General Average for any student
    const calculateStudentAverages = (grades: { score: number; subjectId: number }[]) => {
      // Map score by subject name
      const scoreMap: Record<string, number> = {};
      allSubjects.forEach(subject => {
        const grade = grades.find(g => g.subjectId === subject.id);
        scoreMap[subject.name] = grade ? grade.score : 0;
      });

      // Domains
      const arabicAvg = (
        (scoreMap["Arabic Communication"] || 0) +
        (scoreMap["Reading"] || 0) +
        (scoreMap["Writing"] || 0) +
        (scoreMap["Grammar"] || 0)
      ) / 4;

      const scienceAvg = (
        (scoreMap["Mathematics"] || 0) +
        (scoreMap["Scientific Activities"] || 0) +
        (scoreMap["Technology"] || 0)
      ) / 3;

      const discoveryAvg = (
        (scoreMap["Islamic Education"] || 0) +
        (scoreMap["History"] || 0) +
        (scoreMap["Geography"] || 0) +
        (scoreMap["Civic Education"] || 0) +
        (scoreMap["Artistic Education"] || 0) +
        (scoreMap["Plastic Arts"] || 0) +
        (scoreMap["Physical Education"] || 0)
      ) / 7;

      const frenchAvg = (
        (scoreMap["French Oral Expression"] || 0) +
        (scoreMap["French Reading"] || 0) +
        (scoreMap["French Written Production"] || 0)
      ) / 3;

      const foreignAvg = (frenchAvg + (scoreMap["English"] || 0)) / 2;

      const generalAverage = (arabicAvg + scienceAvg + discoveryAvg + foreignAvg) / 4;

      return {
        arabicAvg,
        scienceAvg,
        discoveryAvg,
        frenchAvg,
        foreignAvg,
        generalAverage
      };
    };

    // 4. Calculate averages for all students in class to find rank and max/min
    const studentAveragesList = classStudents.map((s) => ({
      id: s.id,
      averages: calculateStudentAverages(s.grades),
    }));

    // Sort by average descending
    const sortedAverages = [...studentAveragesList].sort((a, b) => b.averages.generalAverage - a.averages.generalAverage);
    const rank = sortedAverages.findIndex((a) => a.id === studentId) + 1;

    const generalAverages = studentAveragesList.map((a) => a.averages.generalAverage);
    const maxAverage = generalAverages.length > 0 ? Math.max(...generalAverages) : 0;
    const minAverage = generalAverages.length > 0 ? Math.min(...generalAverages) : 0;

    // Averages for THIS student
    const myAverages = calculateStudentAverages(studentGrades);

    // 5. Structure Report Data by Domain
    const buildDomainData = (domainName: string, subjectNames: string[], domainAvg: number) => {
      const subjectList = allSubjects.filter(s => subjectNames.includes(s.name));
      
      const subjectsWithScores = subjectList.map((s) => {
        const grade = studentGrades.find(g => g.subjectId === s.id);
        
        // Calculate class-wide max/min for this specific subject
        const allGradesForSubject = classStudents.flatMap(st => 
          st.grades.filter(g => g.subjectId === s.id)
        ).map(g => g.score);

        const maxScore = allGradesForSubject.length > 0 ? Math.max(...allGradesForSubject) : 0;
        const minScore = allGradesForSubject.length > 0 ? Math.min(...allGradesForSubject) : 0;

        return {
          id: s.id,
          name: s.name,
          score: grade ? grade.score : 0,
          maxScore,
          minScore,
        };
      });

      return {
        domain: domainName,
        subjects: subjectsWithScores,
        domainAverage: domainAvg,
      };
    };

    const domains = [
      buildDomainData("Arabic Language Domain", ["Arabic Communication", "Reading", "Writing", "Grammar"], myAverages.arabicAvg),
      buildDomainData("Science & Technology Domain", ["Mathematics", "Scientific Activities", "Technology"], myAverages.scienceAvg),
      buildDomainData("Discovery Domain", ["Islamic Education", "History", "Geography", "Civic Education", "Artistic Education", "Plastic Arts", "Physical Education"], myAverages.discoveryAvg),
      buildDomainData("Foreign Languages Domain", ["French Oral Expression", "French Reading", "French Written Production", "English"], myAverages.foreignAvg)
    ];

    // Note: We'll pass frenchAvg to the frontend somehow, but we can also just let the frontend know the rules or display it differently.
    // Wait, the frontend needs to know if French is grouped. 
    // We will emit the raw foreign domain data, and the frontend can render the French sub-average manually by looking at the French subjects.
    
    return NextResponse.json({
      header: {
        studentName: `${student.name} ${student.surname}`,
        class: student.class.name,
        term,
        generalAverage: myAverages.generalAverage,
        maxAverage,
        minAverage,
        rank,
      },
      domains: domains,
    });
  } catch (error) {
    console.error("Error generating report card data:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
