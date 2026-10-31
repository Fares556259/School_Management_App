import { executeFreshSchoolRead, formatSchoolRead, getExactSchoolRead } from "./schoolRead";
import { buildReadPresentation } from './readPresentation';
import { buildMobileImageMessage, explicitCurrencyAmounts, getPurchaseDraft } from './purchaseDraft';
import { prepareConfirmedArguments, freezeMobileActionArguments } from './actionPolicy';
import { isVerificationFollowup, isNextPage, needsFreshSchoolData } from "./dataAccuracy";
import { READ_ONLY_ACTIONS } from "./actionPolicy";
import { ActionCardData, buildActionCardMetadata } from "./actionCards";
import { cleanTelegramFormattingForMobile } from "./mobileFormatting";
import { requiresActionConfirmation } from "./actionPolicy";
export type { ActionCardData, ActionCardField } from "./actionCards";
export { buildActionCardMetadata } from "./actionCards";
export { cleanTelegramFormattingForMobile } from "./mobileFormatting";
export { confirmMobileAction } from "./mobileConfirmation";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { TOOLS, getGeminiFunctionDeclarations, getPrunedGeminiDeclarations } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { buildMobileHniaSystemInstruction } from "./hniaPrompt";
import { analyzeTelegramImage, uploadTelegramPhotoToStorage } from "@/lib/telegram/vision";
import {
  getAvailableModels,
  getHniaModelTimeoutMs,
  getMobileHniaModels,
  isRetryableModelError,
  markModelFailure,
  markModelSuccess,
} from "./modelRuntime";

export interface MobileAgentInput {
  userMessage?: string;
  adminId: string;
  schoolId: string;
  conversationId?: string;
  newConversation?: boolean;
  refreshReadId?: string;
  nextReadPage?: boolean;
  language?: string;
  audioBase64?: string;
  audioMimeType?: string;
  imageBase64?: string;
  imageMimeType?: string;
  onStatusUpdate?: (status: { step: string; tool?: string }) => void | Promise<void>;
  onTranscription?: (transcription: string) => void | Promise<void>;
  onTokenDelta?: (delta: string) => void | Promise<void>;
  signal?: AbortSignal;
}

export interface MobileAgentResponse {
  success: boolean;
  conversationId: string;
  message: string;
  transcription?: string;
  analyzedDocument?: any;
  imageUrl?: string;
  pendingConfirmation?: ActionCardData | ActionCardData[] | null;
  executedTool?: string;
  evidence?: any;
  widget?: {
    type: "caisse" | "unpaid_tuition" | "pdf_receipt" | "finance_summary" | "student_card" | "attendance_card" | "action_card" | "school_records";
    data: any;
  } | null;
  followUpSuggestions?: string[];
  error?: string;
}

const VOICE_CANDIDATE_MODELS = [
  "gemini-3.5-transcribe",
  "gemini-3.5-flash-lite",
];

/**
 * Fast intent-based tool pruning dedicated for Mobile.
 * - Pure chitchat / greetings / general advice → 0 tools (instant ~350ms text generation).
 * - Focused school queries → relevant tools.
 * - Ambiguous queries / follow-ups (e.g. "Go", "Oui", "Fais-le") → top 16 universal tools so actions are never blocked.
 */
export function getMobileDeclarations(userMessage: string): any[] {
  const msg = (userMessage || "").trim();
  const msgLower = msg.toLowerCase();

  const CHITCHAT_REGEX = /^(bonjour|salut|ahla(?: bik)?|aslema|salam|coucou|hello|hi|merci|chokran|merci beaucoup|qui es-tu|who are you|what(?:'s| is) your name|qui est hnia|tu peux faire quoi|présente-toi|aide-moi|tu sers à quoi|chnwa esm(?:e)?k(?: enti)?|chneya esm(?:e)?k|bye|au revoir|bonne soirée|bonne journée)[\s!?.]*$/i;
  if (CHITCHAT_REGEX.test(msgLower)) {
    return [];
  }

  const derjaHints = [
    /(?:masrouf|sraf|chrina|chrit)/i.test(msg) ? "dépense" : "",
    /(?:khles|5las|flous|madakhil)/i.test(msg) ? "paiement finance" : "",
    /(?:mou3alem|m3alem)/i.test(msg) ? "enseignant" : "",
    /(?:talm|tlem|ya9raw|9esm)/i.test(msg) ? "élève classe" : "",
    /(?:8yeb|ghyeb)/i.test(msg) ? "absence" : "",
  ].filter(Boolean).join(" ");
  const declarations = getPrunedGeminiDeclarations(`${msg} ${derjaHints}`.trim());
  if (declarations.length <= 40) return declarations;

  // Unclassified mobile questions should not ship the full 100+ tool schema.
  // Keep the fallback read-only; mutation tools are exposed only when a clear
  // domain above is detected and still require an explicit confirmation card.
  const schoolIntent = /(?:écol|school|madr|mader|talm|tlem|ya9raw|9esm|classe|parent|weli|mou3alem|m3alem|prof|enseign|flous|caisse|khles|5las|paiement|absence|8yeb|planning|emploi)/i.test(msgLower);
  if (!schoolIntent) return [];
  const fallbackNames = new Set([
    "query_school_records", "get_school_stats", "get_morning_briefing",
    "get_students", "get_parents", "get_classes", "get_teachers",
    "get_attendance", "get_payments", "get_financial_summary",
    "get_incomes", "get_expenses", "get_daily_caisse",
  ]);
  return getGeminiFunctionDeclarations().filter((declaration) => fallbackNames.has(declaration.name));
}

/**
 * Strip Telegram-specific formatting (HTML tags, custom separators, code tags)
 * and convert to clean, mobile-optimized markdown.
 */

/**
 * Transcribe mobile audio recording (m4a, aac, wav, ogg) using Gemini multimodal audio.
 */
export async function transcribeMobileAudio(
  base64Audio: string,
  mimeType: string = "audio/m4a",
  signal?: AbortSignal
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Clé GEMINI_API_KEY manquante");

  const genAI = new GoogleGenerativeAI(apiKey);
  const prompt = `You are an ultra-fast, high-precision speech transcriber specialized in Tunisian Arabic (Derja / Tounsi) and French for school administration.
Transcribe the speaker's exact spoken words word-for-word in authentic script (Arabic script or accurate Latin phonetics).

TUNISIAN VOCABULARY & PHONETIC ANCHORS:
- Purchases & Expenses: chrina / chrit (شرينا / شريت = acheté), dabbouza me (دبوزة ماء), kes the (كاس تاي), 9ahwa (قهوة), kaskrout (كسكروت), gaz / mazout (غاز / مازوط / إيصانص), fourfour (فورفور), kra / kré (كراء), tabachir (طباشير), rames (أوراق).
- Actions: qayedli / sajjelli (قيدلي / سجللي = enregistre), 5allas / 5lass (خلاص / خلص = paiement), a3tini (أعطيني), choufli (شوفلي), chkoun (شكون), marqui (ماركي), a7seb (احسب).
- School: tlamdha (تلامذة), asatdha / m3almin (أساتذة / معلمين), 9esm (قسم), chhar (شهر), 8yeb (غياب), rtar (retard), caisse (كاسة), transport / car (كار / نقل), buvette (بيفات).
- Numbers & Monetary Units: alf (1 DT), 2 alaf (2 DT), 5 leff (5 DT), 10 leff / 10 alaf (10 DT), 20 alf (20 DT), 50 alf (50 DT), mya alf (100 DT), melyoun (1000 DT), zouj mleyen (2000 DT).

RULES:
1. Output ONLY the plain transcribed words.
2. Do NOT translate Tunisian dialect to French or standard Arabic. Keep the exact words spoken.
3. Do NOT output timestamps, SRT subtitle codes (e.g. 00:00.000 --> 00:01.000), or speaker labels.
4. If pure noise or silence, output an empty string.`;

  const cleanMime = (mimeType || "").toLowerCase();
  const normalizedMime = cleanMime.includes("m4a") || cleanMime.includes("mp4")
    ? "audio/mp4"
    : cleanMime.includes("aac")
    ? "audio/aac"
    : cleanMime.includes("wav")
    ? "audio/wav"
    : cleanMime.includes("ogg")
    ? "audio/ogg"
    : "audio/mp4";

  console.log(`[Mobile Voice] Starting transcription with ${base64Audio?.length || 0} base64 chars, mime: ${normalizedMime}`);

  const candidateModels = getAvailableModels(VOICE_CANDIDATE_MODELS);
  for (let modelIndex = 0; modelIndex < candidateModels.length; modelIndex++) {
    const modelName = candidateModels[modelIndex];
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 256,
        },
      });
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: normalizedMime,
          },
        },
        { text: prompt },
      ], { timeout: getHniaModelTimeoutMs(), signal });
      let text = "";
      try {
        text = result.response.text().trim();
      } catch (extractErr: any) {
        console.warn(`[Mobile Voice] Failed to extract text with ${modelName}:`, extractErr.message);
      }
      if (text) {
        // Clean any timestamp artifacts or subtitle tags
        text = text
          .replace(/\d{1,2}:\d{2}(?:\.\d{1,3})?\s*-->\s*\d{1,2}:\d{2}(?:\.\d{1,3})?/g, "")
          .replace(/^\d+\s*$/gm, "")
          .replace(/^["']|["']$/g, "")
          .trim();
      }
      if (text && !text.toUpperCase().includes("NO_SPEECH") && !text.toUpperCase().includes("EMPTY")) {
        markModelSuccess(modelName);
        console.log(`[Mobile Voice] Successfully transcribed with ${modelName}: "${text.slice(0, 60)}"`);
        return text;
      }
    } catch (err: any) {
      console.warn(`[Mobile Voice] Failed with ${modelName}:`, err.message);
      const retryable = isRetryableModelError(err);
      if (retryable) markModelFailure(modelName);
      if (!retryable || modelIndex === candidateModels.length - 1) break;
    }
  }
  return "";
}

export function generateSmartConversationTitle(userText: string, doc?: any): string {
  if (doc?.merchant || doc?.title) {
    return `Reçu ${doc.merchant || doc.title}`.slice(0, 35);
  }
  let clean = (userText || "").trim();

  // Strip technical document analysis tags and map them nicely
  if (clean.includes("[DOCUMENT ANALYSÉ]") || clean.includes("[DOCUMENT NUMÉRISÉ]")) {
    const lowerClean = clean.toLowerCase();
    if (lowerClean.includes("bordereau") || lowerClean.includes("bancaire")) return "Bordereau bancaire";
    if (lowerClean.includes("reçu") || lowerClean.includes("recu") || lowerClean.includes("paiement")) return "Reçu de paiement";
    if (lowerClean.includes("facture")) return "Facture scannée";
    if (lowerClean.includes("bulletin") || lowerClean.includes("note")) return "Relevé de notes";
    if (lowerClean.includes("dépense") || lowerClean.includes("depense")) return "Justificatif dépense";
    if (lowerClean.includes("chèque") || lowerClean.includes("cheque")) return "Chèque bancaire";
    return "Document analysé";
  }

  // Strip technical bracket tags like [SOMETHING] or markdown
  clean = clean.replace(/^\[.*?\]\s*/g, "").replace(/[#*_`]/g, "").trim();
  const lower = clean.toLowerCase();

  if (lower.includes("caisse") || lower.includes("recette") || lower.includes("bilan") || lower.includes("chiffre")) {
    return "Point de caisse & recettes";
  }
  if (lower.includes("impayé") || lower.includes("retard") || lower.includes("non payé")) {
    return "Suivi des impayés";
  }
  if (lower.includes("dépense") || lower.includes("facture") || lower.includes("achat")) {
    return "Enregistrement dépense";
  }
  if (lower.includes("absence") || lower.includes("présence") || lower.includes("appel")) {
    return "Suivi des présences";
  }
  if (lower.includes("emploi du temps") || lower.includes("planning") || lower.includes("séance") || lower.includes("cours")) {
    return "Emploi du temps";
  }
  if (lower.includes("élève") || lower.includes("inscrit") || lower.includes("classe")) {
    return "Gestion des élèves";
  }
  if (lower.includes("prof") || lower.includes("enseignant") || lower.includes("salaire")) {
    return "Gestion du personnel";
  }
  if (lower.includes("annonce") || lower.includes("message aux parents") || lower.includes("notification")) {
    return "Diffusion d'annonce";
  }
  if (lower.startsWith("🎙️") || lower.includes("note vocale")) {
    return "Note vocale";
  }
  if (lower.startsWith("📷") || lower.includes("justificatif")) {
    return "Analyse justificatif";
  }

  const simplified = clean
    .replace(/^(donne[- ]moi|montre[- ]moi|combien|peux[- ]tu|est[- ]ce que|ajoute|enregistre|vérifie|calcule|trouve|affiche)\s+/i, "")
    .replace(/[?!.:;]+$/g, "")
    .trim();

  if (simplified.length > 3) {
    return (simplified.charAt(0).toUpperCase() + simplified.slice(1)).slice(0, 35);
  }
  return "Discussion Hnia";
}

/**
 * Main agent runner for SnapSchool Mobile app requests.
 */
export async function runMobileAgent(input: MobileAgentInput): Promise<MobileAgentResponse> {
  const requestStartedAt = Date.now();
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      conversationId: input.conversationId || "",
      message: "⚠️ Clé GEMINI_API_KEY non configurée sur le serveur.",
      error: "MISSING_API_KEY",
    };
  }

  // 1. Parallel startup: fetch admin, transcribe audio (if provided), and load conversation
  const originalUserText = (input.userMessage || "").trim();

  if (input.audioBase64) {
    await input.onStatusUpdate?.({ step: "Transcription de votre message vocal..." });
  } else if (input.imageBase64) {
    await input.onStatusUpdate?.({ step: "Analyse du document / photo..." });
  } else {
    await input.onStatusUpdate?.({ step: "Analyse de votre demande..." });
  }

  const [admin, transcriptionResult, conversationLookup] = await Promise.all([
    prisma.admin.findFirst({
      where: { id: input.adminId, schoolId: input.schoolId },
      include: { School: true },
    }),
    input.audioBase64
      ? transcribeMobileAudio(input.audioBase64, input.audioMimeType, input.signal).catch((audioErr) => {
          console.error("[MobileAgent] Audio transcription error:", audioErr);
          return "";
        })
      : Promise.resolve(""),
    input.newConversation ? Promise.resolve(null) : input.conversationId
      ? prisma.aIConversation.findFirst({
          where: {
            id: input.conversationId,
            status: { not: "DELETED" },
            OR: [
              { adminId: input.adminId },
              { telegramAccount: { adminId: input.adminId } },
            ],
          },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 12,
            },
          },
        })
      : prisma.aIConversation.findFirst({
          where: {
            OR: [
              { adminId: input.adminId },
              { telegramAccount: { adminId: input.adminId } },
            ],
            status: { not: "DELETED" },
          },
          orderBy: { updatedAt: "desc" },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 16,
            },
          },
        }),
  ]);

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

  let transcription: string | undefined = transcriptionResult || undefined;
  if (transcription) {
    if (input.onTranscription) {
      try {
        await input.onTranscription(transcription);
      } catch {}
    }
    await input.onStatusUpdate?.({ step: "Hnia prépare votre action..." });
  }
  let effectiveUserMessage = originalUserText;
  if (transcription) {
    effectiveUserMessage = effectiveUserMessage
      ? `${effectiveUserMessage}\n${transcription}`
      : transcription;
  }
  let uploadedImageUrl: string | undefined;

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
        uploadedImageUrl = publicUrl;
        analyzedDoc.publicUrl = publicUrl;
      }

      if (analyzedDoc) {
        effectiveUserMessage = buildMobileImageMessage(effectiveUserMessage, analyzedDoc, publicUrl || undefined);
      }
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

  const intentMessage = input.imageBase64 ? [originalUserText, transcription].filter(Boolean).join('\n') : effectiveUserMessage;

  // 4. Resolve conversation (already fetched concurrently during parallel startup)
  let conversation: any = conversationLookup;

  let conversationId: string;
  let historyMessages: { role: string; content: string }[] = [];

  // Format clean user message for DB storage
  let userMessageForDB = originalUserText;
  if (input.imageBase64) {
    if (!userMessageForDB) {
      if (analyzedDoc?.merchant || analyzedDoc?.title) {
        userMessageForDB = `📷 ${analyzedDoc.merchant || analyzedDoc.title}${analyzedDoc.amount ? ` (${analyzedDoc.amount} DT)` : ""}`;
      } else {
        userMessageForDB = "📷 Justificatif / Document envoyé";
      }
    }
  }

  const savedUserContent = uploadedImageUrl
    ? `[IMAGE:${uploadedImageUrl}]\n${userMessageForDB}`
    : (userMessageForDB || effectiveUserMessage);

  if (conversation) {
    conversationId = conversation.id;
    historyMessages = [...conversation.messages].reverse();

    if (!conversation.adminId && input.adminId) {
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { adminId: input.adminId },
      }).catch(() => null);
    }

    // If conversation has a default placeholder title, update it with smart generated title
    if (!conversation.title || conversation.title === "Nouvelle discussion" || conversation.title === "Nouvelle conversation") {
      const smartTitle = generateSmartConversationTitle(transcription || userMessageForDB || effectiveUserMessage, analyzedDoc);
      await prisma.aIConversation.update({
        where: { id: conversationId },
        data: { title: smartTitle },
      }).catch(() => null);
    }
  } else {
    const smartTitle = generateSmartConversationTitle(transcription || userMessageForDB || effectiveUserMessage, analyzedDoc);
    const newConv = await prisma.aIConversation.create({
      data: {
        adminId: input.adminId,
        source: "mobile",
        status: "ACTIVE",
        title: smartTitle,
      },
    });
    conversationId = newConv.id;
  }

  // Save user message (await to ensure persistence before function completes)
  try {
    await prisma.aIMessage.create({
      data: {
        conversationId,
        role: "user",
        content: savedUserContent,
      },
    });

    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });
  } catch (saveErr) {
    console.warn("[MobileAgent] User message save failed:", saveErr);
  }

  // 5. Tool Context
  const context: ToolContext = {
    schoolId: input.schoolId,
    adminId: input.adminId,
    adminName,
    language: input.language || "fr",
  };

  // Resolve explicit purchases before general chat/history can select an unrelated read.
  // This path only creates a proposal; the expense tool runs exclusively in confirmMobileAction.
  const purchaseDraft = getPurchaseDraft(originalUserText || transcription || '', analyzedDoc, uploadedImageUrl, Boolean(input.imageBase64));
  if (purchaseDraft) {
    if (purchaseDraft.clarification) {
      await prisma.aIMessage.create({ data: { conversationId, role: 'assistant', content: purchaseDraft.clarification } });
      return { success: true, conversationId, message: purchaseDraft.clarification, imageUrl: uploadedImageUrl, transcription };
    }
    const args = prepareConfirmedArguments(TOOLS.add_expense, purchaseDraft.args);
    const proposal = await prisma.aIToolCall.create({ data: {
      conversationId, toolName: 'add_expense', arguments: args, status: 'PENDING', requiresConfirm: true,
    } });
    const card = buildActionCardMetadata(proposal.id, 'add_expense', args, 'Vérifiez les détails puis confirmez.');
    const message = 'Dépense proposée. Vérifiez le montant et les détails, puis appuyez sur Confirmer. Aucune dépense enregistrée pour le moment.';
    await prisma.aIMessage.create({ data: { conversationId, role: 'assistant', content: message, toolCallId: proposal.id } });
    return { success: true, conversationId, message, transcription, imageUrl: uploadedImageUrl,
      pendingConfirmation: card, widget: { type: 'action_card', data: card }, followUpSuggestions: [] };
  }

  // 6. Fast-path checks
  const msgLower = effectiveUserMessage.trim().toLowerCase();
  if (/^(bonjour|salut|ahla|salam|hello|hi)[\s!?.]*$/i.test(msgLower)) {
    const greeting = `👋 **Bonjour ${adminName} !**\n\nJe suis **Hnia**, votre assistante SnapSchool 🎓\nComment puis-je vous aider aujourd'hui ?`;
    await prisma.aIMessage.create({
      data: { conversationId, role: "assistant", content: greeting },
    });
    await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
    await input.onTokenDelta?.(greeting);
    return {
      success: true,
      conversationId,
      message: greeting,
      transcription,
      analyzedDocument: analyzedDoc,
      imageUrl: uploadedImageUrl,
      followUpSuggestions: ["Caisse du jour 💰", "Absences 📋", "Emploi du temps ⏰"],
    };
  }

  // Only exact, unambiguous shortcuts may bypass model parsing. Scoped questions use native tool arguments.
  let exactRead = getExactSchoolRead(intentMessage);
  if (input.refreshReadId) {
    const previous = await prisma.aIToolCall.findFirst({ where: { id: input.refreshReadId, conversationId, status: 'EXECUTED', requiresConfirm: false, toolName: { in: [...READ_ONLY_ACTIONS] } } });
    if (!previous) return { success: false, conversationId, message: 'Cette consultation ne peut pas être actualisée.', error: 'READ_NOT_FOUND' };
    if ((previous.result as any)?.scopeSchoolId && (previous.result as any).scopeSchoolId !== input.schoolId) return { success: false, conversationId, message: 'Cette consultation appartient à un autre établissement.', error: 'READ_NOT_FOUND' };
    exactRead = { name: previous.toolName, args: (previous.arguments as Record<string, any>) || {} };
    if (input.nextReadPage === true) {
      const result = previous.result as any;
      if (!Number.isInteger(result?.nextOffset) || result?.hasMore !== true) return { success: false, conversationId, message: 'Aucune page suivante pour cette consultation.', error: 'NO_NEXT_PAGE' };
      exactRead.args = { ...exactRead.args, offset: result.nextOffset };
    }
  }
  const verifying = isVerificationFollowup(intentMessage);
  if (!input.refreshReadId && (verifying || isNextPage(intentMessage))) {
    const previous = await prisma.aIToolCall.findFirst({
      where: { conversationId, status: "EXECUTED", requiresConfirm: false, toolName: { in: [...READ_ONLY_ACTIONS] } },
      orderBy: { createdAt: "desc" },
    });
    if (previous) {
      const args = { ...((previous.arguments as Record<string, any>) || {}) };
      if (isNextPage(intentMessage)) {
        const result = previous.result as any;
        if (result?.nextOffset === null || result?.hasMore === false) {
          const message = "La liste vérifiée est déjà complète pour ce filtre. Dites-moi si vous souhaitez consulter une autre classe.";
          await prisma.aIMessage.create({ data: { conversationId, role: "assistant", content: message } });
          return { success: true, conversationId, message };
        }
        if (typeof result?.nextOffset === "number") args.offset = result.nextOffset;
        else exactRead = null;
      }
      if (verifying || typeof (previous.result as any)?.nextOffset === "number") exactRead = { name: previous.toolName, args };
    } else if (verifying) {
      const message = "Je n'ai pas de consultation vérifiable à reprendre dans cette discussion. Précisez la classe ou les données à vérifier, par exemple « élèves de la classe 1A ».";
      await prisma.aIMessage.create({ data: { conversationId, role: "assistant", content: message } });
      return { success: true, conversationId, message };
    }
  }
  if (exactRead) {
    await input.onStatusUpdate?.({ step: verifying ? "Nouvelle vérification en base..." : "Consultation des données...", tool: exactRead.name });
    const fresh = await executeFreshSchoolRead(exactRead.name, exactRead.args, context, conversationId);
    const message = (verifying && fresh.success ? "**Nouvelle vérification en base effectuée.**\n\n" : "") + fresh.message;
    const presentation = buildReadPresentation(exactRead.name, exactRead.args, fresh.output, { schoolId: input.schoolId, schoolName }, fresh.toolCallId);
    if (presentation.evidence?.total !== null && presentation.evidence?.total !== undefined) await input.onStatusUpdate?.({ step: `${presentation.evidence.total} résultat(s) vérifié(s)`, tool: exactRead.name });
    await prisma.aIMessage.create({ data: { conversationId, role: "assistant", content: message, toolCallId: fresh.toolCallId } });
    return { success: true, conversationId, message, transcription, executedTool: exactRead.name, ...presentation, followUpSuggestions: [] };
  }

  // School notes are retrieved with citations when requested, never loaded as system instructions.
  const realClassNamesPromise = prisma.class.findMany({
    where: { schoolId: input.schoolId },
    select: { name: true },
    orderBy: { name: "asc" },
    take: 15,
  }).then((classes) => classes.map((item) => item.name)).catch(() => [] as string[]);
  const realClassNames = await realClassNamesPromise;

  const systemInstruction = buildMobileHniaSystemInstruction({
    schoolName,
    adminName,
    classNames: realClassNames,
  }) + `\nLANGUE DE CETTE CONVERSATION : ${input.language === 'ar' ? 'arabe tunisien clair' : input.language === 'en' ? 'English' : 'français'}. Respecte ce choix même si le message mélange plusieurs langues. Les montants, dates et confirmations restent explicites et professionnels.`;

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
  // Tool selection is based on the user's intent, never the vocabulary injected by vision.
  const declarations = getMobileDeclarations(intentMessage);
  const permittedToolNames = new Set(declarations.map(tool => tool.name));
  const typedAmounts = explicitCurrencyAmounts(originalUserText || transcription || '');
  const proposalArgs = (name: string, args: Record<string, any>) => freezeMobileActionArguments(name, name === 'add_expense' && typedAmounts.length === 1
    ? { ...args, amount: typedAmounts[0] } : args);
  const mayProposeAction = declarations.some(tool => requiresActionConfirmation(tool.name, TOOLS[tool.name]));
  const modelTimeoutMs = getHniaModelTimeoutMs();
  const candidateModels = getAvailableModels(getMobileHniaModels());

  let executedToolResults: Map<string, any> = new Map();

  for (let modelIndex = 0; modelIndex < candidateModels.length; modelIndex++) {
    const modelName = candidateModels[modelIndex];
    const modelStartedAt = Date.now();
    let streamedAnyToken = false;
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        safetySettings: [
          HarmCategory.HARM_CATEGORY_HARASSMENT,
          HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        ].map(category => ({ category, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE })),
        ...(declarations.length > 0
          ? {
              tools: [
                {
                  functionDeclarations: declarations,
                },
              ],
            }
          : {}),
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 2048,
        },
      });

      const chat = model.startChat({ history: historyContents });
      await input.onStatusUpdate?.({ step: "Recherche en cours..." });
      
      const requestOptions = { timeout: modelTimeoutMs, signal: input.signal };
      const sendMessage = async (parts: Parameters<typeof chat.sendMessage>[0]) => {
        if (!input.onTokenDelta) return chat.sendMessage(parts, requestOptions);
        const streamed = await chat.sendMessageStream(parts, requestOptions);
        for await (const chunk of streamed.stream) {
          const delta = chunk.text();
          if (delta && !mayProposeAction && !needsFreshSchoolData(intentMessage)) {
            streamedAnyToken = true;
            await input.onTokenDelta(delta);
          }
        }
        return { response: await streamed.response };
      };
      let response = await sendMessage([{ text: effectiveUserMessage }]);
      let candidate = response.response;

      let functionCalls = candidate.functionCalls();
      if (needsFreshSchoolData(intentMessage) && !functionCalls?.length) {
        const grounded = await sendMessage([{ text: "Cette question demande des données actuelles de l'école. Consulte obligatoirement un outil autorisé, en conservant la classe, les dates et les personnes demandées. Si le filtre est ambigu, demande une précision sans annoncer de chiffres." }]);
        candidate = grounded.response;
        functionCalls = candidate.functionCalls();
        if (!functionCalls?.length) {
          const message = "Je n'ai pas pu vérifier ces données en base. Précisez la classe, la personne ou la période à consulter pour obtenir un résultat vérifié.";
          await prisma.aIMessage.create({ data: { conversationId, role: "assistant", content: message } });
          return { success: true, conversationId, message };
        }
      }
      let lastExecutedTool: string | undefined;
      let finalReply: string | undefined;
      let pendingConfirmation: MobileAgentResponse["pendingConfirmation"] = null;
      let detectedWidget: MobileAgentResponse["widget"] = null;
      let evidence: any = null;
      let readToolCallId: string | undefined;

      const MAX_TOOL_ITERATIONS = 5;
      let iterations = 0;

      while (functionCalls && functionCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
        iterations++;
        if (functionCalls.some(call => !permittedToolNames.has(call.name))) {
          finalReply = "Je n'ai pas pu relier cette réponse à votre demande. Précisez l'opération souhaitée. Aucune modification effectuée.";
          break;
        }
        const call = functionCalls[0];
        const toolName = call.name;
        const toolArgs = (call.args || {}) as Record<string, any>;
        const toolDef = TOOLS[toolName];

        if (!toolDef) {
          console.warn(`[MobileAgent] Unknown tool call: ${toolName}`);
          let errResponse = await sendMessage([{
            functionResponse: {
              name: toolName,
              response: { error: true, message: `L'outil '${toolName}' n'existe pas. Utilisez un outil valide de la liste disponible.` }
            }
          }]);
          candidate = errResponse.response;
          functionCalls = candidate.functionCalls();
          continue;
        }

        const toolLabels: Record<string, string> = {
          get_daily_caisse: "Calcul de la caisse...",
          get_payments: "Vérification des paiements...",
          get_attendance: "Consultation des présences...",
          get_student_profile: "Recherche de la fiche élève...",
          get_teacher_profile: "Recherche de la fiche enseignant...",
          get_class_timetable: "Consultation de l'emploi du temps...",
          add_expense: "Préparation de la dépense...",
          record_payment: "Préparation de l'encaissement...",
          get_payment_receipt: "Génération de la quittance PDF...",
          mark_class_attendance: "Enregistrement de l'appel...",
          send_push_notification: "Préparation de la notification...",
          search_wikipedia: "Recherche d'informations...",
          teach_hnia: "Mémorisation de la consigne...",
          get_hnia_teachings: "Consultation de la mémoire...",
          get_financial_anomalies: "Analyse des finances...",
          get_school_stats: "Calcul des statistiques...",
        };
        const stepLabel = toolLabels[toolName] || `Exécution : ${toolName}...`;
        await input.onStatusUpdate?.({ step: stepLabel, tool: toolName });

        // Action requires confirmation
        if (functionCalls.some(c => TOOLS[c.name] && requiresActionConfirmation(c.name, TOOLS[c.name]))) {
          let pendingConfirmations: ActionCardData[] = [];
          for (const c of functionCalls) {
            const tName = c.name;
            const tArgs = proposalArgs(tName, (c.args || {}) as Record<string, any>);
            const tDef = TOOLS[tName];
            if (tDef && requiresActionConfirmation(tName, tDef)) {
              const toolCallRecord = await prisma.aIToolCall.create({
                data: {
                  conversationId,
                  toolName: tName,
                  arguments: tArgs,
                  status: "PENDING",
                  requiresConfirm: true,
                },
              });

              const rawConfirmText = tDef.formatConfirmationMessage
                ? await Promise.resolve(tDef.formatConfirmationMessage(tArgs, context))
                : `❓ Souhaitez-vous confirmer l'exécution de l'action **${tName}** ?`;
              const confirmText = cleanTelegramFormattingForMobile(rawConfirmText);

              const actionCard = buildActionCardMetadata(toolCallRecord.id, tName, tArgs, confirmText);
              pendingConfirmations.push(actionCard);
              await prisma.aIMessage.create({ data: {
                conversationId, role: "assistant", toolCallId: toolCallRecord.id,
                content: `Veuillez vérifier et confirmer l'action ci-dessous :\n\n${confirmText}`,
              } });
            }
          }

          const primaryCard = pendingConfirmations.length === 1 ? pendingConfirmations[0] : pendingConfirmations;
          pendingConfirmation = primaryCard as any;
          detectedWidget = {
            type: "action_card",
            data: primaryCard,
          };

          const firstCard = pendingConfirmations[0];
          const summaryDesc = firstCard?.fields?.map((f) => `• ${f.label} : **${f.value}**`).join("\n") || "";
          finalReply = summaryDesc
            ? `Veuillez vérifier et confirmer l'action ci-dessous :\n\n${summaryDesc}`
            : "Veuillez vérifier et confirmer l'action ci-dessous :";

          return {
            success: true,
            conversationId,
            message: finalReply,
            transcription,
            analyzedDocument: analyzedDoc,
            imageUrl: uploadedImageUrl,
            pendingConfirmation,
            widget: detectedWidget,
            followUpSuggestions: [],
          };
        }

        if (functionCalls.length > 1) {
          if (functionCalls.length > 10) {
            finalReply = "Cette demande comporte trop de consultations à la fois. Précisez les catégories prioritaires pour que je vérifie chaque résultat.";
            break;
          }
          const results = await Promise.all(functionCalls.map(c => executeFreshSchoolRead(c.name, (c.args || {}) as Record<string, any>, context, conversationId)));
          finalReply = results.map(result => result.message).join("\n\n---\n\n");
          evidence = { source: 'school_database', schoolId: input.schoolId, schoolName, reads: results.map((result, index) => buildReadPresentation(functionCalls![index].name, (functionCalls![index].args || {}) as any, result.output, { schoolId: input.schoolId, schoolName }, result.toolCallId).evidence).filter(Boolean), verified: results.every(result => result.success) };
          break;
        }

        // Read-only or instant tool
        lastExecutedTool = toolName;
        let toolOutput: any;
        const cacheKey = toolName + JSON.stringify(toolArgs);
        if (executedToolResults.has(cacheKey)) {
          toolOutput = executedToolResults.get(cacheKey);
        } else {
          const fresh = await executeFreshSchoolRead(toolName, toolArgs, context, conversationId);
          toolOutput = fresh.output;
          readToolCallId = fresh.toolCallId;
          const presentation = buildReadPresentation(toolName, toolArgs, toolOutput, { schoolId: input.schoolId, schoolName }, fresh.toolCallId);
          evidence = presentation.evidence;
          if (presentation.widget) detectedWidget = presentation.widget as any;
          if (fresh.success && evidence?.total !== null && evidence?.total !== undefined) await input.onStatusUpdate?.({ step: `${evidence.total} résultat(s) vérifié(s)`, tool: toolName });
          executedToolResults.set(cacheKey, toolOutput);
        }

        // Extract widget data if applicable
        if (toolName === "get_daily_caisse" && toolOutput?.summary) {
          const numIncomes = typeof toolOutput.summary?.totalIncomes === "number" ? toolOutput.summary.totalIncomes : parseFloat(String(toolOutput.summary?.totalIncomes || 0).replace(/[^0-9.-]/g, "")) || 0;
          const numExpenses = typeof toolOutput.summary?.totalExpenses === "number" ? toolOutput.summary.totalExpenses : parseFloat(String(toolOutput.summary?.totalExpenses || 0).replace(/[^0-9.-]/g, "")) || 0;
          const numNet = typeof toolOutput.summary?.netCashBalance === "number" ? toolOutput.summary.netCashBalance : parseFloat(String(toolOutput.summary?.netCashBalance || 0).replace(/[^0-9.-]/g, "")) || 0;

          detectedWidget = {
            type: "caisse",
            data: {
              date: toolOutput.date || new Date().toLocaleDateString("fr-FR"),
              totalIncomes: numIncomes,
              totalExpenses: numExpenses,
              netCashBalance: numNet,
              paymentsCount: toolOutput.summary?.paymentsCount || 0,
              expensesCount: toolOutput.summary?.expensesCount || 0,
            },
          };
        } else if (toolName === "get_financial_summary" && toolOutput) {
          detectedWidget = {
            type: "finance_summary",
            data: {
              period: toolOutput.periodFrench || toolOutput.period || "Mois en cours",
              totalRevenue: toolOutput.totalIncome || 0,
              totalExpenses: toolOutput.totalExpense || 0,
              netProfit: toolOutput.netProfit || 0,
              unpaidTuition: toolOutput.unpaidTuition || 0,
              unpaidStudentsCount: toolOutput.unpaidStudentsCount || 0,
            },
          };
        } else if ((toolName === "get_attendance" || toolName === "mark_class_attendance") && toolOutput) {
          detectedWidget = {
            type: "attendance_card",
            data: {
              date: toolOutput.date || new Date().toISOString().split("T")[0],
              className: toolOutput.className || "Toute l'école",
              attendanceRate: toolOutput.summary?.attendanceRate || toolOutput.attendanceRate || "Non disponible",
              totalEnrolled: toolOutput.totalEnrolled || toolOutput.summary?.totalInscrits || 0,
              presentCount: toolOutput.summary?.presentCount ?? toolOutput.presentCount ?? 0,
              absentCount: toolOutput.summary?.absentCount ?? toolOutput.absentCount ?? 0,
              lateCount: toolOutput.summary?.lateCount ?? toolOutput.lateCount ?? 0,
              absentStudents: (toolOutput.absentStudents || []).slice(0, 10),
            },
          };
        } else if ((toolName === "get_payments" || toolName === "get_financial_anomalies") && (toolOutput?.records || toolOutput?.unpaidStudents)) {
          const records = toolOutput.records || toolOutput.unpaidStudents || [];
          if (records.length > 0) {
            detectedWidget = {
              type: "unpaid_tuition",
              data: {
                totalOutstanding: toolOutput.totalOutstanding || 0,
                unpaidCount: toolOutput.unpaidCount || records.length,
                students: records.map((r: any) => ({
                  studentId: r.studentId || r.id,
                  studentName: r.studentName || `${r.name || ""} ${r.surname || ""}`.trim(),
                  className: r.class || r.className,
                  dueAmount: r.dueAmount ?? r.tuitionFee ?? 0,
                  parentName: r.parentName,
                  parentPhone: r.parentPhone,
                  feePeriod: r.feePeriod,
                  status: r.status || "UNPAID",
                })),
              },
            };
          }
        } else if (toolName === "get_payment_receipt" && toolOutput?.data) {
          detectedWidget = {
            type: "pdf_receipt",
            data: toolOutput.data,
          };
        }

        finalReply = formatSchoolRead(toolName, toolOutput);
        break;
      }

    if (!finalReply && needsFreshSchoolData(intentMessage)) {
        finalReply = "Je n’ai pas obtenu de données vérifiées pour cette demande. Précisez le filtre ou réessayez la consultation.";
      }

    if (!finalReply) {
        try {
          const rawText = candidate.text() || "Désolé, une erreur s'est produite. Pourriez-vous reformuler votre demande ?";

          // Safety interceptor: If the model generated raw JSON for an action instead of calling a tool natively
          const jsonActionMatch =
            rawText.match(/```(?:json)?\s*(\{[\s\S]*?"action"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*?\})\s*```/) ||
            rawText.match(/(\{[\s\S]*?"action"\s*:\s*"([a-zA-Z0-9_]+)"\s*,\s*"payload"\s*:\s*\{[\s\S]*?\}\s*\})/);

          if (jsonActionMatch) {
            try {
              const parsed = JSON.parse(jsonActionMatch[1]);
              const toolName = parsed.action;
              const payload = parsed.payload || {};

              const toolArgs: Record<string, any> = proposalArgs(toolName, { ...payload });
              if (payload.first_name && !toolArgs.name) toolArgs.name = payload.first_name;
              if (payload.last_name && !toolArgs.surname) toolArgs.surname = payload.last_name;
              if (payload.class_name && !toolArgs.className) toolArgs.className = payload.class_name;
              if (payload.parent_phone && !toolArgs.parentPhone) toolArgs.parentPhone = payload.parent_phone;
              if (payload.parent_name && !toolArgs.parentName) toolArgs.parentName = payload.parent_name;

              const toolDef = TOOLS[toolName];
              if (toolDef && permittedToolNames.has(toolName) && requiresActionConfirmation(toolName, toolDef)) {
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

                const actionCard = buildActionCardMetadata(toolCallRecord.id, toolName, toolArgs, confirmText);
                pendingConfirmation = actionCard;
                detectedWidget = {
                  type: "action_card",
                  data: actionCard,
                };

                // Strip the JSON block completely from the displayed message
                finalReply = "Veuillez vérifier les détails puis appuyer sur Confirmer pour exécuter cette action.";
              } else {
                finalReply = cleanTelegramFormattingForMobile(rawText.replace(jsonActionMatch[0], "").trim() || rawText);
              }
            } catch (jsonErr) {
              console.warn("[MobileAgent] JSON action parsing error:", jsonErr);
              finalReply = cleanTelegramFormattingForMobile(rawText);
            }
          } else {
            finalReply = cleanTelegramFormattingForMobile(rawText);
          }
        } catch {
          finalReply = "Désolé, une erreur s'est produite. Pourriez-vous reformuler votre demande ?";
        }
      }

      await input.onStatusUpdate?.({ step: "Terminé" });

      // Save assistant reply
      await prisma.aIMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: finalReply,
          ...(pendingConfirmation && !Array.isArray(pendingConfirmation) ? { toolCallId: pendingConfirmation.toolCallId } : {}),
          ...(readToolCallId ? { toolCallId: readToolCallId } : {}),
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

      markModelSuccess(modelName);
      console.info("[MobileAgent] completed", {
        model: modelName,
        durationMs: Date.now() - requestStartedAt,
        modelDurationMs: Date.now() - modelStartedAt,
        toolCount: declarations.length,
        executedTool: lastExecutedTool || null,
      });
      return {
        success: true,
        conversationId,
        message: finalReply,
        transcription,
        analyzedDocument: analyzedDoc,
        imageUrl: uploadedImageUrl,
        pendingConfirmation: pendingConfirmation || null,
        executedTool: lastExecutedTool,
        evidence,
        widget: detectedWidget,
        followUpSuggestions: suggestions,
      };
    } catch (modelErr: any) {
      const retryable = isRetryableModelError(modelErr);
      if (retryable) markModelFailure(modelName);
      console.warn(`[MobileAgent] Model ${modelName} error`, {
        message: modelErr?.message,
        status: modelErr?.status,
        retryable,
        durationMs: Date.now() - modelStartedAt,
      });
      if (!retryable || streamedAnyToken || modelIndex === candidateModels.length - 1) break;
    }
  }

  return {
    success: false,
    conversationId: conversationId || "",
    message: "Désolée, une erreur temporaire est survenue. Veuillez réessayer dans quelques instants.",
    error: "AI_GENERATION_FAILED",
  };
}
