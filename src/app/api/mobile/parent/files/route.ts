import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  // Only parents can access parent files
  if (userType !== "parent") {
    return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");

    if (!parentId) {
      return NextResponse.json({ error: "Parent ID is required" }, { status: 400 });
    }

    // Enforce ownership
    if (userId !== parentId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const students = await prisma.student.findMany({
      where: { parentId, schoolId },
      select: { id: true, name: true, surname: true, classId: true },
    });

    if (students.length === 0) return NextResponse.json([]);

    const studentIds = students.map((s) => s.id);
    const classIds = students.map((s) => s.classId).filter((id): id is number => id !== null);

    const reportCards = await prisma.gradeSheet.findMany({
      where: { classId: { in: classIds }, schoolId, proofUrl: { not: "" } },
      include: { class: true, subject: true },
    });

    const notices = await prisma.notice.findMany({
      where: {
        schoolId,
        pdfUrl: { not: null },
        OR: [
          { classId: { in: classIds } },
          { targetStudentId: { in: studentIds } },
          { classId: null, targetStudentId: null },
        ],
      },
    });

    const examSchedules = await prisma.examPeriodConfig.findMany({
      where: { schoolId, pdfUrl: { not: null } },
    });

    const allFiles: any[] = [];
    reportCards.forEach((rc) => allFiles.push({ id: `rc-${rc.id}`, name: `Report Card - ${rc.subject.name} (Term ${rc.term})`, url: rc.proofUrl, type: "pdf", category: "Academic", createdAt: rc.createdAt, studentName: "Class " + rc.class.name }));
    notices.forEach((n) => allFiles.push({ id: `not-${n.id}`, name: n.title, url: n.pdfUrl, type: "pdf", category: n.important ? "Admin" : "Events", createdAt: n.date, studentName: "School" }));
    examSchedules.forEach((es) => allFiles.push({ id: `exam-${es.id}`, name: `Exam Schedule - Period ${es.period}`, url: es.pdfUrl, type: "pdf", category: "Academic", createdAt: es.startDate, studentName: "Academic" }));

    allFiles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(allFiles);
  } catch (error) {
    console.error("[API-PARENT-FILES-ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
