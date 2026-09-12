import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyCallToken } from "@/lib/call/token";
import { sendTelegramMessage } from "@/lib/telegram/telegram";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, durationSeconds = 0, transcript = [], actionsTaken = [] } = body;

    if (!token) {
      return NextResponse.json({ error: "Token manquant" }, { status: 401 });
    }

    const payload = verifyCallToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide ou expiré" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Clé Gemini API manquante" }, { status: 500 });
    }

    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationFormatted =
      minutes > 0 ? `${minutes} min ${seconds.toString().padStart(2, "0")} sec` : `${seconds} secondes`;

    const nowFormatted = new Date().toLocaleString("fr-FR", {
      timeZone: "Africa/Tunis",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 1. Synthesize call summary with Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `Tu es Hnia (هنية), assistante d'opérations scolaires de l'école "${payload.schoolName}".
Tu viens de terminer un appel téléphonique direct avec l'administrateur : "${payload.adminName}".
Rédige un compte-rendu d'appel percutant, structuré et professionnel qui sera envoyé sur Telegram.

Détails de l'appel :
- Durée : ${durationFormatted}
- Date : ${nowFormatted}
- Transcription des échanges :
${JSON.stringify(transcript, null, 2)}
- Actions exécutées en base de données pendant l'appel :
${JSON.stringify(actionsTaken, null, 2)}

FORMAT DE SORTIE TELEGRAM (HTML STRICT) :
Rédige UNIQUEMENT le message Telegram en HTML sans balise Markdown ('###', '**', etc.).
Structure obligatoire :
📞 <b>COMPTE-RENDU D'APPEL VOCAL • HNIA</b>
━━━━━━━━━━━━━━━━━━━━━━
⏱️ <b>Durée :</b> <code>${durationFormatted}</code> • 📅 <code>${nowFormatted}</code>
👤 <b>Administrateur :</b> ${payload.adminName}

🗣️ <b>Points abordés :</b>
• [Point 1 clair et concis]
• [Point 2...]

⚡ <b>Actions exécutées en direct :</b>
• [Liste des actions réelles ou "Aucune modification enregistrée (consultation)"]

<blockquote>💡 <b>Hnia :</b> [Une phrase courte de conclusion ou conseil pour la suite]</blockquote>

IMPORTANT : N'inclus AUCUN texte d'introduction, aucun commentaire, renvoie seulement le contenu HTML ci-dessus.`;

    let summaryCard = "";
    try {
      const result = await model.generateContent(prompt);
      summaryCard = result.response.text().trim();
      // Remove possible ```html fences
      summaryCard = summaryCard.replace(/^```html\s*/i, "").replace(/```$/i, "").trim();
    } catch (genErr) {
      console.error("[Call End] Gemini summary error:", genErr);
      // Fallback template
      summaryCard = `📞 <b>COMPTE-RENDU D'APPEL VOCAL • HNIA</b>
━━━━━━━━━━━━━━━━━━━━━━
⏱️ <b>Durée :</b> <code>${durationFormatted}</code> • 📅 <code>${nowFormatted}</code>
👤 <b>Administrateur :</b> ${payload.adminName}

⚡ <b>Actions enregistrées :</b> ${actionsTaken.length} action(s) exécutée(s).
<blockquote>💡 <b>Hnia :</b> Appel vocal clôturé avec succès.</blockquote>`;
    }

    // 2. Deliver summary card to Telegram
    if (payload.telegramChatId) {
      try {
        await sendTelegramMessage(payload.telegramChatId, summaryCard, {
          parse_mode: "HTML",
        });
      } catch (tgErr) {
        console.error("[Call End] Telegram delivery error:", tgErr);
      }
    }

    // 3. Persist call session in AIConversation & AIMessage
    try {
      let conversation = await prisma.aIConversation.findFirst({
        where: {
          telegramChatId: payload.telegramChatId.toString(),
          status: "ACTIVE",
        },
        orderBy: { updatedAt: "desc" },
      });

      if (!conversation) {
        // Try finding linked telegram account
        const tgAcc = await prisma.telegramAccount.findFirst({
          where: {
            schoolId: payload.schoolId,
          },
        });

        if (tgAcc) {
          conversation = await prisma.aIConversation.create({
            data: {
              telegramAccountId: tgAcc.id,
              telegramChatId: payload.telegramChatId.toString(),
              title: `Appel vocal (${durationFormatted})`,
            },
          });
        }
      }

      if (conversation) {
        // Save user transcript summary
        const fullTranscriptText = transcript
          .map((t: any) => `${t.role === "user" ? payload.adminName : "Hnia"}: ${t.text}`)
          .join("\n");

        await prisma.aIMessage.create({
          data: {
            conversationId: conversation.id,
            role: "user",
            content: `[Appel vocal de ${durationFormatted}]\n\n${fullTranscriptText || "Échanges vocaux"}`,
          },
        });

        await prisma.aIMessage.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: summaryCard,
          },
        });
      }
    } catch (dbErr) {
      console.warn("[Call End] DB persist warning:", dbErr);
    }

    return NextResponse.json({ ok: true, summary: summaryCard });
  } catch (error: any) {
    console.error("[Call End API Exception]:", error);
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
