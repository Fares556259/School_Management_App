import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import { confirmMobileAction } from "@/lib/agent/mobileConfirmation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateMobileRequest(request);
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

    if (typeof toolCallId !== "string" || !toolCallId || toolCallId.length > 128 || !["confirm", "cancel"].includes(action) || (updatedArgs !== undefined && (!updatedArgs || typeof updatedArgs !== "object" || Array.isArray(updatedArgs)))) {
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
      { success: false, error: "Erreur interne" },
      { status: 500 }
    );
  }
}
