import prisma from "@/lib/prisma";
import { getSchoolIdFromHeader } from "@/lib/school";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const schoolId = getSchoolIdFromHeader(headers());

    if (!parentId) {
      return NextResponse.json({ error: "Parent ID is required" }, { status: 400 });
    }

    // 1. Get all students for this parent
    const students = await prisma.student.findMany({
      where: { parentId, schoolId },
      select: { id: true, name: true, surname: true, classId: true },
    });

    if (students.length === 0) {
      return NextResponse.json([]);
    }

    const studentIds = students.map((s) => s.id);
    const classIds = students.map((s) => s.classId);

    // 2. Fetch Report Cards (GradeSheets)
    const reportCards = await prisma.gradeSheet.findMany({
      where: {
        classId: { in: classIds },
        schoolId,
        proofUrl: { not: "" },
      },
      include: {
        class: true,
        subject: true,
      },
    });

    // 3. Fetch School Notices with PDFs
    const notices = await prisma.notice.findMany({
      where: {
        schoolId,
        pdfUrl: { not: null },
        OR: [
          { classId: { in: classIds } },
          { targetStudentId: { in: studentIds } },
          { classId: null, targetStudentId: null }, // Global notices
        ],
      },
    });

    // 4. Fetch Exam Schedules
    const examSchedules = await prisma.examPeriodConfig.findMany({
      where: {
        schoolId,
        pdfUrl: { not: null },
      },
    });

    // 5. Combine and Format
    const allFiles: any[] = [];

    // Add Report Cards
    reportCards.forEach((rc) => {
      allFiles.push({
        id: `rc-${rc.id}`,
        name: `Report Card - ${rc.subject.name} (Term ${rc.term})`,
        url: rc.proofUrl,
        type: "pdf",
        category: "Academic",
        createdAt: rc.createdAt,
        studentName: "Class " + rc.class.name,
      });
    });

    // Add Notices
    notices.forEach((n) => {
      allFiles.push({
        id: `not-${n.id}`,
        name: n.title,
        url: n.pdfUrl,
        type: "pdf",
        category: n.important ? "Admin" : "Events",
        createdAt: n.date,
        studentName: "School",
      });
    });

    // Add Exam Schedules
    examSchedules.forEach((es) => {
      allFiles.push({
        id: `exam-${es.id}`,
        name: `Exam Schedule - Period ${es.period}`,
        url: es.pdfUrl,
        type: "pdf",
        category: "Academic",
        createdAt: es.startDate,
        studentName: "Academic",
      });
    });

    // Sort by date (newest first)
    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allFiles);
  } catch (error) {
    console.error("[API-PARENT-FILES-ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
