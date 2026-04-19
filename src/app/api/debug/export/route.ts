import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const data = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      classes: await prisma.class.findMany(),
      teachers: await prisma.teacher.findMany(),
      students: await prisma.student.findMany(),
      parents: await prisma.parent.findMany(),
      payments: await prisma.payment.findMany(),
      notices: await prisma.notice.findMany(),
      notifications: await prisma.notification.findMany(),
      auditLogs: await prisma.auditLog.findMany(),
    };

    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="SnapSchool_Database_Backup.json"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
