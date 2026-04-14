import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const notices = await prisma.notice.findMany({
      orderBy: { date: "desc" },
      take: 10,
    });

    // Map Prisma Notice to Mobile Announcement type
    const announcements = notices.map((notice) => ({
      id: notice.id,
      title: notice.title,
      excerpt: notice.message,
      date: notice.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      category: notice.important ? "Urgent" : "School News",
      image: "https://images.unsplash.com/photo-1546410531-bb4caa6b424d?q=80&w=400&auto=format&fit=crop", // Fallback image
    }));

    return NextResponse.json(announcements);
  } catch (error) {
    console.error("Mobile Announcements Fetch Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
