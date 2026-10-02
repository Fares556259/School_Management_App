import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { confirmMobileAction } from "@/lib/agent/mobileAgent";

export const dynamic = "force-dynamic";

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
    const { toolCallId, action, updatedArgs } = body;

    if (!toolCallId || !action || !["confirm", "cancel"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Paramètres manquants ou invalides (toolCallId et action requis)." },
        { status: 400 }
      );
    }

    const result = await confirmMobileAction({
      toolCallId,
      action,
      adminId: userId,
      schoolId,
      updatedArgs,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Mobile Agent Confirm API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
