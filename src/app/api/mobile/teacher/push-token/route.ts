import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;
  if (userType !== "teacher") return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const body = await request.json();
    const { teacherId, pushToken } = body;

    if (!teacherId || !pushToken) {
      return new NextResponse("Teacher ID and push token are required", { status: 400 });
    }
    if (teacherId !== userId) {
      return new NextResponse(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    await prisma.teacher.update({
      where: { id: teacherId },
      data: { expoPushToken: pushToken },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Mobile Teacher Push Token Error]", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
