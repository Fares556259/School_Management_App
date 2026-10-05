export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { Expo } from "expo-server-sdk";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const targetId = body.parentId || userId;
    const pushToken = typeof body.pushToken === "string" && body.pushToken.trim() ? body.pushToken.trim() : null;

    if (targetId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (pushToken && !Expo.isExpoPushToken(pushToken)) {
      return NextResponse.json({ success: false, error: "Invalid push token" }, { status: 400 });
    }

    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: { id: true },
    });

    if (!parent) {
      return NextResponse.json({ success: false, error: "Parent not found" }, { status: 404 });
    }

    await prisma.parent.update({
      where: { id: parent.id },
      data: { expoPushToken: pushToken },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUSH-TOKEN-ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
