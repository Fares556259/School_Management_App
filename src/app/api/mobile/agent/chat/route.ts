import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { runMobileAgent } from "@/lib/agent/mobileAgent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userId, userType, schoolId } = auth.payload;
    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const result = await runMobileAgent({
      userMessage: body.message,
      adminId: userId,
      schoolId,
      conversationId: body.conversationId,
      audioBase64: body.audioBase64,
      audioMimeType: body.audioMimeType,
      imageBase64: body.imageBase64,
      imageMimeType: body.imageMimeType,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Mobile Agent Chat API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Erreur interne du serveur",
      },
      { status: 500 }
    );
  }
}
