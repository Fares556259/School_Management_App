import { NextRequest, NextResponse } from "next/server";
import { verifyCallToken } from "@/lib/call/token";
import { TOOLS } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, toolCall } = body;

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 401 });
    }

    const payload = verifyCallToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
    }

    if (!toolCall || !toolCall.name) {
      return NextResponse.json({ error: "Appel d'outil invalide" }, { status: 400 });
    }

    const toolName = toolCall.name;
    const toolArgs = toolCall.args || {};
    const toolDef = TOOLS[toolName];

    if (!toolDef) {
      return NextResponse.json({
        ok: false,
        error: `Outil inconnu : ${toolName}`,
        output: { error: `L'outil ${toolName} n'est pas disponible.` },
      });
    }

    const context: ToolContext = {
      schoolId: payload.schoolId,
      adminId: payload.adminId,
      adminName: payload.adminName,
      language: payload.language || "fr",
    };

    console.log(`[Call Tools API] Executing ${toolName} for school ${payload.schoolId}`, toolArgs);

    const result = await toolDef.execute(toolArgs, context);

    // Record tool call in audit log
    try {
      await prisma.auditLog.create({
        data: {
          schoolId: payload.schoolId,
          performedBy: payload.adminName || payload.adminId,
          action: "VOICE_CALL_ACTION",
          entityType: toolName,
          entityId: toolCall.id,
          description: `Action vocale exécutée : ${toolName}`,
          newValues: toolArgs,
        },
      });
    } catch (logErr) {
      console.warn("[Call Tools API] Audit log warning:", logErr);
    }

    return NextResponse.json({
      ok: true,
      id: toolCall.id,
      name: toolName,
      output: result,
    });
  } catch (error: any) {
    console.error("[Call Tools API Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Erreur d'exécution de l'outil", output: { error: error.message } },
      { status: 500 }
    );
  }
}
