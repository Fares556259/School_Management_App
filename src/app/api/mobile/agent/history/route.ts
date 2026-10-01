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

    // Return list of all active conversation threads for multi-thread drawer
    if (searchParams.get("threads") === "true") {
      const conversations = await prisma.aIConversation.findMany({
        where: {
          adminId: userId,
          source: "mobile",
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        threads: conversations.map((c) => {
          const lastMsg = c.messages[0];
          let preview = lastMsg?.content || "";
          preview = preview.replace(/\[IMAGE:https?:\/\/[^\]]+\]\n?/g, "📷 Photo ").replace(/[#*`_]/g, "").trim();
          if (preview.length > 70) preview = preview.slice(0, 67) + "...";
          return {
            id: c.id,
            title: c.title || "Nouvelle discussion",
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            messageCount: c._count.messages,
            lastMessage: preview || null,
          };
        }),
      });
    }

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

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const newConv = await prisma.aIConversation.create({
      data: {
        adminId: userId,
        source: "mobile",
        status: "ACTIVE",
        title: (body.title || "Nouvelle discussion").slice(0, 40),
      },
    });

    return NextResponse.json({
      success: true,
      conversationId: newConv.id,
      title: newConv.title,
    });
  } catch (error: any) {
    console.error("[Mobile Agent Create Thread API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const conversationId = searchParams.get("conversationId");
    if (!conversationId) {
      return NextResponse.json(
        { success: false, error: "conversationId requis." },
        { status: 400 }
      );
    }

    await prisma.aIConversation.updateMany({
      where: {
        id: conversationId,
        adminId: userId,
      },
      data: {
        status: "ARCHIVED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Discussion archivée avec succès.",
    });
  } catch (error: any) {
    console.error("[Mobile Agent Delete Thread API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { conversationId, title } = body;
    if (!conversationId || !title?.trim()) {
      return NextResponse.json(
        { success: false, error: "conversationId et titre requis." },
        { status: 400 }
      );
    }

    const newTitle = title.trim().slice(0, 60);
    await prisma.aIConversation.updateMany({
      where: {
        id: conversationId,
        adminId: userId,
      },
      data: {
        title: newTitle,
      },
    });

    return NextResponse.json({
      success: true,
      conversationId,
      title: newTitle,
    });
  } catch (error: any) {
    console.error("[Mobile Agent Rename Thread API] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur interne" },
      { status: 500 }
    );
  }
}

