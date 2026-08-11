import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;

  try {
    const { attendanceId, justificationImg, justificationNote } = await request.json();

    if (!attendanceId) {
      return new NextResponse("Missing attendanceId", { status: 400 });
    }

    // Verify the attendance record belongs to a student of this parent
    if (userType === "parent") {
      const record = await prisma.attendance.findUnique({
        where: { id: parseInt(attendanceId) },
        include: { student: { select: { parentId: true } } },
      });
      if (!record || record.student?.parentId !== userId) {
        return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    const updated = await prisma.attendance.update({
      where: { id: parseInt(attendanceId) },
      data: {
        justificationImg: justificationImg || null,
        justificationNote: justificationNote || null,
        justificationStatus: "PENDING",
        note: justificationNote ? `[Justification] ${justificationNote}` : undefined,
      },
    });

    return NextResponse.json({ success: true, attendance: updated });
  } catch (error: any) {
    console.error("[Mobile Justify Error]", error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
