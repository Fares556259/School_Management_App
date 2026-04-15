import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");

    const notices = await prisma.notice.findMany({
      where: {
        OR: [
          { classId: null }, // Global notices
          classId ? { classId: parseInt(classId) } : {}, // Class-specific notices
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
      date: notice.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      category: notice.important ? "URGENT" : "School News",
      image: notice.img || "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=400&auto=format&fit=crop", 
      pdfUrl: notice.pdfUrl,
    }));

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Mobile Announcements Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
