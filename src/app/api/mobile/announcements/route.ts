import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const auth = await authenticateMobileRequest(request);
    if (auth.error) return auth.error;
    const { schoolId, userId, userType } = auth.payload;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const requestedClassId = searchParams.get("classId");
    let classId: number | null = null;
    if (userType === 'parent') {
      if (!studentId) return NextResponse.json({ error: "Student required" }, { status: 400 });
      const child = await prisma.student.findFirst({ where: { id: studentId, schoolId, parentId: userId }, select: { classId: true } });
      if (!child) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      classId = child.classId;
      if (requestedClassId && Number(requestedClassId) !== classId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } else if (requestedClassId && Number.isInteger(Number(requestedClassId))) classId = Number(requestedClassId);

    const institution = await prisma.institution.findUnique({
      where: { schoolId }
    });
    
    const defaultImage = institution?.ministryLogo || "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=400&auto=format&fit=crop";

    const notices = await prisma.notice.findMany({
      where: {
        schoolId, // MUST filter by schoolId to prevent data leaks across schools
        AND: [
          { OR: [{ classId: null }, ...(classId !== null ? [{ classId }] : [])] },
          { OR: [{ targetStudentId: null }, ...(studentId ? [{ targetStudentId: studentId }] : [])] },
        ],
      },
      orderBy: { date: "desc" },
      take: 15,
    });

    // Map Prisma Notice to Mobile Announcement type
    const announcements = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      excerpt: notice.message.length > 100 ? notice.message.substring(0, 100) + "..." : notice.message,
      content: notice.message,
      date: notice.date.toISOString(),
      category: notice.important ? "URGENT" : "School News",
      image: notice.img || defaultImage, 
      rawImg: notice.img || "",
      pdfUrl: notice.pdfUrl,
    }));

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Mobile Announcements Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
