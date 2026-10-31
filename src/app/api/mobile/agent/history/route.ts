import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobileAuth";
import prisma from "@/lib/prisma";
import { buildActionCardMetadata } from "@/lib/agent/actionCards";
import { isActionExpired } from "@/lib/agent/actionPolicy";
import { buildReadPresentation } from '@/lib/agent/readPresentation';

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") || 60);
    const limit = Number.isInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 100)) : 60;
    const conversationIdParam = searchParams.get("conversationId");
    const search = (searchParams.get('search') || '').trim().slice(0, 120);
    const messageFilter = search ? { content: { contains: search, mode: 'insensitive' as const } } : {};

    // Return list of all active conversation threads for multi-thread drawer
    if (searchParams.get("threads") === "true") {
      const conversations = await prisma.aIConversation.findMany({
        where: {
          OR: [
            { adminId: userId },
            { telegramAccount: { adminId: userId } },
          ],
          status: { not: "DELETED" },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
        include: {
          messages: {
            where: messageFilter,
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          _count: {
            select: { messages: true },
          },
        },
      });

      const validConversations = conversations.filter(
        (c) => c._count.messages > 0 || c.status === "ACTIVE"
      );

      return NextResponse.json({
        success: true,
        threads: validConversations.map((c) => {
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
      conversation = await prisma.aIConversation.findFirst({
        where: {
          id: conversationIdParam,
          status: { not: "DELETED" },
          OR: [
            { adminId: userId },
            { telegramAccount: { adminId: userId } },
          ],
        },
        include: {
          messages: {
            where: messageFilter,
            orderBy: { createdAt: "desc" },
            take: limit,
          },
          toolCalls: {
            where: { requiresConfirm: true },
            orderBy: { createdAt: "desc" },
            take: 200,
          },
        },
      });
    }

    if (!conversation && conversationIdParam && search) return NextResponse.json({ success: false, error: 'Conversation introuvable.' }, { status: 404 });
    // Fallback: if no specific conversation requested or requested ID not found, load most recent active one
    if (!conversation) {
      conversation = await prisma.aIConversation.findFirst({
        where: {
          OR: [
            { adminId: userId },
            { telegramAccount: { adminId: userId } },
          ],
          status: { not: "DELETED" },
        },
        orderBy: { updatedAt: "desc" },
        include: {
          messages: {
            where: messageFilter,
            orderBy: { createdAt: "desc" },
            take: limit,
          },
          toolCalls: {
            where: { requiresConfirm: true },
            orderBy: { createdAt: "desc" },
            take: 200,
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
    const visibleReadIds = sortedMessages.map((message: any) => message.toolCallId).filter(Boolean);
    const visibleReads = visibleReadIds.length ? await prisma.aIToolCall.findMany({ where: { id: { in: visibleReadIds }, conversationId: conversation.id, requiresConfirm: false, status: 'EXECUTED' }, select: { id: true, toolName: true, arguments: true, result: true, executedAt: true } }) : [];
    const readCalls = new Map<string, any>(visibleReads.map((tc: any) => [tc.id, tc]));
    const actionCards = new Map<string, any>(conversation.toolCalls.filter((tc: any) => tc.requiresConfirm).map((tc: any) => {
      const status = tc.status === "PENDING" && isActionExpired(tc.createdAt) ? "EXPIRED" : tc.status;
      const card = buildActionCardMetadata(tc.id, tc.toolName, tc.arguments || {}, "Vérifiez les détails puis confirmez cette action.", tc.result?.proposalDisplay);
      return [tc.id, { ...card, status, reference: status === "EXECUTED" ? `ACT-${tc.id}` : undefined, completedAt: tc.executedAt?.toISOString(), undoExpenseId: status === 'EXECUTED' && tc.toolName === 'add_expense' && Number.isInteger(tc.result?.data?.expenseId) ? tc.result.data.expenseId : undefined }];
    }));

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

        const read = m.toolCallId ? readCalls.get(m.toolCallId) : null;
        const presentation = read ? buildReadPresentation(read.toolName, read.arguments || {}, { ...read.result, fetchedAt: read.result?.fetchedAt || read.executedAt?.toISOString() }, { schoolId }, read.id) : {};
        return {
          id: m.id,
          role: m.role,
          content,
          imageUri,
          createdAt: m.createdAt,
          ...presentation,
          pendingConfirmation: m.toolCallId ? actionCards.get(m.toolCallId) || null : null,
        };
      }),
      pendingConfirmations: [...actionCards.values()].filter(card => card.status === "PENDING" || card.status === "EXECUTING"),
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
    const auth = await authenticateMobileRequest(request);
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
    const auth = await authenticateMobileRequest(request);
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
        OR: [
          { adminId: userId },
          { telegramAccount: { adminId: userId } },
        ],
      },
      data: {
        status: "DELETED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Discussion supprimée avec succès.",
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
    const auth = await authenticateMobileRequest(request);
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
        OR: [
          { adminId: userId },
          { telegramAccount: { adminId: userId } },
        ],
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

