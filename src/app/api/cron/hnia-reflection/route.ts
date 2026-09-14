import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "@/lib/telegram/telegram";
import { formatTelegramMessage } from "@/lib/telegram/formatter";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CANDIDATE_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

/**
 * Nightly / Weekly Autonomous Reflection Cron
 * Scans conversations flagged with NEEDS_LEARNING or failed tool calls,
 * analyzes user corrections, distills new knowledge rules, and saves them to AIKnowledge.
 */
export async function GET(req: NextRequest) {
  return handleReflection(req);
}

export async function POST(req: NextRequest) {
  return handleReflection(req);
}

async function handleReflection(req: NextRequest) {
  // 1. Cron Authentication (if CRON_SECRET configured)
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  // 2. Fetch conversations that need learning
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const candidateConvs = await prisma.aIConversation.findMany({
    where: {
      createdAt: { gte: oneWeekAgo },
      OR: [
        { status: "NEEDS_LEARNING" },
        {
          toolCalls: {
            some: {
              status: { in: ["FAILED", "REJECTED"] },
            },
          },
        },
      ],
    },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        take: 20,
      },
      toolCalls: {
        orderBy: { createdAt: "asc" },
        take: 10,
      },
      telegramAccount: {
        include: {
          School: true,
          admin: true,
        },
      },
    },
    take: 10,
    orderBy: { updatedAt: "desc" },
  });

  if (candidateConvs.length === 0) {
    return NextResponse.json({
      success: true,
      processedCount: 0,
      learnedCount: 0,
      message: "Aucune conversation nécessitant un apprentissage n'a été trouvée.",
    });
  }

  const results: any[] = [];
  let learnedCount = 0;

  for (const conv of candidateConvs) {
    const schoolName = conv.telegramAccount.School.name;
    const adminName =
      [conv.telegramAccount.admin.name, conv.telegramAccount.admin.surname].filter(Boolean).join(" ") ||
      conv.telegramAccount.admin.username;

    // Build transcript
    const transcriptLines = conv.messages.map((m) => `${m.role.toUpperCase()}: ${m.content}`);
    const toolCallSummary = conv.toolCalls.map(
      (tc) =>
        `OUTIL: ${tc.toolName} | STATUT: ${tc.status} | ARGS: ${JSON.stringify(tc.arguments)} | RESULTAT: ${JSON.stringify(
          tc.result
        )}`
    );

    const promptText = `Tu es le Superviseur d'Amélioration Continue d'Hnia (l'agent IA d'exploitation de SnapSchool).
Ton rôle est d'analyser un incident où Hnia a été corrigée par l'administrateur ou a échoué dans sa réponse.

ÉTABLISSEMENT : "${schoolName}"
ADMINISTRATEUR : "${adminName}"

TRANSCRIPT DES ÉCHANGES :
${transcriptLines.join("\n")}

APPELS D'OUTILS LIÉS :
${toolCallSummary.join("\n") || "Aucun outil appelé"}

MISSION :
1. Identifie l'erreur, l'ambiguïté ou la correction apportée par l'administrateur.
2. Détermine s'il y a une RÈGLE MÉTIER PÉRENNE, un fait utile, une association d'homonyme ou une directive à retenir pour cet établissement.
   Exemples :
   - "Bringa bring (3A) est l'enfant de Moune Saoud, différent de l'élève en 1A."
   - "Si Moncef désigne Moncef Trabelsi, enseignant d'arabe."
   - "Le chauffeur du bus 2 est Am Hedi au 98123456."
   - "Ne pas envoyer de rappel de paiement pour l'élève X."
   - "Les avances sur salaire doivent toujours être déduites du solde restant dû."
3. Si l'incident est anecdotique (ex: simple salut, faute de frappe, question hors sujet), retourne hasLearnableRule: false.

Réponds STRICTEMENT par un JSON valide (sans code markdown supplémentaire) :
{
  "hasLearnableRule": true ou false,
  "category": "GENERAL" | "FINANCE" | "STAFF" | "RULES" | "PEDAGOGY" | "TRANSPORT" | "TIMETABLE",
  "instruction": "La règle claire, concise et directement applicable...",
  "reasoning": "Pourquoi cette règle est déduite de cet incident..."
}`;

    let reflectionResult: any = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });

        const res = await model.generateContent(promptText);
        const text = res.response.text();
        reflectionResult = JSON.parse(text);
        break;
      } catch (e: any) {
        console.warn(`[Hnia Reflection] Model ${modelName} failed on conv ${conv.id}:`, e.message);
      }
    }

    if (!reflectionResult || !reflectionResult.hasLearnableRule || !reflectionResult.instruction) {
      // Mark as reviewed with no learnable rule
      await prisma.aIConversation.update({
        where: { id: conv.id },
        data: { status: "REVIEWED" },
      });
      results.push({ conversationId: conv.id, learned: false, reason: "No learnable rule found" });
      continue;
    }

    const cleanInstruction = reflectionResult.instruction.trim();
    const category = reflectionResult.category || "GENERAL";

    // Deduplicate against existing active knowledge for this school
    const existing = await prisma.aIKnowledge.findFirst({
      where: {
        schoolId: conv.telegramAccount.schoolId,
        isActive: true,
        instruction: {
          contains: cleanInstruction.slice(0, 30),
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      await prisma.aIConversation.update({
        where: { id: conv.id },
        data: { status: "LEARNED" },
      });
      results.push({ conversationId: conv.id, learned: false, reason: "Already learned" });
      continue;
    }

    // Insert new knowledge record
    const newKnowledge = await prisma.aIKnowledge.create({
      data: {
        schoolId: conv.telegramAccount.schoolId,
        adminId: conv.telegramAccount.adminId,
        category,
        instruction: cleanInstruction,
        isActive: true,
      },
    });

    // Mark conversation as learned
    await prisma.aIConversation.update({
      where: { id: conv.id },
      data: { status: "LEARNED" },
    });

    learnedCount++;
    results.push({
      conversationId: conv.id,
      learned: true,
      knowledgeId: newKnowledge.id,
      instruction: cleanInstruction,
      category,
    });

    // Send Telegram Notification to the admin about the new learned rule
    try {
      const chatId = conv.telegramChatId;
      const categoryBadges: Record<string, string> = {
        GENERAL: "📌 Général",
        FINANCE: "💰 Finance & Tarifs",
        TRANSPORT: "🚌 Transport",
        RULES: "📜 Règlements",
        TIMETABLE: "⏰ Horaires",
        STAFF: "👥 Personnel",
        PEDAGOGY: "📚 Pédagogie",
      };
      const badge = categoryBadges[category] || `📂 ${category}`;

      const notifyMsg = formatTelegramMessage(
        `🧠 <b>Auto-Apprentissage d'Hnia</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `Suite à nos récents échanges, j'ai analysé notre conversation et enregistré la directive suivante :\n\n` +
          `📝 <i>« ${cleanInstruction} »</i>\n` +
          `📂 <b>Domaine :</b> <code>${badge}</code>\n\n` +
          `<blockquote>💡 <b>Hnia :</b> Cette règle est maintenant active et sera appliquée en priorité dans toutes les prochaines opérations !</blockquote>`,
        schoolName
      );

      await sendTelegramMessage(chatId, notifyMsg, { parse_mode: "HTML" });
    } catch (notifyErr) {
      console.warn(`[Hnia Reflection] Failed to send telegram notification for conv ${conv.id}:`, notifyErr);
    }
  }

  return NextResponse.json({
    success: true,
    processedCount: candidateConvs.length,
    learnedCount,
    results,
  });
}
