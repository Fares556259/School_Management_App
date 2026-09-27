import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { TOOLS, getPrunedGeminiDeclarations } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { getCachedKnowledge, setCachedKnowledge } from "@/lib/telegram/agent";
import { buildHniaSystemInstruction } from "./hniaPrompt";
import { analyzeTelegramImage, uploadTelegramPhotoToStorage } from "@/lib/telegram/vision";

export interface MobileAgentInput {
  userMessage?: string;
  adminId: string;
  schoolId: string;
  conversationId?: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageBase64?: string;
  imageMimeType?: string;
}

export interface MobileAgentResponse {
  success: boolean;
  conversationId: string;
  message: string;
  transcription?: string;
  analyzedDocument?: any;
  pendingConfirmation?: {
    toolCallId: string;
    toolName: string;
    confirmText: string;
    arguments: Record<string, any>;
  } | null;
  executedTool?: string;
  followUpSuggestions?: string[];
  error?: string;
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

/**
 * Strip Telegram-specific formatting (HTML tags, custom separators, code tags)
 * and convert to clean, mobile-optimized markdown.
 */
export function cleanTelegramFormattingForMobile(text: string): string {
  if (!text) return "";
  let clean = text;
  // Replace HTML entities
  clean = clean
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  // Strip separator bars
  clean = clean.replace(/[━─═-]{4,}/g, "");
  // Convert HTML bold to markdown bold
  clean = clean.replace(/<\/?(?:b|strong)>/gi, "**");
  // Convert HTML italic to markdown italic
  clean = clean.replace(/<\/?(?:i|em)>/gi, "*");
  // Strip HTML code tag wrapper
  clean = clean.replace(/<\/?code>/gi, "");
  // Convert blockquote to markdown blockquote
  clean = clean.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "> $1\n");
  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, "");
  // Clean redundant whitespace
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  return clean;
}

/**
 * Transcribe mobile audio recording (m4a, aac, wav, ogg) using Gemini multimodal audio.
 */
async function transcribeMobileAudio(
  base64Audio: string,
  mimeType: string = "audio/m4a"
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Clé GEMINI_API_KEY manquante");

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `You are an expert, high-fidelity audio transcriber specialized in Tunisian school operations and North African multilingual speech.
Transcribe the speaker's exact spoken words word-for-word.

CRITICAL TRANSCRIBING RULES:
1. DIALECT RECOGNITION: The speaker is speaking in Tunisian Arabic (Derja / Tounsi), French, English, or a natural mix of Tunisian Arabic and French (code-switching).
2. DO NOT TRANSLATE: Never translate Tunisian words into French or English. Transcribe in the exact language spoken.
3. MULTI-INTENT SPOKEN COMMANDS: School directors frequently give compound instructions (e.g. "300 DT khlass w 40 mazout").
4. SCHOOL VOCABULARY: Common terms include: élèves, profs, classes (1A, 2B...), matières, notes, absences, retards, paiements, reliquats, impayés, factures, STEG, SONEDE, Dinars / DT, cantine, مازوط, كاسة, شيك, تلامذة, معلمين, Appel.
5. OUTPUT: Output ONLY the exact transcribed text. No quotes, no markdown explanations.`;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: mimeType.toLowerCase().includes("m4a") ? "audio/mp4" : mimeType,
          },
        },
        { text: prompt },
      ]);
      const text = result.response.text().trim();
      if (text) return text;
    } catch (err: any) {
      console.warn(`[Mobile Voice] Failed with ${modelName}:`, err.message);
    }
  }
  return "";
}

/**
 * Main agent runner for SnapSchool Mobile app requests.
 */
export async function runMobileAgent(input: MobileAgentInput): Promise<MobileAgentResponse> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      conversationId: input.conversationId || "",
      message: "⚠️ Clé GEMINI_API_KEY non configurée sur le serveur.",
      error: "MISSING_API_KEY",
    };
  }

  // 1. Fetch admin and school
  const admin = await prisma.admin.findUnique({
    where: { id: input.adminId },
    include: { School: true },
  });

  if (!admin) {
    return {
      success: false,
      conversationId: input.conversationId || "",
      message: "Administrateur introuvable.",
      error: "ADMIN_NOT_FOUND",
    };
  }

  const adminName = [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username;
  const schoolName = admin.School?.name || "SnapSchool";

  // 2. Handle Audio input if provided
  let transcription: string | undefined;
  let effectiveUserMessage = (input.userMessage || "").trim();

  if (input.audioBase64) {
    try {
      transcription = await transcribeMobileAudio(input.audioBase64, input.audioMimeType);
      if (transcription) {
        effectiveUserMessage = effectiveUserMessage
          ? `${effectiveUserMessage}\n${transcription}`
          : transcription;
      }
    } catch (audioErr) {
      console.error("[MobileAgent] Audio transcription error:", audioErr);
    }
  }

  // 3. Handle Image input if provided
  let analyzedDoc: any = null;
  if (input.imageBase64) {
    try {
      const buffer = Buffer.from(input.imageBase64, "base64");
      const mime = input.imageMimeType || "image/jpeg";

      // Upload to storage asynchronously
      const publicUrl = await uploadTelegramPhotoToStorage(buffer, input.schoolId, "mobile_doc", mime);

      // Analyze document using Gemini Vision
      analyzedDoc = await analyzeTelegramImage(buffer, effectiveUserMessage);
      if (publicUrl) {
        analyzedDoc.publicUrl = publicUrl;
      }

      // Prepend document analysis to effective message
      const docSummary = `[DOCUMENT ANALYSÉ] Type: ${analyzedDoc.documentType}, Montant: ${analyzedDoc.amount || "N/A"} DT, Commerçant/Bénéficiaire: ${analyzedDoc.merchant || analyzedDoc.studentName || analyzedDoc.parentName || "N/A"}, Date: ${analyzedDoc.date || "N/A"}, Action suggérée: ${analyzedDoc.suggestedAction || "none"}, Résumé: ${analyzedDoc.summary}`;
      effectiveUserMessage = effectiveUserMessage
        ? `${docSummary}\n\nMessage de l'administrateur : ${effectiveUserMessage}`
        : `${docSummary}\n\nQue dois-je faire avec ce document ?`;
    } catch (imgErr) {
      console.error("[MobileAgent] Image analysis error:", imgErr);
    }
  }

  if (!effectiveUserMessage) {
    if (input.audioBase64) {
      return {
        success: true,
        conversationId: input.conversationId || "",
        message: "🎙️ Je n'ai pas entendu de voix ou le son était trop faible. Veuillez réessayer de parler un peu plus fort près du micro.",
      };
    }
    return {
      success: false,
      conversationId: input.conversationId || "",
      message: "Message vide.",
      error: "EMPTY_MESSAGE",
    };
  }

  // 4. Resolve conversation
  let conversation: any = null;
  if (input.conversationId) {
    conversation = await prisma.aIConversation.findUnique({
      where: { id: input.conversationId },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
      },
    });
  }

  if (!conversation) {
    conversation = await prisma.aIConversation.findFirst({
      where: {
        adminId: input.adminId,
        source: "mobile",
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 12,
        },
      },
    });
  }

  let conversationId: string;
  let historyMessages: { role: string; content: string }[] = [];

  if (conversation) {
    conversationId = conversation.id;
    historyMessages = [...conversation.messages].reverse();
  } else {
    const newConv = await prisma.aIConversation.create({
      data: {
        adminId: input.adminId,
        source: "mobile",
        status: "ACTIVE",
        title: (transcription || effectiveUserMessage).slice(0, 40),
      },
    });
    conversationId = newConv.id;
  }

  // Save user message (fire-and-forget)
  prisma.aIMessage.create({
    data: {
      conversationId,
      role: "user",
      content: effectiveUserMessage,
    },
  }).catch((e) => console.warn("[MobileAgent] aIMessage user save failed:", e));

  prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  }).catch(() => null);

  // 5. Tool Context
  const context: ToolContext = {
    schoolId: input.schoolId,
    adminId: input.adminId,
    adminName,
    language: "fr",
  };

  // 6. Fast-path checks
  const msgLower = effectiveUserMessage.trim().toLowerCase();
  if (/^(bonjour|salut|ahla|salam|hello|hi)[\s!?.]*$/i.test(msgLower)) {
    const greeting = `👋 **Bonjour ${adminName} !**\n\nJe suis **Hnia**, votre assistante SnapSchool 🎓\nComment puis-je vous aider aujourd'hui ?`;
    await prisma.aIMessage.create({
      data: { conversationId, role: "assistant", content: greeting },
    });
    return {
      success: true,
      conversationId,
      message: greeting,
      transcription,
      analyzedDocument: analyzedDoc,
      followUpSuggestions: ["Caisse du jour 💰", "Absences 📋", "Emploi du temps ⏰"],
    };
  }

  // ── FAST-PATHS for instant response (< 100ms) on common school operations ──
  const IMPAYES_REGEX = /(impayés?|non payé|reliquat|qui n'a pas payé|شكون ما خلصش|dettes?)/i;
  const CAISSE_REGEX = /(caisse du jour|clôture de caisse|bilan de caisse|كاسة اليوم|point de caisse)/i;
  const ABSENCES_REGEX = /(absences? du jour|qui est absent|absents? aujourd'hui|شكون غايب|appel du jour)/i;
  const STATS_REGEX = /(effectifs?|stats? école|statistiques? école)/i;

  if (IMPAYES_REGEX.test(msgLower)) {
    try {
      const { getPaymentsTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getPaymentsTool({ status: "UNPAID" }, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });
        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          executedTool: "get_payments",
          followUpSuggestions: ["Caisse du jour 💰", "Absences 📋", "Planning ⏰"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path impayes error:", e);
    }
  }

  if (CAISSE_REGEX.test(msgLower)) {
    try {
      const { getDailyCaisseTool } = await import("@/lib/telegram/tools/financeTools");
      const out = (await getDailyCaisseTool({ date: "today" }, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });
        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          executedTool: "get_daily_caisse",
          followUpSuggestions: ["Impayés du mois 💳", "Absences 📋", "Dépenses 💸"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path caisse error:", e);
    }
  }

  if (ABSENCES_REGEX.test(msgLower)) {
    try {
      const { getAttendanceTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getAttendanceTool({}, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });
        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          executedTool: "get_attendance",
          followUpSuggestions: ["Notifier les parents 📢", "Caisse du jour 💰", "Emploi du temps ⏰"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path absences error:", e);
    }
  }

  if (STATS_REGEX.test(msgLower)) {
    try {
      const { getSchoolStatsTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getSchoolStatsTool({}, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });
        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          executedTool: "get_school_stats",
          followUpSuggestions: ["Caisse du jour 💰", "Absences 📋"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path stats error:", e);
    }
  }

  // 7. Resolve school knowledge / teachings
  let schoolTeachings = getCachedKnowledge(input.schoolId);
  if (!schoolTeachings) {
    schoolTeachings = await prisma.aIKnowledge.findMany({
      where: { schoolId: input.schoolId, isActive: true },
      orderBy: { createdAt: "desc" },
      take: 40,
    });
    setCachedKnowledge(input.schoolId, schoolTeachings);
  }

  // 8. Build System Instruction
  const systemInstruction = buildHniaSystemInstruction({
    schoolName,
    adminName,
    schoolTeachings,
  });

  // 9. Build History
  const rawTurns: { role: "user" | "model"; text: string }[] = [];
  for (const m of historyMessages) {
    if (!m.content?.trim()) continue;
    rawTurns.push({
      role: m.role === "assistant" ? "model" : "user",
      text: m.content.trim(),
    });
  }

  const normalizedTurns: { role: "user" | "model"; text: string }[] = [];
  for (const turn of rawTurns) {
    if (
      normalizedTurns.length > 0 &&
      normalizedTurns[normalizedTurns.length - 1].role === turn.role
    ) {
      normalizedTurns[normalizedTurns.length - 1].text += `\n${turn.text}`;
    } else {
      normalizedTurns.push({ role: turn.role, text: turn.text });
    }
  }

  while (normalizedTurns.length > 0 && normalizedTurns[0].role !== "user") {
    normalizedTurns.shift();
  }
  while (
    normalizedTurns.length > 0 &&
    normalizedTurns[normalizedTurns.length - 1].role !== "model"
  ) {
    normalizedTurns.pop();
  }

  const historyContents = normalizedTurns.map((t) => ({
    role: t.role,
    parts: [{ text: t.text }],
  }));

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [
          {
            functionDeclarations: getPrunedGeminiDeclarations(effectiveUserMessage),
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 2048,
        },
      });

      const chat = model.startChat({ history: historyContents });
      let response = await chat.sendMessage([{ text: effectiveUserMessage }]);
      let candidate = response.response;

      let functionCalls = candidate.functionCalls();
      let lastExecutedTool: string | undefined;
      let finalReply: string | undefined;
      let pendingConfirmation: MobileAgentResponse["pendingConfirmation"] = null;

      const MAX_TOOL_ITERATIONS = 5;
      let iterations = 0;

      while (functionCalls && functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        const call = functionCalls[0];
        const toolName = call.name;
        const toolArgs = (call.args || {}) as Record<string, any>;
        const toolDef = TOOLS[toolName];

        if (!toolDef) {
          console.warn(`[MobileAgent] Unknown tool call: ${toolName}`);
          break;
        }

        // Action requires confirmation
        if (toolDef.requiresConfirmation) {
          const toolCallRecord = await prisma.aIToolCall.create({
            data: {
              conversationId,
              toolName,
              arguments: toolArgs,
              status: "PENDING",
              requiresConfirm: true,
            },
          });

          const rawConfirmText = toolDef.formatConfirmationMessage
            ? await Promise.resolve(toolDef.formatConfirmationMessage(toolArgs, context))
            : `❓ Souhaitez-vous confirmer l'exécution de l'action **${toolName}** ?`;
          const confirmText = cleanTelegramFormattingForMobile(rawConfirmText);

          pendingConfirmation = {
            toolCallId: toolCallRecord.id,
            toolName,
            confirmText,
            arguments: toolArgs,
          };

          finalReply = "Veuillez vérifier et confirmer l'action ci-dessous :";

          // Save assistant message with confirmation request
          await prisma.aIMessage.create({
            data: {
              conversationId,
              role: "assistant",
              content: confirmText,
            },
          });

          return {
            success: true,
            conversationId,
            message: finalReply,
            transcription,
            analyzedDocument: analyzedDoc,
            pendingConfirmation,
            executedTool: toolName,
            followUpSuggestions: [],
          };
        }

        // Read-only or instant tool
        lastExecutedTool = toolName;
        let toolOutput: any;
        try {
          toolOutput = await toolDef.execute(toolArgs, context);
        } catch (err: any) {
          toolOutput = { error: true, message: err.message || "Erreur d'exécution" };
        }

        prisma.aIToolCall.create({
          data: {
            conversationId,
            toolName,
            arguments: toolArgs,
            result: toolOutput,
            status: toolOutput?.error ? "FAILED" : "EXECUTED",
            executedAt: new Date(),
          },
        }).catch(() => null);

        // Fast path: if formattedText exists
        if (toolOutput?.formattedText) {
          finalReply = cleanTelegramFormattingForMobile(toolOutput.formattedText);
          break;
        }

        // Synthesize via Gemini
        response = await chat.sendMessage([
          {
            text: `[DONNÉES SYSTÈME POUR ${toolName.toUpperCase()}] :\n${JSON.stringify(
              toolOutput
            )}\n\nPrésente ces données à l'administrateur sous forme claire et scannable optimisée pour l'écran mobile :
- Utilise le format Markdown avec **gras**, listes à puces et tableaux si nécessaire.
- Zéro jargon technique ou ID UUID.
- Termine par un conseil Hnia si pertinent.`,
          },
        ]);

        candidate = response.response;
        functionCalls = candidate.functionCalls();
      }

      if (!finalReply) {
        try {
          const rawText = candidate.text() || "C'est noté ! Avez-vous besoin d'autre chose ?";
          finalReply = cleanTelegramFormattingForMobile(rawText);
        } catch {
          finalReply = "C'est noté ! Avez-vous besoin d'autre chose ?";
        }
      }

      // Save assistant reply
      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: finalReply,
        },
      });

      // Compute smart follow-up suggestions
      const suggestions: string[] = [];
      if (lastExecutedTool === "get_daily_caisse") {
        suggestions.push("Détail des dépenses 💸", "Absences du jour 📋", "Impayés du mois 💳");
      } else if (lastExecutedTool === "get_attendance") {
        suggestions.push("Notifier les parents 📢", "Voir l'emploi du temps ⏰", "Caisse du jour 💰");
      } else {
        suggestions.push("Caisse du jour 💰", "Absences 📋", "Planning ⏰");
      }

      return {
        success: true,
        conversationId,
        message: finalReply,
        transcription,
        analyzedDocument: analyzedDoc,
        pendingConfirmation: null,
        executedTool: lastExecutedTool,
        followUpSuggestions: suggestions,
      };
    } catch (modelErr: any) {
      console.warn(`[MobileAgent] Model ${modelName} error:`, modelErr.message);
    }
  }

  return {
    success: false,
    conversationId: conversationId || "",
    message: "Désolée, une erreur temporaire est survenue. Veuillez réessayer dans quelques instants.",
    error: "AI_GENERATION_FAILED",
  };
}

/**
 * Confirm or cancel a pending action initiated from the mobile app.
 */
export async function confirmMobileAction(params: {
  toolCallId: string;
  action: "confirm" | "cancel";
  adminId: string;
  schoolId: string;
}): Promise<{ success: boolean; message: string; result?: any }> {
  const { toolCallId, action, adminId, schoolId } = params;

  const toolCall = await prisma.aIToolCall.findUnique({
    where: { id: toolCallId },
    include: {
      conversation: {
        include: {
          admin: true,
        },
      },
    },
  });

  if (!toolCall) {
    return { success: false, message: "Action introuvable ou déjà expirée." };
  }

  // Ownership check
  if (toolCall.conversation.adminId && toolCall.conversation.adminId !== adminId) {
    return { success: false, message: "Action non autorisée pour votre compte." };
  }

  // Idempotency check
  if (toolCall.status === "EXECUTED") {
    return { success: true, message: "Cette action a déjà été exécutée avec succès." };
  }
  if (toolCall.status === "REJECTED") {
    return { success: true, message: "Cette action a déjà été annulée." };
  }
  if (toolCall.status === "EXECUTING") {
    return { success: true, message: "Cette action est déjà en cours de traitement." };
  }

  // Atomically claim
  const claimed = await prisma.aIToolCall.updateMany({
    where: { id: toolCallId, status: "PENDING" },
    data: { status: "EXECUTING" },
  });

  if (claimed.count === 0) {
    return { success: true, message: "Cette action est déjà en cours ou a été traitée." };
  }

  if (action === "cancel") {
    await prisma.aIToolCall.update({
      where: { id: toolCallId },
      data: { status: "REJECTED" },
    });

    if (toolCall.conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversationId: toolCall.conversationId,
          role: "assistant",
          content: `❌ L'action **${toolCall.toolName}** a été annulée.`,
        },
      });
    }

    return { success: true, message: "Action annulée avec succès." };
  }

  // Confirm
  const tool = TOOLS[toolCall.toolName];
  if (!tool) {
    await prisma.aIToolCall.update({
      where: { id: toolCallId },
      data: { status: "FAILED", result: { error: "Outil introuvable" } },
    });
    return { success: false, message: "Outil introuvable dans le système." };
  }

  const adminName =
    [toolCall.conversation.admin?.name, toolCall.conversation.admin?.surname].filter(Boolean).join(" ") ||
    toolCall.conversation.admin?.username ||
    "Admin";

  const context: ToolContext = {
    schoolId,
    adminId,
    adminName,
    language: "fr",
  };

  try {
    const args = toolCall.arguments as Record<string, any>;
    const executionResult = await tool.execute(args, context);

    await prisma.aIToolCall.update({
      where: { id: toolCallId },
      data: {
        status: "EXECUTED",
        result: executionResult,
        confirmedAt: new Date(),
        executedAt: new Date(),
      },
    });

    const rawSuccessMsg =
      executionResult?.message || `✅ Action **${toolCall.toolName}** exécutée avec succès !`;
    const successMsg = cleanTelegramFormattingForMobile(rawSuccessMsg);

    if (toolCall.conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversationId: toolCall.conversationId,
          role: "assistant",
          content: successMsg,
        },
      });
    }

    return {
      success: true,
      message: successMsg,
      result: executionResult,
    };
  } catch (err: any) {
    console.error("[MobileAgent] Tool execution error:", err);
    await prisma.aIToolCall.update({
      where: { id: toolCallId },
      data: { status: "FAILED", result: { error: err.message } },
    });

    const rawErrorMsg = `⚠️ Erreur lors de l'exécution de **${toolCall.toolName}** : ${err.message || "Erreur inconnue"}`;
    const errorMsg = cleanTelegramFormattingForMobile(rawErrorMsg);
    if (toolCall.conversationId) {
      await prisma.aIMessage.create({
        data: {
          conversationId: toolCall.conversationId,
          role: "assistant",
          content: errorMsg,
        },
      });
    }

    return {
      success: false,
      message: errorMsg,
    };
  }
}
