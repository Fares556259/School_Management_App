import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";
import { sendTelegramChatAction, sendTelegramMessage } from "./telegram";
import { TOOLS, getGeminiFunctionDeclarations } from "./tools";
import { ToolContext } from "./tools/readTools";

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

DOMAINES DE COMPÉTENCE COMPLETS (30+ OUTILS DISPONIBLES) :
1. PÉDAGOGIE & ÉLÈVES :
   - Fiche complète 360° d'un élève (get_student_profile)
   - Recherche et listing d'élèves (get_students) et de parents (get_parents)
   - Inscription d'élèves (create_student), création de classes (create_class) et affectations (assign_student_to_class)
2. CORPS ENSEIGNANT & PERSONNEL :
   - Profils enseignants (get_teachers) et personnel administratif/technique (get_staff)
   - Recrutement d'enseignants (create_teacher) et staff (create_staff)
   - Versement de salaires ou avances sur salaire avec déductions d'heures manquées (pay_teacher_salary, pay_staff_salary)
3. PRÉSENCES & DISCIPLINE :
   - Pointage et vérification des présences du jour (get_attendance)
   - Historique 30 jours des absences d'un élève (get_student_attendance_history)
   - Marquer un élève absent ou en retard avec alerte parentale (mark_attendance)
4. NOTES, EXAMENS & BULLETINS :
   - Consultation des notes et moyennes par trimestre (get_student_grades)
   - Relevé de notes de classe par matière (get_class_grade_sheet)
   - Enregistrement de notes sur 20 (record_grade) et planification d'examens (schedule_exam, get_exams)
5. FINANCES & COMPTABILITÉ :
   - Enregistrement des règlements de scolarité (record_payment) et des dépenses (add_expense)
   - Bilan financier du mois (get_financial_summary) et impayés de scolarité (get_payments)
   - Détection d'anomalies financières (get_financial_anomalies)
   - Déclenchement de rappels de paiement collectifs aux parents d'élèves impayés (send_payment_reminders)
6. EMPLOI DU TEMPS & REMPLACEMENTS D'URGENCE :
   - Consultation des plannings de classe (get_class_timetable)
   - Recherche d'enseignants libres pour un remplacement immédiat (find_available_teachers)
   - Ajout de créneaux de cours (add_timetable_slot)
7. COMMUNICATION :
   - Publication d'annonces officielles école ou classe (post_announcement)

RÈGLES D'ACTION :
- Toutes les actions de modification (paiements, salaires, notes, inscriptions, annonces, pointages) déclenchent automatiquement un bouton de confirmation interactive pour l'administrateur.
- Réponds toujours dans la langue de l'administrateur (arabe tunisien, français ou anglais).
- Sois concise, percutante et professionnelle.`;

  // 6. Initialize Gemini Model with tools
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash",
    systemInstruction,
    tools: [
      {
        functionDeclarations: getGeminiFunctionDeclarations(),
      },
    ],
  });

  // Build chat contents
  // Exclude current message from history to prevent duplication
  const historyContents: any[] = [];
  for (const m of recentMessages.slice(0, -1)) {
    historyContents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    });
  }

  const currentTurnParts: any[] = [{ text: userMessage }];

  try {
    const chat = model.startChat({
      history: historyContents,
    });

    let response = await chat.sendMessage(currentTurnParts);
    let candidate = response.response;

    // Handle tool calling loop
    let functionCalls = candidate.functionCalls();

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

        // Send confirmation message with inline buttons
        await sendTelegramMessage(chatId, confirmText, {
          parse_mode: "Markdown",
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
        return;
      }

      // Read-only tool: execute immediately
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
          )}\n\nPrésente ces données à l'administrateur de manière claire, concise, utile et professionnelle en respectant sa langue.`,
        },
      ]);

      candidate = response.response;
      functionCalls = candidate.functionCalls();
    }

    // Final textual response
    const finalReply = candidate.text() || "Je reste à votre disposition pour toute autre question.";

    // Save reply to DB
    await prisma.aIMessage.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: finalReply,
      },
    });

    // Send message to Telegram
    await sendTelegramMessage(chatId, finalReply, {
      parse_mode: "Markdown",
    });
  } catch (err: any) {
    console.error("[Agent] Error running agent:", err);
    await sendTelegramMessage(
      chatId,
      `Désolée, une erreur est survenue lors du traitement : ${err.message || "Erreur interne"}`
    );
  }
}
