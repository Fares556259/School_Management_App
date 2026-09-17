import { NextRequest, NextResponse } from "next/server";
import { processHniaVoiceTurn, VoiceTurnContext } from "@/lib/voice/hniaVoiceBridge";
import { verifyCallToken } from "@/lib/call/token";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userMessage, context, history = [], token } = body;

    let verifiedContext: VoiceTurnContext = context;

    // If an auth token was provided, verify it to strictly ensure multi-tenant security
    if (token) {
      const payload = verifyCallToken(token);
      if (!payload) {
        return NextResponse.json({ error: "Session invalide ou expirée" }, { status: 401 });
      }
      verifiedContext = {
        schoolId: payload.schoolId,
        adminId: payload.adminId,
        adminName: payload.adminName,
        schoolName: payload.schoolName,
        language: payload.language || "fr",
        telegramChatId: payload.telegramChatId,
      };
    }

    if (!verifiedContext?.schoolId) {
      return NextResponse.json({ error: "Contexte d'école manquant" }, { status: 400 });
    }

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
