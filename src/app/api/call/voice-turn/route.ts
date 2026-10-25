import { NextRequest, NextResponse } from "next/server";
import { processHniaVoiceTurn, VoiceTurnContext } from "@/lib/voice/hniaVoiceBridge";
import { verifyActiveCallToken } from "@/lib/call/token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, history = [], token } = body;
    if (!token) {
      return NextResponse.json({ error: "Session requise" }, { status: 401 });
    }
    const payload = await verifyActiveCallToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Session invalide ou expirée" }, { status: 401 });
    }
    const verifiedContext: VoiceTurnContext = {
      schoolId: payload.schoolId,
      adminId: payload.adminId,
      adminName: payload.adminName,
      schoolName: payload.schoolName,
      language: payload.language || "fr",
      telegramChatId: payload.telegramChatId,
    };

    console.log(`[Voice Turn API] Processing voice turn for school ${verifiedContext.schoolId} ("${userMessage?.slice(0, 50)}")`);

    const result = await processHniaVoiceTurn({
      userMessage,
      context: verifiedContext,
      history,
    });

    return NextResponse.json({
      ok: true,
      text: result.text,
      toolsExecuted: result.toolsExecuted || [],
    });
  } catch (err: any) {
    console.error("[Voice Turn API Error]:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Erreur interne", text: "Oups, une erreur est survenue." },
      { status: 500 }
    );
  }
}
