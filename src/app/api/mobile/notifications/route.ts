import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const studentId = searchParams.get("studentId");
    
    if (!parentId) {
      return NextResponse.json([]);
    }

    const notifications = await prisma.notification.findMany({
      where: { 
        parentId,
        OR: [
          { studentId: studentId || undefined },
          { studentId: null }
        ]
      },
      include: { student: true },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const formatted = notifications.map(n => {
      // Determine icon and color based on type
      let iconName = "Info";
      let iconColor = "#0055d4";

      if (n.type === "PAYMENT" || n.type === "REMINDER") {
        iconName = "AlertTriangle";
        iconColor = "#ef4444";
      } else if (n.type === "ANNOUNCEMENT") {
        iconName = "GraduationCap";
        iconColor = "#0055d4";
      }

      return {
        id: n.id,
        type: n.type,
        student: n.student ? `${n.student.name} ${n.student.surname}` : "School",
        message: n.message,
        time: formatRelativeTime(n.createdAt),
        rawDate: n.createdAt,
        iconName,
        iconColor,
        isNew: !n.isRead
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    console.error("[API] Notifications GET Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { notificationIds } = await request.json();

    if (!notificationIds || !Array.isArray(notificationIds)) {
      return new NextResponse("Missing IDs", { status: 400 });
    }

    await prisma.notification.updateMany({
      where: {
        id: { in: notificationIds }
      },
      data: {
        isRead: true
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

function formatRelativeTime(date: Date | string | number) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "recently";
  
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}
