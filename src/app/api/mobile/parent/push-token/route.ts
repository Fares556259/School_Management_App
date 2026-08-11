export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";

export async function POST(request: NextRequest) {
  const auth = authenticateMobileRequest(request);
  if (auth.error) return auth.error;
  const { userId, userType } = auth.payload;

  try {
    const body = await request.json();
    const { parentId, pushToken } = body;

    if (!parentId) {
      return NextResponse.json({ success: false, error: "Missing parentId" }, { status: 400 });
    }

    // Enforce ownership
    if (userType !== "parent" || userId !== parentId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    await prisma.parent.update({
      where: { id: parentId },
      data: { expoPushToken: pushToken || null },
    });

    console.log(`[PUSH-TOKEN] Saved token for parent ${parentId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUSH-TOKEN-ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
