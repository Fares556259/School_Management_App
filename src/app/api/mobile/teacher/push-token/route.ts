import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacherId, pushToken } = body;

    if (!teacherId || !pushToken) {
      return new NextResponse("Teacher ID and push token are required", { status: 400 });
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
