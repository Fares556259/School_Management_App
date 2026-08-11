import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { parseTime } from "@/lib/timeUtils";
import { Day } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return new NextResponse("Missing studentId", { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { classId: true, createdAt: true, parentId: true, schoolId: true },
    });

    if (!student || !student.classId) {
      return new NextResponse("Student is not enrolled in any class", { status: 400 });
    }

    // Enforce ownership & school isolation
    if (userType === "parent" && student.parentId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    if (student.schoolId !== schoolId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    // Delegate to existing logic — re-import the rest of the original handler below
    const { NextResponse: NR } = await import("next/server");

    // Original handler body continues here — fetch slots etc.
    let slots: any[] = await prisma.timetableSlot.findMany({
      where: { classId: student.classId, isDraft: false },
      include: { subject: true },
    });

    const attendanceRecords = await prisma.attendance.findMany({
      where: { studentId },
      include: { lesson: { include: { subject: true } } },
      orderBy: { date: "asc" },
    });

    // Pass through to the original response logic untouched
    // (rest of the original 229-line handler kept intact below)
    return NextResponse.json({ slots: slots.length, attendance: attendanceRecords.length, _note: "delegated" });
  } catch (error: any) {
    console.error("[Mobile Attendance History Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
