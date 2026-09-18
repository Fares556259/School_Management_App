/**
 * hniaVoiceBridge.ts
 * -------------------
 * Universal Voice Bridge between LiveKit Voice Agent and existing Hnia Core.
 *
 * Implements:
 *   SPEECH (STT) -> TEXT -> EXISTING HNIA -> TEXT -> SPEECH (TTS)
 *
 * Security & Context:
 *   Strictly inherits verified multi-tenant context:
 *   { schoolId, adminId, adminName, schoolName, language, telegramChatId }
 *   Never trusts spoken text for tenant credentials.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { TOOLS } from "@/lib/telegram/tools";
import { getPrunedGeminiDeclarations } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { getCachedKnowledge } from "@/lib/telegram/agent";

export interface VoiceTurnContext {
  schoolId: string;
  adminId: string;
  adminName: string;
  schoolName: string;
  language?: string;
  telegramChatId?: string | number;
}

export interface VoiceTurnInput {
  userMessage: string;
  context: VoiceTurnContext;
  history?: { role: "user" | "model" | "assistant"; text: string }[];
}

export interface VoiceTurnResult {
  text: string;
  toolsExecuted?: {
    toolName: string;
    args: any;
    result: any;
  }[];
}

const CANDIDATE_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-flash-lite-latest",
  "gemini-3-flash-preview",
];

const GREETING_REGEX = /^(\/start|\/help|bonjour|bonsoir|salut|salam|ahla|wach|labas|cava|ça va|hello|hi\b|hey\b|menu|\/menu|كيفاش|كيف|صباح الخير|مرحبا|هلا)([\s]+(hnia|هنية))?[\s!?.،]*$/i;
const STATS_REGEX = /(stats|statistique|effectif|effectifs|résumé école|résumé de l.école|résumé général|vue d.ensemble|combien d.élèves|combien d.eleves|nombre d.élèves|تلاميذ|وضع المدرسة|وضعية المدرسة|résumé 3al école)/i;
const CAISSE_REGEX = /(caisse|caisse du jour|clôture|clotûre|bilan de caisse|bilan du jour|daily cash|solde|recettes|dépenses|flous|الكاسة|كاسة|flous fel caisse)/i;

/**
 * Clean text for natural spoken delivery:
 * Strips HTML tags, Markdown markers, backticks, emojis that might pronounce weirdly.
 */
export function sanitizeForVoice(text: string): string {
  if (!text) return "";
  let clean = text
    .replace(/<[^>]*>/g, "") // strip HTML
    .replace(/#{1,6}\s+/g, "") // strip markdown headings
    .replace(/\*\*([^*]+)\*\*/g, "$1") // strip bold
    .replace(/\*([^*]+)\*/g, "$1") // strip italics
    .replace(/`([^`]+)`/g, "$1") // strip code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // strip links
    .replace(/^[-*•]\s+/gm, "") // strip bullet points
    .replace(/━+/g, "") // strip separator lines
    .replace(/[\uD83C-\uDBFF\uDC00-\uDFFF]+/g, "") // strip surrogate pair emojis
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If ends without punctuation, add period
  if (clean && !/[.!?؟]$/.test(clean)) {
    clean += ".";
  }
  return clean;
}

/**
 * Executes a single conversational voice turn through the existing Hnia brain.
 */
export async function processHniaVoiceTurn(input: VoiceTurnInput): Promise<VoiceTurnResult> {
  const { userMessage, context: vCtx, history = [] } = input;
  const msgTrimmed = (userMessage || "").trim();

  if (!msgTrimmed) {
    return { text: "Oui, je vous écoute. Comment puis-je vous aider ?" };
  }

  const toolContext: ToolContext = {
    schoolId: vCtx.schoolId,
    adminId: vCtx.adminId,
    adminName: vCtx.adminName,
    language: vCtx.language || "fr",
    chatId: vCtx.telegramChatId ? vCtx.telegramChatId.toString() : undefined,
  };

  const msgLower = msgTrimmed.toLowerCase();

  // ── FAST-PATH 1: Greetings ────────────────────────────────────────────────
  if (GREETING_REGEX.test(msgLower)) {
    const isArabic = /[\u0600-\u06FF]/.test(msgTrimmed) || /(ahla|aslema|salam|labas|cava)/i.test(msgLower);
    if (isArabic) {
      return {
        text: `Ahla si ${vCtx.adminName}, marhba bik ! Ena Hnia, tfadhel nsmak fash najem naawnek elyoum ?`,
      };
    }
    return {
      text: `Bonjour ${vCtx.adminName}, je suis Hnia, votre assistante pour l'école ${vCtx.schoolName}. Que puis-je faire pour vous ?`,
    };
  }

  // ── FAST-PATH 2: Attendance & Absences (Instant DB query ~50ms) ─────────────
  const ATTENDANCE_REGEX = /(présence|présences|absence|absences|absent|absents|retard|retards|qui est absent|fama ghyabat|chkoun ghyeb|chkoun ghaieb|fama absents|غياب|غيابات|حضور|شكون غايب)/i;
  if (ATTENDANCE_REGEX.test(msgLower)) {
    try {
      const { getAttendanceTool } = await import("@/lib/telegram/tools/readTools");
      const att = (await getAttendanceTool({ date: "today" }, toolContext)) as any;
      if (att?.summary) {
        const total = att.totalEnrolled || 53;
        const absent = att.summary.absentCount ?? 0;
        const late = att.summary.lateCount ?? 0;
        const isTounsi = /[\u0600-\u06FF]/.test(msgTrimmed) || /(fama|chkoun|ghyeb|elyoum|ya hnia)/i.test(msgLower);

        let text = "";
        if (absent === 0 && late === 0) {
          text = isTounsi
            ? `Ahla si ${vCtx.adminName}, elyoum les ${total} élèves lkoll présent, mafamech ghyabat wela retards.`
            : `Aujourd'hui, tous les ${total} élèves sont présents. Il n'y a aucun absent ni retardataire enregistré dans l'école.`;
        } else {
          text = isTounsi
            ? `Elyoum fama ${absent} absent${absent > 1 ? 's' : ''} w ${late} retardataire${late > 1 ? 's' : ''} men ${total} élèves.`
            : `Aujourd'hui, il y a ${absent} absent${absent > 1 ? 's' : ''} et ${late} retardataire${late > 1 ? 's' : ''} sur un total de ${total} élèves.`;
        }

        return {
          text,
          toolsExecuted: [{ toolName: "get_attendance", args: { date: "today" }, result: att }],
        };
      }
    } catch (e) {
      console.warn("[VoiceBridge] Fast-path attendance error:", e);
    }
  }

  // ── FAST-PATH 3: School Overview / Stats ──────────────────────────────────
  if (STATS_REGEX.test(msgLower)) {
    try {
      const { getSchoolStatsTool } = await import("@/lib/telegram/tools/readTools");
      const stats = (await getSchoolStatsTool({}, toolContext)) as any;
      if (stats?.students !== undefined) {
        const isTounsi = /[\u0600-\u06FF]/.test(msgTrimmed) || /(ecole|mte3i|fama|3al|lyoum)/i.test(msgLower);
        const text = isTounsi
          ? `Fel école ${vCtx.schoolName}, fama ${stats.students} élèves, ${stats.teachers} asettha w ${stats.classes} classes.`
          : `Actuellement à ${vCtx.schoolName}, nous comptons ${stats.students} élèves, ${stats.teachers} enseignants et ${stats.classes} classes.`;
        return {
          text,
          toolsExecuted: [{ toolName: "get_school_stats", args: {}, result: stats }],
        };
      }
    } catch (e) {
      console.warn("[VoiceBridge] Fast-path stats error:", e);
    }
  }

  // ── FAST-PATH 4: Daily Caisse ────────────────────────────────────────────
  if (CAISSE_REGEX.test(msgLower)) {
    try {
      const { getDailyCaisseTool } = await import("@/lib/telegram/tools/financeTools");
      const caisse = (await getDailyCaisseTool({ date: "today" }, toolContext)) as any;
      if (caisse?.summary) {
        const s = caisse.summary;
        const isTounsi = /[\u0600-\u06FF]/.test(msgTrimmed) || /(flous|elyoum|caisse|kassa|dinars)/i.test(msgLower);
        const text = isTounsi
          ? `Elyoum fama ${s.totalIncomes} dinars d5al, w ${s.totalExpenses} dinars masrouf. Solde net houwa ${s.netCashBalance} dinars.`
          : `Pour aujourd'hui, les encaissements s'élèvent à ${s.totalIncomes} dinars, et les dépenses à ${s.totalExpenses} dinars. Le solde net est de ${s.netCashBalance} dinars.`;
        return {
          text,
          toolsExecuted: [{ toolName: "get_daily_caisse", args: { date: "today" }, result: caisse }],
        };
      }
    } catch (e) {
      console.warn("[VoiceBridge] Fast-path caisse error:", e);
    }
  }

  // ── FULL EXISTING HNIA GEMINI AGENT WITH REAL TOOLS ───────────────────────
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      text: "La clé d'API Gemini n'est pas configurée sur le serveur. Veuillez vérifier les paramètres.",
    };
  }

  // Fetch school custom teachings
  let teachingsBlock = "";
  try {
    const teachings = getCachedKnowledge(vCtx.schoolId) || (await prisma.aIKnowledge.findMany({
      where: { schoolId: vCtx.schoolId, isActive: true },
      take: 10,
    }));
    if (teachings && teachings.length > 0) {
      teachingsBlock = `\nDirectives spécifiques de l'école :\n` +
        teachings.map((t: any) => `- ${t.instruction}`).join("\n");
    }
  } catch (kErr) {
    // Non-fatal
  }

  const now = new Date();
  const todayStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentMonthName = now.toLocaleDateString("fr-FR", { month: "long" });
  const currentYearNum = now.getFullYear();

  const systemInstruction = `Tu es Hnia (هنية), assistante vocale d'opérations scolaires de l'école "${vCtx.schoolName}".
Tu es en conversation téléphonique directe avec l'administrateur : "${vCtx.adminName}".
Aujourd'hui nous sommes le : ${todayStr}.
Mois en cours : ${currentMonthName} ${currentYearNum}.
Devise : Dinars Tunisiens (DT).
${teachingsBlock}

RÈGLES CAPITALES POUR L'APPEL VOCAL ET LA SYNTHÈSE VOCALE :
1. N'ÉCRIS JAMAIS EN CARACTÈRES ARABES (l'alphabet arabe fait planter la synthèse vocale).
2. Si l'administrateur parle en tunisien ou dialecte, réponds TOUJOURS en FRANCO-TUNISIEN PHONÉTIQUE en lettres latines (ex: "Ahla si Fares, elyoum fama...", "mafamech retards", "kol chay mriguel").
3. Si l'administrateur parle en français, réponds en français clair, chaleureux et professionnel.
4. ULTRA-COURT : MAXIMUM UNE SEULE PHRASE DIRECTE (15 à 20 mots max). Donne le chiffre ou la réponse immédiatement.
5. APPELLE IMMÉDIATEMENT LES OUTILS :
   - Impayés / paiements -> get_payments ou get_partial_payments
   - Absences du jour -> get_attendance
   - Notes / examens -> get_exams ou get_student_grades
   - Emploi du temps -> get_class_timetable
   - Salaires -> get_teachers
   - Dépenses -> get_expenses
6. AUCUN SYMBOLE, AUCUN MARKDOWN, AUCUNE BALISE HTML. Texte brut uniquement.`;

  // History normalization
  const historyContents: any[] = [];
  for (const h of history) {
    if (!h.text) continue;
    historyContents.push({
      role: h.role === "assistant" || h.role === "model" ? "model" : "user",
      parts: [{ text: h.text }],
    });
  }

  // Ensure alternation
  while (historyContents.length > 0 && historyContents[0].role !== "user") {
    historyContents.shift();
  }
  while (historyContents.length > 0 && historyContents[historyContents.length - 1].role !== "model") {
    historyContents.pop();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const toolsExecuted: { toolName: string; args: any; result: any }[] = [];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [
          {
            functionDeclarations: getPrunedGeminiDeclarations(msgTrimmed),
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 150,
        },
      });

      const chat = model.startChat({ history: historyContents });
      let response = await chat.sendMessage([{ text: msgTrimmed }]);
      let candidate = response.response;

      let functionCalls = candidate.functionCalls();
      let toolIterations = 0;
      const MAX_ITER = 3;

      while (functionCalls && functionCalls.length > 0 && toolIterations < MAX_ITER) {
        toolIterations++;
        const call = functionCalls[0];
        const toolDef = TOOLS[call.name];

        if (!toolDef) {
          break;
        }

        let output: any;
        try {
          output = await toolDef.execute(call.args || {}, toolContext);
        } catch (execErr: any) {
          output = { error: execErr.message || "Erreur d'exécution" };
        }

        toolsExecuted.push({ toolName: call.name, args: call.args, result: output });

        // Record tool call in audit log
        try {
          await prisma.auditLog.create({
            data: {
              schoolId: vCtx.schoolId,
              performedBy: `Hnia Voice (${vCtx.adminName})`,
              action: "VOICE_ACTION",
              entityType: call.name,
              entityId: "voice-call",
              description: `Action vocale exécutée : ${call.name}`,
              newValues: call.args || {},
            },
          });
        } catch (aErr) {
          // Non-fatal
        }

        // Send tool output back to model to get natural spoken synthesis
        response = await chat.sendMessage([
          {
            text: `[RÉSULTAT DE L'OUTIL ${call.name.toUpperCase()}] :\n${JSON.stringify(
              output
            )}\n\nRésume ce résultat vocalement en 1 SEULE phrase courte directe (en français ou franco-tunisien phonétique en lettres latines). Maximum 15 mots. Pas de caractères arabes, pas de markdown.`,
          },
        ]);
        candidate = response.response;
        functionCalls = candidate.functionCalls();
      }

      const replyText = candidate.text();
      return {
        text: sanitizeForVoice(replyText),
        toolsExecuted,
      };
    } catch (modelErr: any) {
      console.warn(`[VoiceBridge] Model ${modelName} error:`, modelErr?.message || modelErr);
    }
  }

  return {
    text: "Excusez-moi, j'ai eu une petite hésitation réseau. Pouvez-vous répéter votre demande ?",
    toolsExecuted,
  };
}
