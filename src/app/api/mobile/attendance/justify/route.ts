import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  try {
    const { attendanceId, justificationImg, justificationNote } = await request.json();

    if (!attendanceId) {
      return new NextResponse("Missing attendanceId", { status: 400 });
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
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
