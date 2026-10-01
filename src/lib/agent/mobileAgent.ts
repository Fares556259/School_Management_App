import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { TOOLS, getPrunedGeminiDeclarations } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { getCachedKnowledge, setCachedKnowledge } from "@/lib/telegram/agent";
import { buildMobileHniaSystemInstruction } from "./hniaPrompt";
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
  onStatusUpdate?: (status: { step: string; tool?: string }) => void | Promise<void>;
  onTokenDelta?: (delta: string) => void | Promise<void>;
}

export interface ActionCardField {
  label: string;
  value: string;
  icon?: string;
}

export interface ActionCardData {
  toolCallId: string;
  toolName: string;
  actionTitle: string;
  actionType: "expense" | "payment" | "student" | "class" | "attendance" | "announcement" | "generic";
  confirmText: string;
  fields: ActionCardField[];
  status: "PENDING" | "EXECUTING" | "EXECUTED" | "REJECTED";
  reference?: string;
  resultMessage?: string;
  arguments?: Record<string, any>;
}

export interface MobileAgentResponse {
  success: boolean;
  conversationId: string;
  message: string;
  transcription?: string;
  analyzedDocument?: any;
  imageUrl?: string;
  pendingConfirmation?: ActionCardData | null;
  executedTool?: string;
  widget?: {
    type: "caisse" | "unpaid_tuition" | "pdf_receipt" | "finance_summary" | "student_card" | "attendance_card" | "action_card";
    data: any;
  } | null;
  followUpSuggestions?: string[];
  error?: string;
}

export function buildActionCardMetadata(
  toolCallId: string,
  toolName: string,
  args: Record<string, any>,
  confirmText: string
): ActionCardData {
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (toolName === "add_expense") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Ajouter une dépense",
      actionType: "expense",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Montant", value: `${args.amount || 0} DT` },
        { label: "Catégorie", value: args.category || "Général" },
        { label: "Description", value: args.title || args.description || "Facture / Dépense" },
        { label: "Date", value: args.date || today },
      ],
    };
  }

  if (toolName === "record_payment" || toolName === "record_parent_payment") {
    const studentOrParent = args.studentNameOrId || args.parentNameOrId || "Élève";
    return {
      toolCallId,
      toolName,
      actionTitle: "Encaisser un paiement",
      actionType: "payment",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Montant", value: `${args.amount || 0} DT` },
        { label: "Bénéficiaire", value: studentOrParent },
        { label: "Période", value: args.feePeriod || new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) },
        { label: "Mode de règlement", value: args.paymentMethod || "Espèces" },
      ],
    };
  }

  if (toolName === "create_student") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Inscrire un nouvel élève",
      actionType: "student",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Nom & Prénom", value: `${args.name || ""} ${args.surname || ""}`.trim() || "Nouvel élève" },
        { label: "Classe", value: args.className || "Non assignée" },
        { label: "Contact Parent", value: args.parentPhone || args.parentName || "Non renseigné" },
        { label: "Frais mensuels", value: args.customTuition ? `${args.customTuition} DT` : "Standard" },
      ],
    };
  }

  if (toolName === "create_class") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Créer une nouvelle classe",
      actionType: "class",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Nom de la classe", value: args.name || "Nouvelle classe" },
        { label: "Niveau", value: args.levelNumber ? `Niveau ${args.levelNumber}` : "Standard" },
        { label: "Capacité maximale", value: args.capacity ? `${args.capacity} élèves` : "30 élèves" },
      ],
    };
  }

  if (toolName === "mark_class_attendance") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Valider l'appel de classe",
      actionType: "attendance",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Classe", value: args.className || "Classe" },
        { label: "Date de l'appel", value: args.date || today },
        { label: "Absents signalés", value: args.absentNames ? (Array.isArray(args.absentNames) ? args.absentNames.join(", ") : String(args.absentNames)) : "Aucun (Tous présents)" },
      ],
    };
  }

  if (toolName === "post_announcement" || toolName === "send_push_notification") {
    return {
      toolCallId,
      toolName,
      actionTitle: "Diffuser une annonce aux parents",
      actionType: "announcement",
      confirmText,
      status: "PENDING",
      arguments: args,
      fields: [
        { label: "Destinataires", value: args.className ? `Classe ${args.className}` : "Toute l'école" },
        { label: "Titre de l'annonce", value: args.title || "Annonce" },
        { label: "Contenu", value: args.message || args.content || "" },
      ],
    };
  }

  return {
    toolCallId,
    toolName,
    actionTitle: `Confirmer l'action : ${toolName}`,
    actionType: "generic",
    confirmText,
    status: "PENDING",
    arguments: args,
    fields: Object.entries(args)
      .filter(([k]) => !k.startsWith("_") && k !== "schoolId" && k !== "adminId")
      .map(([k, v]) => ({ label: k, value: String(v) })),
  };
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

const VOICE_CANDIDATE_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
];

/**
 * Fast intent-based tool pruning dedicated for Mobile.
 * - Pure chitchat / greetings / general advice → 0 tools (instant ~350ms text generation).
 * - Focused school queries → relevant tools.
 * - Ambiguous queries / follow-ups (e.g. "Go", "Oui", "Fais-le") → top 16 universal tools so actions are never blocked.
 */
function getMobileDeclarations(userMessage: string): any[] {
  const msg = (userMessage || "").trim();
  const msgLower = msg.toLowerCase();

  const CHITCHAT_REGEX = /^(bonjour|salut|ahla|salam|coucou|hello|hi|merci|chokran|merci beaucoup|qui es-tu|qui est hnia|tu peux faire quoi|présente-toi|aide-moi|tu sers à quoi|bye|au revoir|bonne soirée|bonne journée)[\s!?.]*$/i;
  if (CHITCHAT_REGEX.test(msgLower)) {
    return [];
  }

  const declarations = getPrunedGeminiDeclarations(msg);
  if (declarations.length > 25) {
    const UNIVERSAL_KEYS = new Set([
      "get_school_stats",
      "get_daily_caisse",
      "get_financial_summary",
      "get_payments",
      "record_parent_payment",
      "record_payment",
      "add_expense",
      "get_attendance",
      "mark_class_attendance",
      "get_student_profile",
      "get_students",
      "create_student",
      "create_class",
      "post_announcement",
      "send_payment_reminders",
      "get_class_timetable",
    ]);
    return declarations.filter((d: any) => UNIVERSAL_KEYS.has(d.name));
  }

  return declarations;
}

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
  // Move colons outside bold tags so key-value splitting does not break formatting:
  // e.g. <b>Montant :</b> -> <b>Montant</b> :
  clean = clean.replace(/<b(?: [^>]*)?>([^<:]+)\s*:\s*<\/b>/gi, "<b>$1</b> :");
  // Convert HTML bold to markdown bold
  clean = clean.replace(/<\/?(?:b|strong)>/gi, "**");
  // Fix markdown bold containing colons: **Montant :** -> **Montant** :
  clean = clean.replace(/\*\*([^*\n:]+)\s*:\s*\*\*/g, "**$1** :");
  // Convert HTML italic to markdown italic
  clean = clean.replace(/<\/?(?:i|em)>/gi, "*");
  // Convert <code>...</code> to markdown backticks `...`
  clean = clean.replace(/<code>(.*?)<\/code>/gi, "`$1`");
  clean = clean.replace(/<\/?code>/gi, "");
  // Convert blockquote to markdown blockquote
  clean = clean.replace(/<blockquote>([\s\S]*?)<\/blockquote>/gi, "> $1\n");
  // Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, "");
  // Fix mismatched asterisks like *Word** -> **Word** or **Word* -> **Word**
  clean = clean.replace(/(^|\s)\*([^*\s][^*]*?)\*\*(?=\s|$|[.,!?;:])/g, "$1**$2**");
  clean = clean.replace(/(^|\s)\*\*([^*\s][^*]*?)\*(?=\s|$|[.,!?;:])/g, "$1**$2**");
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

  const normalizedMime = mimeType?.toLowerCase().includes("m4a")
    ? "audio/mp4"
    : mimeType?.toLowerCase().includes("aac")
    ? "audio/aac"
    : mimeType?.toLowerCase().includes("wav")
    ? "audio/wav"
    : "audio/mp4";

  for (const modelName of VOICE_CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: normalizedMime,
          },
        },
        { text: prompt },
      ]);
      const text = result.response.text().trim();
      if (text) {
        console.log(`[Mobile Voice] Successfully transcribed with ${modelName}: "${text.slice(0, 40)}"`);
        return text;
      }
    } catch (err: any) {
      console.warn(`[Mobile Voice] Failed with ${modelName}:`, err.message);
    }
  }
  return "";
}

export function generateSmartConversationTitle(userText: string, doc?: any): string {
  if (doc?.merchant || doc?.title) {
    return `Reçu ${doc.merchant || doc.title}`.slice(0, 35);
  }
  const clean = (userText || "").trim();
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
    prisma.admin.findUnique({
      where: { id: input.adminId },
      include: { School: true },
    }),
    input.audioBase64
      ? transcribeMobileAudio(input.audioBase64, input.audioMimeType).catch((audioErr) => {
          console.error("[MobileAgent] Audio transcription error:", audioErr);
          return "";
        })
      : Promise.resolve(""),
    input.conversationId
      ? prisma.aIConversation.findUnique({
          where: { id: input.conversationId },
          include: {
            messages: {
              orderBy: { createdAt: "desc" },
              take: 12,
            },
          },
        })
      : prisma.aIConversation.findFirst({
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
        const photoUrl = publicUrl || "";
        const docDescriptor = `[DOCUMENT NUMÉRISÉ REÇU PAR PHOTO]
- Type détecté : ${analyzedDoc.documentType}
- Titre / Enseigne : ${analyzedDoc.title || analyzedDoc.merchant || "Non spécifié"}
- Montant extrait : ${analyzedDoc.amount !== undefined ? `${analyzedDoc.amount} DT` : "Non spécifié"}
- Date du document : ${analyzedDoc.date || "Non spécifiée"}
- Catégorie : ${analyzedDoc.category || "Général"}
- Personne concernée : ${analyzedDoc.studentName || analyzedDoc.parentName || analyzedDoc.personName || "Non spécifié"}
${analyzedDoc.bankName ? `- Banque : ${analyzedDoc.bankName}\n` : ""}${analyzedDoc.chequeNumber ? `- N° Chèque : ${analyzedDoc.chequeNumber}\n` : ""}${analyzedDoc.className ? `- Classe : ${analyzedDoc.className}\n` : ""}${analyzedDoc.sessionName ? `- Séance : ${analyzedDoc.sessionName}\n` : ""}- Résumé visuel : ${analyzedDoc.summary}
${photoUrl ? `- Justificatif (URL image) : ${photoUrl}` : ""}`;

        if (!effectiveUserMessage || effectiveUserMessage.trim().length === 0) {
          if (analyzedDoc.documentType === "EXPENSE_RECEIPT") {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé la photo de ce ticket de caisse / reçu sans texte d'accompagnement.
Agis directement :
Appelle immédiatement l'outil 'add_expense' avec :
- title: "${analyzedDoc.merchant || analyzedDoc.title || "Dépense"}"
- amount: ${analyzedDoc.amount || 0}
- category: "${analyzedDoc.category || "Général"}"
- date: "${analyzedDoc.date || new Date().toISOString().split("T")[0]}"
- img: "${photoUrl}"
(Cela générera directement la carte interactive de confirmation d'enregistrement de la dépense).`;
          } else if (analyzedDoc.documentType === "PAYMENT_RECEIPT") {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé un reçu de paiement / virement bancaire pour des frais scolaires.
${analyzedDoc.studentName ? `Élève identifié : ${analyzedDoc.studentName}.` : "Élève à identifier."}
${analyzedDoc.amount ? `Montant : ${analyzedDoc.amount} DT.` : ""}
Propose d'enregistrer le paiement de scolarité via 'record_payment' avec ce justificatif.`;
          } else if (analyzedDoc.documentType === "BANK_CHEQUE") {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé la photo d'un chèque bancaire pour le règlement de frais scolaires.
- Banque : ${analyzedDoc.bankName || "Banque"}
- Numéro de chèque : ${analyzedDoc.chequeNumber || "Non spécifié"}
- Montant : ${analyzedDoc.amount ? `${analyzedDoc.amount} DT` : "À préciser"}
${analyzedDoc.studentName ? `- Élève annoté : ${analyzedDoc.studentName}` : ""}
${analyzedDoc.parentName ? `- Émetteur / Parent : ${analyzedDoc.parentName}` : ""}
Propose d'enregistrer le paiement via 'record_payment'.`;
          } else if (analyzedDoc.documentType === "ATTENDANCE_SHEET") {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé la photo d'une feuille d'appel papier de classe.
- Classe : "${analyzedDoc.className || "À préciser"}"
- Séance : "${analyzedDoc.sessionName || "Séance du jour"}"
Propose d'enregistrer l'appel via 'mark_class_attendance'.`;
          } else if (analyzedDoc.documentType === "PROFILE_PHOTO") {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé une photo de profil / identité.
${analyzedDoc.personName ? `Propose d'attribuer cette photo à "${analyzedDoc.personName}" via 'update_person_photo'.` : `Demande à qui attribuer cette photo de profil.`}`;
          } else {
            effectiveUserMessage = `${docDescriptor}

L'administrateur a envoyé cette photo : "${analyzedDoc.summary}".
Présente brièvement ce qui a été détecté et demande ce qu'il souhaite faire.`;
          }
        } else {
          effectiveUserMessage = `${docDescriptor}

Message / Consigne de l'administrateur : "${effectiveUserMessage}"

Instructions :
- Applique directement la consigne de l'administrateur en utilisant les informations extraites de l'image (montant: ${analyzedDoc.amount || 0} DT, date: "${analyzedDoc.date || ""}", enseigne: "${analyzedDoc.merchant || analyzedDoc.title || ""}", justificatif: "${photoUrl}").
- Si l'administrateur mentionne un achat, une dépense ou un reçu ("chrina", "acheté", "dépense", "reçu", "ajoute"), appelle directement 'add_expense' avec le montant et l'intitulé extraits !`;
        }
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
    language: "fr",
  };

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

  // ── FAST-PATHS for instant response (< 100ms) on common school operations ──
  const IMPAYES_REGEX = /(impayés?|non payé|reliquat|qui n'a pas payé|qui doit|شكون ما خلصش|dettes?)/i;
  const CAISSE_REGEX = /(caiss[ez]?|caisse du jour|clôture de caisse|bilan de caisse|كاسة|point de caisse|bordereau.*caisse|journal de caisse|bordereau)/i;
  const RECEIPT_REGEX = /(reçu|quittance|bulletin de paie|facture de scolarité|reçu de paiement)/i;
  const ABSENCES_REGEX = /(absences? du jour|qui est absent|absents? aujourd'hui|شكون غايب|appel du jour)/i;
  const STATS_REGEX = /(effectifs?|stats? école|statistiques? école)/i;
  const REVENUE_REGEX = /(revenus?|chiffre d'affaires?|recettes? du mois|revenus? de ce mois|combien on a gagné|combien gagné|total des recettes|rentrées?)/i;

  if (REVENUE_REGEX.test(msgLower)) {
    await input.onStatusUpdate?.({ step: "Calcul des revenus du mois...", tool: "get_financial_summary" });
    try {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1);
      const endOfCurrentMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

      const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
      const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
      const startOfPrevMonth = new Date(prevYear, prevMonth - 1, 1);
      const endOfPrevMonth = new Date(prevYear, prevMonth, 0, 23, 59, 59);

      const [currIncomes, prevIncomes, currExpenses] = await Promise.all([
        prisma.payment.aggregate({
          where: {
            schoolId: context.schoolId,
            month: currentMonth,
            year: currentYear,
            status: "PAID",
            userType: "STUDENT",
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.payment.aggregate({
          where: {
            schoolId: context.schoolId,
            month: prevMonth,
            year: prevYear,
            status: "PAID",
            userType: "STUDENT",
          },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: {
            schoolId: context.schoolId,
            date: { gte: startOfCurrentMonth, lte: endOfCurrentMonth },
          },
          _sum: { amount: true },
        }),
      ]);

      const totalRevenue = currIncomes?._sum?.amount || 0;
      const prevRevenue = prevIncomes?._sum?.amount || 0;
      const totalExpenses = currExpenses?._sum?.amount || 0;
      const netProfit = totalRevenue - totalExpenses;
      const paymentsCount = currIncomes?._count?._all || 0;

      const trendPercent =
        prevRevenue > 0
          ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 1000) / 10
          : 0;
      const trendSymbol = trendPercent >= 0 ? `↑ +${trendPercent}%` : `↓ ${trendPercent}%`;

      const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const prevMonthName = new Date(prevYear, prevMonth - 1, 1).toLocaleDateString("fr-FR", { month: "long" });

      const cleanMsg =
        `💰 **Revenus du mois (${monthName}) :**\n\n` +
        `• **Recettes :** \`${totalRevenue} DT\` (${trendSymbol} vs ${prevMonthName})\n` +
        `• **Dépenses :** \`${totalExpenses} DT\`\n` +
        `• **Résultat net :** **\`${netProfit} DT\`**\n\n` +
        `📊 *${paymentsCount} règlements enregistrés ce mois-ci.*`;

      await prisma.aIMessage.create({
        data: { conversationId, role: "assistant", content: cleanMsg },
      });

      await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
      await input.onTokenDelta?.(cleanMsg);

      return {
        success: true,
        conversationId,
        message: cleanMsg,
        transcription,
        analyzedDocument: analyzedDoc,
        imageUrl: uploadedImageUrl,
        executedTool: "get_financial_summary",
        widget: {
          type: "finance_summary",
          data: {
            period: monthName,
            totalRevenue,
            totalExpenses,
            netProfit,
            trendPercent,
            paymentsCount,
            comparisonText: `vs ${prevMonthName}`,
          },
        },
        followUpSuggestions: ["Caisse du jour 💰", "Impayés du mois 💳", "Dépenses 💸"],
      };
    } catch (e) {
      console.warn("[MobileAgent] Fast-path revenue error:", e);
    }
  }

  if (IMPAYES_REGEX.test(msgLower)) {
    await input.onStatusUpdate?.({ step: "Vérification des impayés...", tool: "get_payments" });
    try {
      const { getPaymentsTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getPaymentsTool({ status: "UNPAID" }, context)) as any;
      if (out?.formattedText || out?.records) {
        const count = out.unpaidCount || (out.records ? out.records.length : 0);
        const total = out.totalOutstanding ? ` pour un total de **\`${out.totalOutstanding} DT\`**` : "";
        const list = (out.records || []).slice(0, 8).map((r: any) =>
          `• **${r.studentName}** (${r.class}) — \`${r.dueAmount} DT\` *(${r.feePeriod || ""})*`
        ).join("\n");
        const cleanMsg = `💳 **Suivi des impayés :** ${count} élève(s)${total} :\n\n${list}${count > 8 ? `\n\n*... et ${count - 8} autre(s) élève(s).*` : ""}`;

        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });

        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
        await input.onTokenDelta?.(cleanMsg);

        const students = (out.records || []).map((r: any) => ({
          studentId: r.studentId,
          studentName: r.studentName,
          className: r.class,
          dueAmount: r.dueAmount,
          parentName: r.parentName,
          parentPhone: r.parentPhone,
          feePeriod: r.feePeriod,
          status: r.status,
        }));

        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          imageUrl: uploadedImageUrl,
          executedTool: "get_payments",
          widget: {
            type: "unpaid_tuition",
            data: {
              totalOutstanding: out.totalOutstanding || 0,
              unpaidCount: out.unpaidCount || (out.records ? out.records.length : 0),
              students,
            },
          },
          followUpSuggestions: ["Caisse du jour 💰", "Absences 📋", "Planning ⏰"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path impayes error:", e);
    }
  }

  if (CAISSE_REGEX.test(msgLower)) {
    await input.onStatusUpdate?.({ step: "Calcul de la caisse du jour...", tool: "get_daily_caisse" });
    try {
      const { getDailyCaisseTool } = await import("@/lib/telegram/tools/financeTools");
      const out = (await getDailyCaisseTool({ date: "today" }, context)) as any;
      if (out?.summary || out?.formattedText) {
        const numIncomes = typeof out.summary?.totalIncomes === "number" ? out.summary.totalIncomes : parseFloat(String(out.summary?.totalIncomes || 0).replace(/[^0-9.-]/g, "")) || 0;
        const numExpenses = typeof out.summary?.totalExpenses === "number" ? out.summary.totalExpenses : parseFloat(String(out.summary?.totalExpenses || 0).replace(/[^0-9.-]/g, "")) || 0;
        const numNet = typeof out.summary?.netCashBalance === "number" ? out.summary.netCashBalance : parseFloat(String(out.summary?.netCashBalance || 0).replace(/[^0-9.-]/g, "")) || 0;

        const cleanMsg = `💰 **Point de caisse d'aujourd'hui (${out.date || "ce jour"}) :**\n\n` +
          `• **Recettes :** \`${numIncomes} DT\` (${out.summary?.paymentsCount || 0} règlements)\n` +
          `• **Dépenses :** \`${numExpenses} DT\` (${out.summary?.expensesCount || 0} sorties)\n` +
          `• **Solde net en caisse :** **\`${numNet} DT\`**` +
          (out.summary?.absencesCount !== undefined ? `\n\n📋 **Absences du jour :** ${out.summary.absencesCount} élève(s)` : "");

        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });

        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
        await input.onTokenDelta?.(cleanMsg);

        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          imageUrl: uploadedImageUrl,
          executedTool: "get_daily_caisse",
          widget: {
            type: "caisse",
            data: {
              date: out.date || new Date().toLocaleDateString("fr-FR"),
              totalIncomes: numIncomes,
              totalExpenses: numExpenses,
              netCashBalance: numNet,
              paymentsCount: out.summary?.paymentsCount || 0,
              expensesCount: out.summary?.expensesCount || 0,
            },
          },
          followUpSuggestions: ["Impayés du mois 💳", "Absences 📋", "Dépenses 💸"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path caisse error:", e);
    }
  }

  if (RECEIPT_REGEX.test(msgLower) && !msgLower.includes("dépense") && !msgLower.includes("depense")) {
    await input.onStatusUpdate?.({ step: "Génération de la quittance PDF...", tool: "get_payment_receipt" });
    try {
      const { getPaymentReceiptTool } = await import("@/lib/telegram/tools/documentTools");
      const cleanTarget = effectiveUserMessage
        .replace(/(génère|donne|crée|imprime|télécharge|telecharge|le|reçu|quittance|facture|de|paiement|pour|svp|merci|\bDT\b|\d+)/gi, " ")
        .trim();
      const out = (await getPaymentReceiptTool({ studentNameOrId: cleanTarget || effectiveUserMessage }, context)) as any;
      if (out?.success && out?.data) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.message);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });

        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
        await input.onTokenDelta?.(cleanMsg);

        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          imageUrl: uploadedImageUrl,
          executedTool: "get_payment_receipt",
          widget: {
            type: "pdf_receipt",
            data: out.data,
          },
          followUpSuggestions: ["Caisse du jour 💰", "Impayés du mois 💳", "Absences 📋"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path receipt error:", e);
    }
  }

  if (ABSENCES_REGEX.test(msgLower)) {
    await input.onStatusUpdate?.({ step: "Consultation des absences du jour...", tool: "get_attendance" });
    try {
      const { getAttendanceTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getAttendanceTool({}, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });

        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
        await input.onTokenDelta?.(cleanMsg);

        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          imageUrl: uploadedImageUrl,
          executedTool: "get_attendance",
          followUpSuggestions: ["Notifier les parents 📢", "Caisse du jour 💰", "Emploi du temps ⏰"],
        };
      }
    } catch (e) {
      console.warn("[MobileAgent] Fast-path absences error:", e);
    }
  }

  if (STATS_REGEX.test(msgLower)) {
    await input.onStatusUpdate?.({ step: "Calcul des statistiques scolaires...", tool: "get_school_stats" });
    try {
      const { getSchoolStatsTool } = await import("@/lib/telegram/tools/readTools");
      const out = (await getSchoolStatsTool({}, context)) as any;
      if (out?.formattedText) {
        const cleanMsg = cleanTelegramFormattingForMobile(out.formattedText);
        await prisma.aIMessage.create({
          data: { conversationId, role: "assistant", content: cleanMsg },
        });

        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
        await input.onTokenDelta?.(cleanMsg);

        return {
          success: true,
          conversationId,
          message: cleanMsg,
          transcription,
          analyzedDocument: analyzedDoc,
          imageUrl: uploadedImageUrl,
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

  // 8. Build System Instruction (ultra-lean 2KB mobile version for sub-second responses)
  const systemInstruction = buildMobileHniaSystemInstruction({
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
  const declarations = getMobileDeclarations(effectiveUserMessage);

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
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
      let response = await chat.sendMessage([{ text: effectiveUserMessage }]);
      let candidate = response.response;

      let functionCalls = candidate.functionCalls();
      let lastExecutedTool: string | undefined;
      let finalReply: string | undefined;
      let pendingConfirmation: MobileAgentResponse["pendingConfirmation"] = null;
      let detectedWidget: MobileAgentResponse["widget"] = null;

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

          const actionCard = buildActionCardMetadata(toolCallRecord.id, toolName, toolArgs, confirmText);
          pendingConfirmation = actionCard;
          detectedWidget = {
            type: "action_card",
            data: actionCard,
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
            imageUrl: uploadedImageUrl,
            pendingConfirmation,
            executedTool: toolName,
            widget: detectedWidget,
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
              trendPercent: toolOutput.marginPercentage || 0,
              unpaidTuition: toolOutput.unpaidTuition || 0,
              unpaidStudentsCount: toolOutput.unpaidStudentsCount || 0,
            },
          };
        } else if (toolName === "get_student_profile" && toolOutput?.student) {
          const st = toolOutput.student;
          detectedWidget = {
            type: "student_card",
            data: {
              id: st.id,
              name: `${st.name} ${st.surname}`.trim(),
              className: st.class?.name || "Non assignée",
              levelName: st.level?.name || "Standard",
              parentName: st.parent ? `${st.parent.name} ${st.parent.surname}`.trim() : "Non renseigné",
              parentPhone: st.parent?.phone || null,
              attendanceRate: st.attendanceRate || "100%",
              paymentStatus: st.paymentStatus || "PAID",
              tuitionFee: st.tuitionFee || 0,
              averageGrade: st.averageGrade,
            },
          };
        } else if ((toolName === "get_attendance" || toolName === "mark_class_attendance") && toolOutput) {
          detectedWidget = {
            type: "attendance_card",
            data: {
              date: toolOutput.date || new Date().toISOString().split("T")[0],
              className: toolOutput.className || "Toute l'école",
              attendanceRate: toolOutput.summary?.attendanceRate || toolOutput.attendanceRate || "100%",
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
                  dueAmount: r.dueAmount || r.tuitionFee || 0,
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

        // Fast direct synthesis for Mobile (ZERO 2nd LLM round-trip)
        if (toolName === "get_daily_caisse" && toolOutput?.summary) {
          const s = toolOutput.summary;
          finalReply = `💰 **Point de caisse du ${toolOutput.date || "jour"}**\n\n` +
            `• **Recettes encaissées :** \`${s.totalIncomes}\` (${s.paymentsCount} règlements)\n` +
            `• **Dépenses sorties :** \`${s.totalExpenses}\` (${s.expensesCount} dépenses)\n` +
            `• **Solde net en caisse :** **\`${s.netCashBalance}\`**` +
            (s.absencesCount !== undefined ? `\n\n📋 **Absences du jour :** ${s.absencesCount} élève(s) (${s.unexcusedAbsencesCount || 0} non justifié(s)).` : "");
          break;
        }

        if ((toolName === "get_payments" || toolName === "get_financial_anomalies") && (toolOutput?.records || toolOutput?.unpaidStudents)) {
          const records = toolOutput.records || toolOutput.unpaidStudents || [];
          const count = toolOutput.unpaidCount || records.length;
          const totalStr = toolOutput.totalOutstanding ? ` pour un total de **\`${toolOutput.totalOutstanding} DT\`**` : "";
          const list = records.slice(0, 8).map((r: any) =>
            `• **${r.studentName || r.name}** (${r.class || r.className}) — \`${r.dueAmount || r.tuitionFee} DT\` *(${r.feePeriod || ""})*`
          ).join("\n");
          finalReply = `💳 **Suivi des impayés :** ${count} élève(s)${totalStr} :\n\n${list}${count > 8 ? `\n\n*... et ${count - 8} autre(s) élève(s).*` : ""}`;
          break;
        }

        if (toolName === "get_attendance" && toolOutput) {
          finalReply = toolOutput.formattedText
            ? cleanTelegramFormattingForMobile(toolOutput.formattedText)
            : `📋 **Présences du jour :**\n\n• **Taux de présence :** ${toolOutput.attendanceRate || "100%"}\n• **Total absents :** ${toolOutput.totalAbsents || 0} élève(s)\n• **Retards :** ${toolOutput.totalLate || 0} élève(s)`;
          break;
        }

        if (toolName === "get_student_profile" && toolOutput?.student) {
          const st = toolOutput.student;
          finalReply = `👤 **Fiche Élève : ${st.name} ${st.surname}**\n\n` +
            `• **Classe :** ${st.class?.name || "Non assignée"}\n` +
            `• **Statut :** \`${st.paymentStatus || "À jour"}\`\n` +
            `• **Parent :** ${st.parent ? `${st.parent.name} ${st.parent.surname} (📞 ${st.parent.phone})` : "Non renseigné"}\n` +
            `• **Moyenne :** ${st.averageGrade !== undefined ? `${st.averageGrade}/20` : "Non calculée"}`;
          break;
        }

        if (toolName === "get_school_stats" && toolOutput) {
          finalReply = toolOutput.formattedText
            ? cleanTelegramFormattingForMobile(toolOutput.formattedText)
            : `📊 **Statistiques de l'établissement :**\n\n• **Élèves inscrits :** ${toolOutput.totalStudents || 0}\n• **Enseignants :** ${toolOutput.totalTeachers || 0}\n• **Classes :** ${toolOutput.totalClasses || 0}`;
          break;
        }

        if (toolOutput?.message && !toolOutput?.error) {
          finalReply = cleanTelegramFormattingForMobile(toolOutput.message);
          break;
        }

        if (toolOutput?.formattedText) {
          finalReply = cleanTelegramFormattingForMobile(toolOutput.formattedText);
          break;
        }

        // Synthesize via Gemini (fallback only if unformatted custom tool output)
        await input.onStatusUpdate?.({ step: "Rédaction de la réponse..." });
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

          // Safety interceptor: If the model generated raw JSON for an action instead of calling a tool natively
          const jsonActionMatch =
            rawText.match(/```(?:json)?\s*(\{[\s\S]*?"action"\s*:\s*"([a-zA-Z0-9_]+)"[\s\S]*?\})\s*```/) ||
            rawText.match(/(\{[\s\S]*?"action"\s*:\s*"([a-zA-Z0-9_]+)"\s*,\s*"payload"\s*:\s*\{[\s\S]*?\}\s*\})/);

          if (jsonActionMatch) {
            try {
              const parsed = JSON.parse(jsonActionMatch[1]);
              const toolName = parsed.action;
              const payload = parsed.payload || {};

              const toolArgs: Record<string, any> = { ...payload };
              if (payload.first_name && !toolArgs.name) toolArgs.name = payload.first_name;
              if (payload.last_name && !toolArgs.surname) toolArgs.surname = payload.last_name;
              if (payload.class_name && !toolArgs.className) toolArgs.className = payload.class_name;
              if (payload.parent_phone && !toolArgs.parentPhone) toolArgs.parentPhone = payload.parent_phone;
              if (payload.parent_name && !toolArgs.parentName) toolArgs.parentName = payload.parent_name;

              const toolDef = TOOLS[toolName];
              if (toolDef && toolDef.requiresConfirmation) {
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
                const cleanedText = rawText.replace(jsonActionMatch[0], "").trim();
                finalReply = cleanTelegramFormattingForMobile(
                  cleanedText || `Veuillez vérifier et confirmer l'action ci-dessous :`
                );
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
          finalReply = "C'est noté ! Avez-vous besoin d'autre chose ?";
        }
      }

      // Stream tokens to client if incremental callback provided
      if (input.onTokenDelta && finalReply) {
        await input.onTokenDelta(finalReply);
      }

      await input.onStatusUpdate?.({ step: "Terminé" });

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
        imageUrl: uploadedImageUrl,
        pendingConfirmation: pendingConfirmation || null,
        executedTool: lastExecutedTool,
        widget: detectedWidget,
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
}): Promise<{
  success: boolean;
  message: string;
  result?: any;
  actionResult?: {
    reference: string;
    summary: string;
    timestamp: string;
    status: "EXECUTED" | "REJECTED";
  };
}> {
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

    const cancelRef = `ACT-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;
    return {
      success: true,
      message: "Action annulée avec succès.",
      actionResult: {
        reference: cancelRef,
        summary: `Action ${toolCall.toolName} annulée`,
        timestamp: new Date().toISOString(),
        status: "REJECTED",
      },
    };
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

    const prefixMap: Record<string, string> = {
      add_expense: "EXP",
      record_payment: "REC",
      record_parent_payment: "REC",
      create_student: "ELE",
      create_class: "CLS",
      mark_class_attendance: "APP",
      post_announcement: "ANN",
    };
    const prefix = prefixMap[toolCall.toolName] || "ACT";
    const reference = `${prefix}-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}`;

    return {
      success: true,
      message: successMsg,
      result: executionResult,
      actionResult: {
        reference,
        summary: executionResult?.summary || successMsg,
        timestamp: new Date().toISOString(),
        status: "EXECUTED",
      },
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
