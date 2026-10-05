import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get("parentId");
    const studentId = searchParams.get("studentId");
    const countOnly = searchParams.get("countOnly") === "true";

    if (userType !== "parent" || (parentId && userId !== parentId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (studentId) {
      const ownedStudent = await prisma.student.findFirst({
        where: { id: studentId, parentId: userId, schoolId },
        select: { id: true },
      });
      if (!ownedStudent) return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const where = {
      parentId: userId,
      schoolId,
      ...(studentId ? { OR: [{ studentId }, { studentId: null }] } : {}),
    };

    if (countOnly) {
      const unreadCount = await prisma.notification.count({
        where: { ...where, isRead: false },
      });
      return NextResponse.json({ unreadCount }, { headers: { "Cache-Control": "private, no-store" } });
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: { student: { include: { class: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const formatted = notifications.map((n) => {
      let iconName = "Info";
      let iconColor = "#0055d4";
      if (n.type === "PAYMENT" || n.type === "REMINDER") { iconName = "AlertTriangle"; iconColor = "#ef4444"; }
      else if (n.type === "ANNOUNCEMENT") { iconName = "GraduationCap"; iconColor = "#0055d4"; }
      return {
        id: n.id, 
        type: n.type,
        title: n.title || "Notification",
        student: n.student ? `${n.student.name} ${n.student.surname}` : "School",
        studentId: n.studentId,
        studentAvatar: n.student?.img || null,
        className: n.student?.class?.name || "School",
        message: n.message, 
        time: formatRelativeTime(n.createdAt), 
        rawDate: n.createdAt,
        createdAt: n.createdAt,
        iconName, 
        iconColor, 
        isNew: !n.isRead,
      };
    });

    return NextResponse.json(formatted, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error: any) {
    console.error("[API] Notifications GET Error:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { notificationIds } = await request.json();

    const validIds = Array.isArray(notificationIds)
      ? notificationIds.filter((id): id is number => Number.isInteger(id) && id > 0).slice(0, 100)
      : [];
    if (validIds.length === 0 || validIds.length !== notificationIds.length) {
      return new NextResponse("Missing IDs", { status: 400 });
    }

    await prisma.notification.updateMany({
      where: { id: { in: validIds }, parentId: userId, schoolId },
      data: { isRead: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new NextResponse("Missing id", { status: 400 });
    }

    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      return new NextResponse("Invalid id", { status: 400 });
    }

    await prisma.notification.deleteMany({
      where: { id: notificationId, parentId: userId, schoolId },
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
