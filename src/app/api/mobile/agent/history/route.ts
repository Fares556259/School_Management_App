import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userId, userType } = auth.payload;
    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "40", 10);
    const conversationIdParam = searchParams.get("conversationId");

    let conversation: any = null;
    if (conversationIdParam) {
      conversation = await prisma.aIConversation.findUnique({
        where: { id: conversationIdParam },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: limit,
          },
          toolCalls: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    } else {
      conversation = await prisma.aIConversation.findFirst({
        where: {
          adminId: userId,
          source: "mobile",
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            take: limit,
          },
          toolCalls: {
            where: { status: "PENDING" },
            orderBy: { createdAt: "desc" },
          },
        },
      });
    }

    if (!conversation) {
      return NextResponse.json({
        success: true,
        conversationId: null,
        messages: [],
        pendingConfirmations: [],
      });
    }

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      messages: conversation.messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      pendingConfirmations: conversation.toolCalls.map((tc: any) => ({
        toolCallId: tc.id,
        toolName: tc.toolName,
        arguments: tc.arguments,
        status: tc.status,
      })),
    });
  } catch (error: any) {
    console.error("[Mobile Agent History API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}
