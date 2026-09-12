import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { sendTelegramChatAction, sendTelegramMessage } from "./telegram";
import { TOOLS, getGeminiFunctionDeclarations } from "./tools";
import { ToolContext } from "./tools/readTools";
import { formatTelegramMessage, getQuickActionButtons } from "./formatter";

export interface AgentInput {
  userMessage: string;
  telegramId: string;
  chatId: string | number;
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
  const { userMessage, chatId, tgAccount } = input;

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

  // 1. Send "typing..." action so user sees bot is thinking
  await sendTelegramChatAction(chatId, "typing");

  const adminName =
    [tgAccount.admin.name, tgAccount.admin.surname].filter(Boolean).join(" ") ||
    tgAccount.admin.username;

  const context: ToolContext = {
    schoolId: tgAccount.schoolId,
    adminId: tgAccount.adminId,
    adminName,
    language: tgAccount.language || "fr",
  };

  // 2. Find or create an active AIConversation
  let conversation = await prisma.aIConversation.findFirst({
    where: {
      telegramAccountId: tgAccount.id,
      telegramChatId: chatId.toString(),
      status: "ACTIVE",
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.aIConversation.create({
      data: {
        telegramAccountId: tgAccount.id,
        telegramChatId: chatId.toString(),
        title: userMessage.slice(0, 40),
      },
    });
  }

  // 3. Save user message to database
  await prisma.aIMessage.create({
    data: {
      conversationId: conversation.id,
      role: "user",
      content: userMessage,
    },
  });

  // 4. Fetch recent conversation history (last 10 messages)
  const recentMessages = await prisma.aIMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  // 5. Build system instruction
  const todayStr = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const systemInstruction = `Tu es Hnia (هنية), l'assistante intelligente d'opérations scolaires de l'école "${tgAccount.School.name}" sur SnapSchool.
Tu interagis directement avec l'administrateur : "${adminName}".
Aujourd'hui nous sommes le : ${todayStr}.
Devise de l'école : Dinars Tunisiens (DT).

DOMAINES DE COMPÉTENCE (31 OUTILS DISPONIBLES) :
1. PÉDAGOGIE & ÉLÈVES (get_student_profile, get_students, get_parents, get_classes, create_student, create_class, assign_student_to_class)
2. CORPS ENSEIGNANT & PERSONNEL (get_teachers, get_staff, create_teacher, create_staff, pay_teacher_salary, pay_staff_salary)
3. PRÉSENCES & DISCIPLINE (get_attendance, get_student_attendance_history, mark_attendance)
4. NOTES, EXAMENS & BULLETINS (get_student_grades, get_class_grade_sheet, get_exams, record_grade, schedule_exam)
5. FINANCES & COMPTABILITÉ (record_payment, add_expense, get_financial_summary, get_payments, get_financial_anomalies, send_payment_reminders)
6. EMPLOI DU TEMPS & REMPLACEMENTS (get_class_timetable, find_available_teachers, add_timetable_slot)
7. COMMUNICATION (post_announcement)

RÈGLES DE PRÉSENTATION & DESIGN VISUEL (STYLE "EXECUTIVE DASHBOARD") :
Tu ne produis JAMAIS de texte brut basique ou monotone. Tu formates toutes tes réponses comme un mini-dashboard exécutif moderne et agréable pour Telegram :
- Utilise les balises HTML Telegram : <b>gras</b>, <i>italique</i>, <code>badge / valeur clé</code>, et <blockquote>pour les résumés ou recommandations clés</blockquote>.
- Encadre systématiquement TOUTES les sommes d'argent, dates, noms de classes, taux et numéros entre <code>...</code> (ex: <code>+6 304 DT</code>, <code>-20 818 DT</code>, <code>Classe 8B</code>, <code>14:00</code>, <code>98123456</code>, <code>16.5/20</code>).
- Pour les bilans financiers :
  🏛️ <b>${tgAccount.School.name.toUpperCase()}</b> • <i>Bilan Financier</i>
  ━━━━━━━━━━━━━━━━━━━━━━
  📊 <b>Indicateurs Clés :</b>
  • Revenus encaissés : <code>+... DT</code>
  • Dépenses totales : <code>-... DT</code>
  • Résultat net : <code>... DT</code>
  <blockquote>💡 <b>Analyse Hnia :</b>
  [Synthèse des faits marquants et conseil stratégique]</blockquote>
- Pour les listes de personnel, enseignants ou élèves, utilise une mise en page aérée et moderne avec puces et badges :
  <b>1. Asma Asma</b>
     📚 <i>Anglais</i>  •  🏫 <code>Classe 6A</code>  •  📞 <code>44555599</code>
- Utilise la balise <blockquote>...</blockquote> pour isoler tes remarques importantes, tes alertes ou la question finale pour l'administrateur.
- Ne JAMAIS afficher de Markdown Markdown brut cassé comme '###' ou '---'. Utilise '━━━━━━━━━━━━━━━━━━━━━━' comme ligne de séparation.
- Ne JAMAIS afficher de noms techniques de fonctions (comme "get_attendance"). Exprime-toi toujours en langage naturel et chaleureux.
- Réponds toujours dans la langue de l'administrateur (arabe tunisien, français ou anglais).
- Sois concise, percutante et d'une clarté absolue.`;

  // Candidate models with primary ultra-fast lite model and fallback
  const CANDIDATE_MODELS = [
    "gemini-3.5-flash-lite",
    "gemini-flash-latest",
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
      return "⏳ Le service d'intelligence artificielle est actuellement très sollicité. Veuillez patienter un instant avant d'envoyer votre prochaine demande.";
    }
    if (msg.includes("api key") || msg.includes("403") || msg.includes("permission_denied")) {
      return "⚠️ Une erreur d'autorisation est survenue avec le service d'IA. Veuillez vérifier la configuration de votre clé API.";
    }
    return "Désolée, une erreur temporaire est survenue lors du traitement de votre demande. Veuillez réessayer dans quelques instants.";
  }

  // Build chat contents
  // Exclude current message from history to prevent duplication
  const historyContents: any[] = [];
  for (const m of recentMessages.slice(0, -1)) {
    if (!m.content || !m.content.trim()) continue;
    historyContents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content.trim() }],
    });
  }

  // Gemini API requires the first content to have role 'user'
  while (historyContents.length > 0 && historyContents[0].role !== "user") {
    historyContents.shift();
  }

  const currentTurnParts: any[] = [{ text: userMessage }];

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
            functionDeclarations: getGeminiFunctionDeclarations(),
          },
        ],
      });

      const chat = model.startChat({
        history: historyContents,
      });

      let response = await chat.sendMessage(currentTurnParts);
      let candidate = response.response;

      // Handle tool calling loop
      let functionCalls = candidate.functionCalls();
      let lastExecutedTool: string | undefined;

      while (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];
        const toolName = call.name;
        const toolArgs = (call.args || {}) as Record<string, any>;

        const toolDef = TOOLS[toolName];
        if (!toolDef) {
          console.warn(`[Agent] Unknown function call: ${toolName}`);
          break;
        }

        // Check if tool requires confirmation
        if (toolDef.requiresConfirmation) {
          // Create pending tool call record in DB
          const toolCallRecord = await prisma.aIToolCall.create({
            data: {
              conversationId: conversation.id,
              toolName,
              arguments: toolArgs,
              status: "PENDING",
              requiresConfirm: true,
            },
          });

          // Format confirmation prompt
          const confirmText = toolDef.formatConfirmationMessage
            ? toolDef.formatConfirmationMessage(toolArgs, context)
            : `❓ Souhaitez-vous confirmer l'exécution de l'action **${toolName}** ?`;

          const styledConfirmText = formatTelegramMessage(confirmText);

          // Send confirmation message with inline buttons
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

          // Save assistant note
          await prisma.aIMessage.create({
            data: {
              conversationId: conversation.id,
              role: "assistant",
              content: confirmText,
            },
          });

          // Stop turn — user must confirm before anything further happens
          succeeded = true;
          return;
        }

        // Read-only tool: execute immediately
        lastExecutedTool = toolName;
        await sendTelegramChatAction(chatId, "typing");
        const toolOutput = await toolDef.execute(toolArgs, context);

        // Save tool call record
        await prisma.aIToolCall.create({
          data: {
            conversationId: conversation.id,
            toolName,
            arguments: toolArgs,
            result: toolOutput,
            status: "EXECUTED",
            executedAt: new Date(),
          },
        });

        // Send tool output to Gemini for natural language synthesis
        response = await chat.sendMessage([
          {
            text: `[DONNÉES SYSTÈME POUR ${toolName.toUpperCase()}] :\n${JSON.stringify(
              toolOutput
            )}\n\nPrésente ces données à l'administrateur sous forme de mini-dashboard Telegram très soigné et professionnel en HTML (utilise <b>, <i>, <code> pour les chiffres clés/classes, <blockquote> pour les analyses/conseils). Respecte sa langue.`,
          },
        ]);

        candidate = response.response;
        functionCalls = candidate.functionCalls();
      }

      // Final textual response
      let finalReply = "Je reste à votre disposition pour toute autre question.";
      try {
        finalReply = candidate.text() || finalReply;
      } catch (textErr) {
        console.warn("[Agent] candidate.text() warning:", textErr);
      }

      // Save reply to DB
      await prisma.aIMessage.create({
        data: {
          conversationId: conversation.id,
          role: "assistant",
          content: finalReply,
        },
      });

      // Format reply as an executive-grade Telegram card
      const formattedReply = formatTelegramMessage(finalReply, tgAccount.School.name);
      const quickButtons = getQuickActionButtons(lastExecutedTool);

      // Send formatted message to Telegram
      await sendTelegramMessage(chatId, formattedReply, {
        parse_mode: "HTML",
        reply_markup: quickButtons,
      });

      succeeded = true;
      break;
    } catch (err: any) {
      console.warn(`[Agent] Model ${modelName} encountered error:`, err.message || err);
      lastError = err;
      // Continue to next candidate model
    }
  }

  if (!succeeded) {
    console.error("[Agent] All candidate models failed. Last error:", lastError);
    const friendlyError = formatUserErrorMessage(lastError);
    await sendTelegramMessage(chatId, friendlyError);
  }
}
