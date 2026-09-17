import { NextRequest, NextResponse } from "next/server";
import { verifyCallToken } from "@/lib/call/token";
import { AccessToken } from "livekit-server-sdk";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = body.token || req.headers.get("authorization")?.replace("Bearer ", "");

    if (!token) {
      return NextResponse.json({ error: "Token de session manquant" }, { status: 401 });
    }

    const payload = verifyCallToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Session d'appel invalide ou expirée" }, { status: 401 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      console.error("[LiveKit Token] Missing LiveKit environment variables");
      return NextResponse.json(
        {
          error: "Configuration LiveKit manquante sur le serveur (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET).",
        },
        { status: 500 }
      );
    }

    // Room name uniquely scoped to school and admin session
    const roomName = `hnia-${payload.schoolId}-${payload.adminId}`;

    const metadata = JSON.stringify({
      schoolId: payload.schoolId,
      adminId: payload.adminId,
      adminName: payload.adminName,
      schoolName: payload.schoolName,
      language: payload.language || "fr",
      telegramChatId: payload.telegramChatId,
    });

    console.log(`[Hnia Voice] Generating LiveKit token for admin ${payload.adminName} (${payload.adminId}) in school ${payload.schoolId}`);

    // Create participant AccessToken
    const at = new AccessToken(apiKey, apiSecret, {
      identity: `admin-${payload.adminId}`,
      name: payload.adminName,
      metadata,
      ttl: "1h", // Short-lived 1 hour token
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const livekitToken = await at.toJwt();

    return NextResponse.json({
      ok: true,
      livekitUrl,
      token: livekitToken,
      roomName,
      adminName: payload.adminName,
      schoolName: payload.schoolName,
    });
  } catch (error: any) {
    console.error("[LiveKit Token API Error]:", error);
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
