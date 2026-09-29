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
    const limit = parseInt(searchParams.get("limit") || "60", 10);
    const conversationIdParam = searchParams.get("conversationId");

    let conversation: any = null;
    if (conversationIdParam) {
      conversation = await prisma.aIConversation.findUnique({
        where: { id: conversationIdParam },
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
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
            orderBy: { createdAt: "desc" },
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

    const sortedMessages = [...(conversation.messages || [])].reverse();

    return NextResponse.json({
      success: true,
      conversationId: conversation.id,
      messages: sortedMessages.map((m: any) => {
        let content = m.content || "";
        let imageUri: string | undefined = undefined;

        // Check if content contains image tag or raw document prompt
        const imgMatch = content.match(/\[IMAGE:(https?:\/\/[^\]]+)\]/);
        if (imgMatch) {
          imageUri = imgMatch[1];
          content = content.replace(/\[IMAGE:https?:\/\/[^\]]+\]\n?/, "").trim();
        } else if (content.includes("[DOCUMENT NUMÉRISÉ REÇU PAR PHOTO]")) {
          const urlMatch = content.match(/Justificatif \(URL image\) :\s*(https?:\/\/[^\s\n]+)/) ||
                           content.match(/img:\s*["\x27](https?:\/\/[^"\x27]+)["\x27]/);
          if (urlMatch) {
            imageUri = urlMatch[1];
          }
          const titleMatch = content.match(/Titre \/ Enseigne :\s*([^\n]+)/);
          const amountMatch = content.match(/Montant extrait :\s*([^\n]+)/);
          const merchant = titleMatch && !titleMatch[1].includes("Non spécifié") ? titleMatch[1].trim() : "";
          const amount = amountMatch && !amountMatch[1].includes("Non spécifié") ? amountMatch[1].trim() : "";
          
          if (merchant) {
            content = `📷 ${merchant}${amount ? ` (${amount})` : ""}`;
          } else {
            content = "📷 Justificatif / Reçu envoyé";
          }
        }

        return {
          id: m.id,
          role: m.role,
          content,
          imageUri,
          createdAt: m.createdAt,
        };
      }),
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
