import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, classId, records, date, lessonId } = body;

    if (!teacherId || !records || !Array.isArray(records)) {
      return new NextResponse("Missing required fields", { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({
      where: { id: teacherId },
      select: { schoolId: true }
    });

    if (!teacher) {
      return new NextResponse("Teacher not found", { status: 404 });
    }

    const schoolId = teacher.schoolId;
    const attendanceDate = date ? new Date(date) : new Date();
    // Normalize date to YYYY-MM-DD
    attendanceDate.setHours(0, 0, 0, 0);

    // Bulk upsert records
    // Since Prisma doesn't have a bulk upsert with specific unique constraints easily in one call, 
    // we'll use a transaction with multiple upserts
    const results = await prisma.$transaction(
      records.map((record: any) => 
        prisma.attendance.upsert({
          where: {
            studentId_date_lessonId: {
              studentId: record.studentId,
              date: attendanceDate,
              lessonId: lessonId ? parseInt(lessonId) : null
            }
          },
          update: {
            status: record.status,
          },
          create: {
            studentId: record.studentId,
            date: attendanceDate,
            lessonId: lessonId ? parseInt(lessonId) : null,
            status: record.status,
            schoolId: schoolId
          }
        })
      )
    );

    return NextResponse.json({ success: true, count: results.length });
  } catch (error: any) {
    console.error("[Teacher Attendance POST Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
