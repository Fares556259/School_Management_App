import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const payload = verifyToken(authHeader);
    if (!payload || !payload.schoolId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { schoolId } = payload;
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");

    const institution = await prisma.institution.findUnique({
      where: { schoolId }
    });
    
    const defaultImage = institution?.ministryLogo || "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=400&auto=format&fit=crop";

    const notices = await prisma.notice.findMany({
      where: {
        schoolId, // MUST filter by schoolId to prevent data leaks across schools
        OR: [
          { classId: null }, // Global notices for this school
          {
            AND: [
              { classId: classId ? parseInt(classId) : undefined },
              {
                OR: [
                  { targetStudentId: null }, // Class-wide, no specific student target
                  studentId ? { targetStudentId: studentId } : { targetStudentId: 'NONE' }, // Specific student target (match or hide if no ID)
                ],
              },
            ],
          },
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
      pdfUrl: notice.pdfUrl,
    }));

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Mobile Announcements Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
