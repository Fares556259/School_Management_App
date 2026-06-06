export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { parentId, pushToken } = body;

    if (!parentId) {
      return NextResponse.json(
        { success: false, error: "Missing parentId" },
        { status: 400 }
      );
    }

    // Save the token to the parent record (can be empty/null to unregister)
    await prisma.parent.update({
      where: { id: parentId },
      data: { expoPushToken: pushToken || null },
    });

    console.log(`[PUSH-TOKEN] Saved token for parent ${parentId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[PUSH-TOKEN-ERROR]", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
