import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import {
  sendTelegramChatAction,
  sendTelegramMessage,
  sendTelegramContact,
  getMainHubInlineKeyboard,
} from "./telegram";
import { TOOLS, getGeminiFunctionDeclarations, getPrunedGeminiDeclarations } from "./tools";
import { ToolContext } from "./tools/readTools";
import { formatTelegramMessage, getQuickActionButtons } from "./formatter";
import { isCorrectionMessage, flagConversationForLearning } from "./feedback";
import { buildHniaSystemInstruction } from "@/lib/agent/hniaPrompt";

// ── Module-level aIKnowledge in-memory cache (avoids repeated DB round-trips per school) ──
// TTL: 5 minutes. Each entry: { data: knowledge rows, expiresAt: Unix ms timestamp }
const _knowledgeCache = new Map<string, { data: any[]; expiresAt: number }>();
const KNOWLEDGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedKnowledge(schoolId: string): any[] | null {
  const entry = _knowledgeCache.get(schoolId);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  _knowledgeCache.delete(schoolId);
  return null;
}

export function setCachedKnowledge(schoolId: string, data: any[]): void {
  _knowledgeCache.set(schoolId, { data, expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS });
}

export interface AgentInput {
  userMessage: string;
  telegramId: string;
  chatId: string | number;
  replyToText?: string;
  tgAccount: {
    id: string;
    schoolId: string;
    adminId: string;
    language: string;
    admin: {
      name: string | null;
      surname: string | null;
      username: string;
    };
    School: {
      name: string;
    };
  };
}

/**
 * Core agent processor for incoming messages from Telegram.
 */
export async function runTelegramAgent(input: AgentInput): Promise<void> {
  const { userMessage, chatId, tgAccount, replyToText } = input;

  const apiKey =
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    await sendTelegramMessage(
      chatId,
      "⚠️ Veuillez configurer la variable `GEMINI_API_KEY` dans les paramètres de votre projet Vercel."
    );
    return;
  }

  // 1. Send "typing..." action so user sees bot is thinking (fire-and-forget for instant processing)
  sendTelegramChatAction(chatId, "typing").catch((e) =>
    console.warn("[Agent] Initial typing action warning:", e)
  );

  const adminName =
    [tgAccount.admin.name, tgAccount.admin.surname].filter(Boolean).join(" ") ||
    tgAccount.admin.username;

  const context: ToolContext = {
    schoolId: tgAccount.schoolId,
    adminId: tgAccount.adminId,
    adminName,
    language: tgAccount.language || "fr",
    chatId: chatId.toString(),
  };

  let effectiveUserMessage = userMessage;
  if (replyToText && replyToText.trim()) {
    effectiveUserMessage = `[En réponse au message : "${replyToText.trim().slice(0, 300)}"]\n\n${userMessage}`;
  }

  // ── FAST-PATH: Instant responses for greetings and direct commands (< 150ms) ──
  const msgLower = userMessage.trim().toLowerCase();
  const GREETING_REGEX = /^(\/start|\/help|bonjour|bonsoir|salut|salam|ahla|wach|labas|cava|ça va|hello|hi\b|hey\b|menu|\/menu|كيفاش|كيف|صباح الخير|مرحبا|هلا)[\s!?.،]*$/i;
  const STATS_REGEX = /^(\/stats|stats|statistique|effectif|effectifs|résumé école|résumé de l.école|aperçu)[\s!?.]*$/i;
  const CAISSE_REGEX = /^(\/caisse|caisse|caisse du jour|clôture|clotûre|bilan du jour|daily cash)[\s!?.]*$/i;

  if (GREETING_REGEX.test(msgLower)) {
    // Return hub card immediately — no DB, no Gemini
    const hubKeyboard = getMainHubInlineKeyboard(tgAccount.language);
    const greetingText = `👋 <b>Bonjour ${adminName} !</b>\n\nJe suis <b>Hnia</b>, votre assistante SnapSchool 🎓\nComment puis-je vous aider aujourd'hui ?`;
    await sendTelegramMessage(chatId, greetingText, {
      parse_mode: "HTML",
      reply_markup: hubKeyboard,
    });
    return;
  }

  if (STATS_REGEX.test(msgLower)) {
    // Direct stats call — no Gemini needed
    sendTelegramChatAction(chatId, "typing").catch(() => null);
    try {
      const { getSchoolStatsTool } = await import("./tools/readTools");
      const statsOutput = await getSchoolStatsTool({}, context);
      if (statsOutput?.formattedText) {
        await sendTelegramMessage(chatId, statsOutput.formattedText, { parse_mode: "HTML" });
        return;
      }
    } catch (fastPathErr) {
      console.warn("[Agent] Fast-path /stats failed, falling through to Gemini:", fastPathErr);
    }
  }

  if (CAISSE_REGEX.test(msgLower)) {
    // Direct caisse call — no Gemini needed
    sendTelegramChatAction(chatId, "typing").catch(() => null);
    try {
      const { getDailyCaisseTool } = await import("./tools/financeTools");
      const caisseOutput = await getDailyCaisseTool({ date: "today" }, context) as any;
      if (caisseOutput?.formattedText) {
        await sendTelegramMessage(chatId, caisseOutput.formattedText as string, { parse_mode: "HTML" });
        return;
      }
    } catch (fastPathErr) {
      console.warn("[Agent] Fast-path /caisse failed, falling through to Gemini:", fastPathErr);
    }
  }

  // 2 & 3. Single-query parallel fetch: active conversation (with messages) + school custom teachings
  // aIKnowledge is served from in-memory cache (5-min TTL) to avoid repeated DB round-trips
  const cachedKnowledge = getCachedKnowledge(tgAccount.schoolId);
  let [conversation, freshKnowledge] = await Promise.all([
    prisma.aIConversation.findFirst({
      where: {
        telegramAccountId: tgAccount.id,
        telegramChatId: chatId.toString(),
        status: "ACTIVE",
      },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    }),
    cachedKnowledge
      ? Promise.resolve(null) // Cache hit — skip DB query
      : prisma.aIKnowledge.findMany({
          where: {
            schoolId: tgAccount.schoolId,
            isActive: true,
          },
          orderBy: { createdAt: "desc" },
          take: 40,
        }),
  ]);

  // Resolve schoolTeachings from cache or fresh fetch, and update cache if fresh
  let schoolTeachings: any[];
  if (cachedKnowledge) {
    schoolTeachings = cachedKnowledge;
  } else {
    schoolTeachings = freshKnowledge || [];
    setCachedKnowledge(tgAccount.schoolId, schoolTeachings);
  }

  let conversationId: string;
  let historyMessages: { role: string; content: string }[] = [];
  if (conversation) {
    conversationId = conversation.id;
    historyMessages = [...conversation.messages].reverse();
  } else {
    const newConv = await prisma.aIConversation.create({
      data: {
        telegramAccountId: tgAccount.id,
        telegramChatId: chatId.toString(),
        title: userMessage.slice(0, 40),
      },
    });
    conversationId = newConv.id;
  }

  // 4. Save user message to database (fire-and-forget — audit only, don't block)
  prisma.aIMessage.create({
    data: {
      conversationId,
      role: "user",
      content: effectiveUserMessage,
    },
  }).catch((e) => console.warn("[Agent] aIMessage user save failed:", e));

  // Touch conversation to keep active (fire-and-forget)
  prisma.aIConversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  }).catch((e) => console.warn("[Agent] aIConversation touch failed:", e));

  // Detect if user message is an explicit or implicit correction
  if (isCorrectionMessage(userMessage)) {
    flagConversationForLearning(conversationId, "USER_CORRECTION_DETECTED").catch(() => {});
  }

  // 5. Build system instruction
  const now = new Date();
  const todayStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const currentMonthNum = now.getMonth() + 1;
  const currentMonthName = now.toLocaleDateString("fr-FR", { month: "long" });
  const currentYearNum = now.getFullYear();

  const systemInstruction = buildHniaSystemInstruction({
    schoolName: tgAccount.School.name,
    adminName,
    schoolTeachings,
  });

  // Candidate models — fastest and most capable first, followed by solid fallbacks
  const CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-3.5-flash",
    "gemini-3.8-flash",
  ];

  // Helper to format friendly error message without raw API dumps
  function formatUserErrorMessage(err: any): string {
    const msg = (err?.message || "").toLowerCase();
    if (
      msg.includes("429") ||
      msg.includes("quota") ||
      msg.includes("resource_exhausted") ||
      msg.includes("too many requests")
    ) {
      return "⏳ Le serveur est un peu chargé en ce moment. Réessayez dans quelques secondes !";
    }
    if (msg.includes("api key") || msg.includes("403") || msg.includes("permission_denied")) {
      return "⚠️ Problème de clé API. Vérifiez la configuration dans vos paramètres.";
    }
    return "Oups, petit souci passager. Réessayez dans un instant !";
  }

  // Build clean alternating history for Gemini
  const rawTurns: { role: "user" | "model"; text: string }[] = [];
  for (const m of historyMessages) {
    if (!m.content || !m.content.trim()) continue;
    rawTurns.push({
      role: m.role === "assistant" ? "model" : "user",
      text: m.content.trim(),
    });
  }

  // Ensure strict role alternation (merge consecutive turns of the same role)
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

  // Gemini requires history to start with 'user'
  while (normalizedTurns.length > 0 && normalizedTurns[0].role !== "user") {
    normalizedTurns.shift();
  }

  // Gemini requires history to end with 'model' (since chat.sendMessage will send the next 'user' turn)
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

  const currentTurnParts: any[] = [{ text: effectiveUserMessage }];

  const genAI = new GoogleGenerativeAI(apiKey);
  let succeeded = false;
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      console.log(`[Agent] Attempting processing with model: ${modelName}`);
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        tools: [
          {
            functionDeclarations: getPrunedGeminiDeclarations(
              effectiveUserMessage,
              chatId
            ),
          },
        ],
        generationConfig: {
          temperature: 0.15,
          maxOutputTokens: 1024,
        },
      });

      const chat = model.startChat({
        history: historyContents,
      });

      let response = await chat.sendMessage(currentTurnParts);
      let candidate = response.response;

      // Handle tool calling loop
      let functionCalls = candidate.functionCalls();
      let lastExecutedTool: string | undefined;
      let lastToolOutput: any;
      let finalReply: string | undefined;
      const MAX_TOOL_ITERATIONS = 5;
      let toolIterations = 0;

      while (functionCalls && functionCalls.length > 0) {
        // Safety guard: prevent infinite tool call loops
        if (toolIterations >= MAX_TOOL_ITERATIONS) {
          console.warn(`[Agent] Max tool iterations (${MAX_TOOL_ITERATIONS}) reached. Breaking loop.`);
          break;
        }
        toolIterations++;

        const call = functionCalls[0];
        const toolName = call.name;
        const toolArgs = (call.args || {}) as Record<string, any>;

        const toolDef = TOOLS[toolName];
        if (!toolDef) {
          console.warn(`[Agent] Unknown function call: ${toolName}`);
          break;
        }

        // Guard against hallucinated add_resource calls without real attachment
        if (toolName === "add_resource") {
          const fileUrl = ((toolArgs.url as string) || "").trim().toLowerCase();
          const isInvalid =
            !fileUrl ||
            fileUrl === "dummy" ||
            fileUrl === "fichier" ||
            fileUrl === "attachement" ||
            fileUrl === "url" ||
            (!fileUrl.startsWith("http://") && !fileUrl.startsWith("https://") && !fileUrl.startsWith("/"));
          if (isInvalid) {
            console.warn("[Agent] Blocked add_resource without valid file URL:", toolArgs);
            response = await chat.sendMessage([
              {
                text: `[ERREUR SYSTÈME] : L'outil 'add_resource' a été bloqué car aucun fichier/URL valide n'a été attaché (${fileUrl}). S'il s'agit d'une question générale (ex: recette de cuisine, informatique, culture, météo), réponds directement en texte à l'administrateur sans appeler d'outils scolaires. S'il s'agit d'un vrai support de cours scolaire, demande-lui d'abord d'envoyer le document.`,
              },
            ]);
            candidate = response.response;
            functionCalls = candidate.functionCalls();
            continue;
          }
        }

        // Check if tool requires confirmation
        if (toolDef.requiresConfirmation) {
          // If there are multiple function calls that require confirmation in this turn
          // (e.g. scheduling multiple sessions at once), create confirmation cards for all of them!
          for (const c of functionCalls) {
            const def = TOOLS[c.name];
            if (!def || !def.requiresConfirmation) continue;
            const args = (c.args || {}) as Record<string, any>;

            const toolCallRecord = await prisma.aIToolCall.create({
              data: {
                conversationId,
                toolName: c.name,
                arguments: args,
                status: "PENDING",
                requiresConfirm: true,
              },
            });

            const confirmText = def.formatConfirmationMessage
              ? await Promise.resolve(def.formatConfirmationMessage(args, context))
              : `❓ Souhaitez-vous confirmer l'exécution de l'action **${c.name}** ?`;

            const styledConfirmText = formatTelegramMessage(confirmText);

            await sendTelegramMessage(chatId, styledConfirmText, {
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: "✅ Confirmer", callback_data: `confirm:${toolCallRecord.id}` },
                    { text: "❌ Annuler", callback_data: `cancel:${toolCallRecord.id}` },
                  ],
                ],
              },
            });

            // Fire-and-forget assistant message save
            prisma.aIMessage.create({
              data: {
                conversationId,
                role: "assistant",
                content: confirmText,
              },
            }).catch((e) => console.warn("[Agent] aIMessage confirm save failed:", e));
          }

          // Stop turn — user must confirm before anything further happens
          succeeded = true;
          return;
        }

        // Read-only or direct execution tool: execute immediately
        lastExecutedTool = toolName;
        // Refresh typing indicator to show bot is still working (fire-and-forget)
        sendTelegramChatAction(chatId, "typing").catch(() => null);

        let toolOutput: any;
        try {
          toolOutput = await toolDef.execute(toolArgs, context);
        } catch (toolErr: any) {
          console.error(`[Agent] Tool execution error for '${toolName}':`, toolErr);
          // Return error as tool output so model can handle it gracefully
          toolOutput = { error: true, message: toolErr.message || "Tool execution failed" };
        }
        lastToolOutput = toolOutput;

        // Save tool call record (fire-and-forget — audit only, don't block synthesis)
        prisma.aIToolCall.create({
          data: {
            conversationId,
            toolName,
            arguments: toolArgs,
            result: toolOutput,
            status: toolOutput?.error ? "FAILED" : "EXECUTED",
            executedAt: new Date(),
          },
        }).catch((e) => console.warn("[Agent] aIToolCall save failed:", e));

        // FAST-PATH SYNTHESIS: If tool already prepared a rich Telegram formattedText,
        // use it directly and eliminate the 2nd Gemini roundtrip (~700-1200ms saved)!
        if (toolOutput && toolOutput.formattedText) {
          finalReply = toolOutput.formattedText;
          break;
        }

        // Send tool output to Gemini for natural language synthesis
        response = await chat.sendMessage([
          {
            text: `[DONNÉES SYSTÈME POUR ${toolName.toUpperCase()}] :\n${JSON.stringify(
              toolOutput
            )}\n\nPrésente ces données à l'administrateur sous forme d'une mini-carte Telegram compacte, 100% optimisée pour mobile (smartphone) :
- STYLE OBLIGATOIRE : FRANÇAIS FACILE & JARGON D'ÉCOLE (OU EASY WORKPLACE ENGLISH) :
  * Utilise un français simple, direct, moderne et le vrai jargon d'école ("avance", "solde", "reste à payer", "impayés", "retenue d'absence", "appel fait", "caisse").
  * ZÉRO français littéraire lourd, soutenu ou pompeux (pas de "Il convient de noter", "Je me permets", etc.).
  * Si l'admin écrit en anglais, réponds en easy, clear, modern English ("All set!", "Remaining balance: X DT", "Done").
- Zéro texte superflu : pas de bavardage, aucun UUID/ID technique affiché.
- ANTI-HALLUCINATION & FIDÉLITÉ ABSOLUE AUX DONNÉES DE LA BASE :
  * Ne cite JAMAIS de noms d'élèves, de parents ou d'enseignants provenant des exemples de ton prompt ou de messages passés !
  * Base-toi STRICTEMENT et UNIQUEMENT sur les données retournées dans le JSON ci-dessus.
  * Si le JSON liste des élèves impayés, liste STRICTEMENT ces élèves-là sans en ajouter, sans en inventer, et sans en substituer aucun.
  * Ne modifie, n'altère et n'invente JAMAIS aucune donnée financière ni aucun numéro de téléphone.
- Format ultra-synthétique et scannable avec <b>gras</b>, <i>italique</i>, et <code>...</code> pour les montants, classes et dates.
- Termine UNIQUEMENT si nécessaire par 1 courte phrase percutante d'action dans <blockquote>💡 <b>Hnia :</b> [conseil direct en français simple ou easy English]</blockquote>.
- PÉRIODE & MENTION DU MOIS : Mentionne TOUJOURS explicitement le mois concerné (ex: 📅 Mois : <code>${currentMonthName} ${currentYearNum}</code>). L'administrateur exige de voir le mois écrit noir sur blanc dans chaque bilan ou réponse financière ! Ne le laisse JAMAIS sous-entendu.
- Pour chaque parent affiché, écris son téléphone sous forme native : 📞 +216 [numéro] (SANS AUCUN LIEN WHATSAPP, les directeurs n'utilisent pas WhatsApp. Laisse le numéro en texte brut avec préfixe +216 pour que Telegram ouvre directement le composeur d'appel).
- LANGUE OBLIGATOIRE : Réponds STRICTEMENT dans la même langue que celle utilisée par l'administrateur ! S'il a parlé en Tunisien (Derja arabe ou phonétique latine / Arabizi), tu DOIS RÉPONDRE EN TUNISIEN (Derja) ! S'il a écrit en français, réponds en français soigné et respectueux (SANS AUCUN ARGOT COMME "nickel" OU "sur le feu").`,
          },
        ]);

        candidate = response.response;
        functionCalls = candidate.functionCalls();
      }

      // Final textual response
      if (!finalReply) {
        try {
          finalReply = candidate.text() || "C'est bon ! Dis-moi si tu as besoin d'autre chose.";
        } catch (textErr) {
          console.warn("[Agent] candidate.text() warning:", textErr);
          finalReply = "C'est bon ! Dis-moi si tu as besoin d'autre chose.";
        }
      }

      // Save reply to DB (fire-and-forget — don't block sending the message)
      prisma.aIMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: finalReply,
        },
      }).catch((e) => console.warn("[Agent] aIMessage assistant save failed:", e));

      // Format reply as an executive-grade Telegram card
      const formattedReply = formatTelegramMessage(finalReply, tgAccount.School.name);
      let quickButtons =
        getQuickActionButtons(lastExecutedTool, formattedReply) ||
        getMainHubInlineKeyboard(tgAccount.language);

      // Attach feedback buttons to allow the admin to signal errors or satisfaction
      if (conversationId) {
        const feedbackRow = [
          { text: "👍", callback_data: `feedback:good:${conversationId}` },
          { text: "👎 Signaler", callback_data: `feedback:bad:${conversationId}` },
        ];
        if (quickButtons && quickButtons.inline_keyboard) {
          quickButtons = {
            inline_keyboard: [...quickButtons.inline_keyboard, feedbackRow],
          };
        } else {
          quickButtons = {
            inline_keyboard: [feedbackRow],
          };
        }
      }

      // Send formatted message to Telegram
      await sendTelegramMessage(chatId, formattedReply, {
        parse_mode: "HTML",
        reply_markup: quickButtons,
      });

      // If a single contact phone was retrieved, also send the official native Telegram Contact card
      // This gives the user an immediate 1-tap phone call button directly in Telegram without any web popup!
      try {
        if (lastExecutedTool && lastToolOutput) {
          let contactPhone: string | undefined;
          let contactFirst: string | undefined;
          let contactLast: string | undefined;

          if (lastExecutedTool === "get_student_profile" && lastToolOutput.student?.parent?.phone) {
            contactPhone = lastToolOutput.student.parent.phone;
            contactFirst = lastToolOutput.student.parent.name || "Parent";
            contactLast = `(Parent ${lastToolOutput.student.fullName || "Élève"})`;
          } else if (lastExecutedTool === "get_parents" && lastToolOutput.parents?.length === 1 && lastToolOutput.parents[0]?.phone) {
            contactPhone = lastToolOutput.parents[0].phone;
            contactFirst = (lastToolOutput.parents[0].fullName || `${lastToolOutput.parents[0].name || "Parent"} ${lastToolOutput.parents[0].surname || ""}`).trim();
            contactLast = "Parent";
          } else if (lastExecutedTool === "get_teachers" && lastToolOutput.teachers?.length === 1 && lastToolOutput.teachers[0]?.phone) {
            contactPhone = lastToolOutput.teachers[0].phone;
            contactFirst = `${lastToolOutput.teachers[0].name || "Enseignant"}`.trim();
            contactLast = "Enseignant";
          }

          if (contactPhone && contactPhone.replace(/\D/g, "").length >= 4) {
            await sendTelegramContact(chatId, contactPhone, contactFirst || "Contact", contactLast);
          }
        }
      } catch (contactErr) {
        console.warn("[Agent] sendTelegramContact non-critical warning:", contactErr);
      }

      succeeded = true;
      break;
    } catch (err: any) {
      console.warn(`[Agent] Model ${modelName} encountered error:`, err.message || err);
      lastError = err;
      // Wait briefly before trying next model (only if rate limited / overloaded)
      const errStr = (err?.message || "").toLowerCase();
      if (errStr.includes("429") || errStr.includes("503") || errStr.includes("quota")) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }
  }

  if (!succeeded) {
    console.error("[Agent] All candidate models failed. Last error:", lastError);
    const friendlyError = formatUserErrorMessage(lastError);
    await sendTelegramMessage(chatId, friendlyError);
  }
}
