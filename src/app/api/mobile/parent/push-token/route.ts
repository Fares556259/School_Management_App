export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { flushAccessNotifications } from "@/lib/parentAccessNotifications";
import { waitUntil } from "@vercel/functions";
import { parseStoredExpoPushTokens, storeExpoPushToken } from "@/lib/expoPushTokens";
import { isExpoPushToken } from "@/lib/expoPushApi";

export async function POST(request: NextRequest) {
  const auth = await authenticateMobileRequest(request, { allowPendingParent: true });
  if (auth.error) return auth.error;
  const { userId, userType, schoolId } = auth.payload;

  if (userType !== "parent") {
    return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const targetId = body.parentId || userId;
    const pushToken = typeof body.pushToken === "string" && body.pushToken.trim() ? body.pushToken.trim() : null;
    const channelVersion = Number.isInteger(body.notificationChannelVersion) ? body.notificationChannelVersion : 2;
    const platform = body.platform === "android" || body.platform === "ios" ? body.platform : undefined;

    if (targetId !== userId) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }
    if (pushToken && !isExpoPushToken(pushToken)) {
      return NextResponse.json({ success: false, error: "Invalid push token" }, { status: 400 });
    }

    const parent = await prisma.parent.findFirst({
      where: { id: userId, schoolId },
      select: { id: true, expoPushToken: true },
    });

    if (!parent) {
      return NextResponse.json({ success: false, error: "Parent not found" }, { status: 404 });
    }

    const storedToken = pushToken
      ? storeExpoPushToken(parent.expoPushToken, pushToken, channelVersion, platform)
      : null;
    await prisma.parent.update({
      where: { id: parent.id },
      data: { expoPushToken: storedToken },
    });

    const registeredDevices = parseStoredExpoPushTokens(storedToken).length;
    console.log("[PUSH-TOKEN-REGISTERED]", {
      userType: "parent",
      userId,
      schoolId,
      registeredDevices,
      channelVersion,
      platform,
    });
    if (pushToken) {
      if (storedToken !== parent.expoPushToken) await prisma.parentAccessDelivery.updateMany({
        where: { parentId: userId, schoolId, status: 'PENDING', attempts: { gte: 6 } },
        data: { attempts: 0, nextAttemptAt: new Date() },
      });
      const pending = flushAccessNotifications(userId).catch(error => console.error('[Activation push registration]', error));
      try { waitUntil(pending); } catch { await pending; }
    }
    return NextResponse.json({ success: true, registeredDevices });
  } catch (error) {
    console.error("[PUSH-TOKEN-ERROR]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
