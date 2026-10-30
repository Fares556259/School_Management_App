import { NextRequest, NextResponse } from "next/server";
import { authenticateMobileRequest, checkRateLimit } from "@/lib/mobileAuth";
import { runMobileAgent } from "@/lib/agent/mobileAgent";
import { transcribeMobileAudio } from '@/lib/agent/mobileAgent';

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateMobileRequest(request);
    if (auth.error) return auth.error;

    const { userId, userType, schoolId } = auth.payload;
    const ip = request.headers.get("x-forwarded-for") || "unknown_ip";
    const rateLimited = checkRateLimit(userId || ip, "chat");
    if (!rateLimited.success) {
      return NextResponse.json({ error: 'Trop de requêtes. Veuillez patienter.' }, { status: 429 });
    }

    if (userType !== "admin") {
      return NextResponse.json(
        { success: false, error: "Accès réservé à la direction / administrateur." },
        { status: 403 }
      );
    }

    const body = await request.json();
    if (body.transcribeOnly === true) {
      if (typeof body.audioBase64 !== 'string' || !body.audioBase64 || body.audioBase64.length > 12_000_000) return NextResponse.json({ success: false, error: 'Invalid audio' }, { status: 400 });
      const transcription = await transcribeMobileAudio(body.audioBase64, body.audioMimeType, request.signal);
      return NextResponse.json({ success: Boolean(transcription), transcription }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const wantsStream =
      body.stream === true ||
      request.headers.get("accept")?.includes("text/event-stream") ||
      request.nextUrl.searchParams.get("stream") === "true";

    if (wantsStream) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();
      let tokenBuffer = "";
      let tokenTimer: ReturnType<typeof setTimeout> | null = null;

      const sendEvent = async (event: string, data: any) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          await writer.write(encoder.encode(payload));
        } catch {
          // Stream might be closed by client
        }
      };
      const flushTokens = async () => {
        if (!tokenBuffer) return;
        const delta = tokenBuffer;
        tokenBuffer = "";
        await sendEvent("token", { delta });
      };

      // Run agent asynchronously in background of the stream
      (async () => {
        try {
          const result = await runMobileAgent({
            userMessage: body.message,
            adminId: userId,
            schoolId,
            conversationId: body.conversationId,
            newConversation: body.newConversation === true,
            nextReadPage: body.nextReadPage === true,
            refreshReadId: typeof body.refreshReadId === 'string' ? body.refreshReadId : undefined,
            language: ['fr', 'en', 'ar'].includes(body.language) ? body.language : 'fr',
            audioBase64: body.audioBase64,
            audioMimeType: body.audioMimeType,
            imageBase64: body.imageBase64,
            imageMimeType: body.imageMimeType,
            signal: request.signal,
            onStatusUpdate: async (status) => {
              await sendEvent("status", status);
            },
            onTranscription: async (transcription) => {
              await sendEvent("transcription", { transcription });
            },
            onTokenDelta: async (delta) => {
              tokenBuffer += delta;
              if (!tokenTimer) {
                tokenTimer = setTimeout(() => {
                  tokenTimer = null;
                  void flushTokens();
                }, 40);
              }
            },
          });

          if (tokenTimer) {
            clearTimeout(tokenTimer);
            tokenTimer = null;
          }
          await flushTokens();

          if (result.widget) {
            await sendEvent("widget", { widget: result.widget });
          }

          if (result.pendingConfirmation) {
            await sendEvent("confirmation", { pendingConfirmation: result.pendingConfirmation });
          }

          await sendEvent("done", result);
        } catch (err: any) {
          console.error("[Mobile Agent Chat Stream] Error:", err);
          await sendEvent("error", {
            error: err.message || "Erreur de traitement de la demande",
          });
        } finally {
          if (tokenTimer) clearTimeout(tokenTimer);
          try {
            await writer.close();
          } catch {}
        }
      })();

      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    const result = await runMobileAgent({
      userMessage: body.message,
      adminId: userId,
      schoolId,
      conversationId: body.conversationId,
      newConversation: body.newConversation === true,
      nextReadPage: body.nextReadPage === true,
      refreshReadId: typeof body.refreshReadId === 'string' ? body.refreshReadId : undefined,
      language: ['fr', 'en', 'ar'].includes(body.language) ? body.language : 'fr',
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
        message: error.message || "Erreur interne du serveur",
        error: error.message || "Erreur interne du serveur",
      },
      { status: 500 }
    );
  }
}
