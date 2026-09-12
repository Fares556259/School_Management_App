import prisma from "@/lib/prisma";
import { answerTelegramCallbackQuery, editTelegramMessageText } from "./telegram";
import { TOOLS } from "./tools";
import { ToolContext } from "./tools/readTools";

export interface CallbackQueryPayload {
  id: string;
  from: {
    id: number | string;
    username?: string;
    first_name?: string;
  };
  message?: {
    message_id: number;
    chat: {
      id: number | string;
    };
    text?: string;
  };
  data?: string;
}

/**
 * Handles confirmation or cancellation of pending write tool calls from inline keyboards.
 */
export async function handleConfirmationCallback(
  callbackQuery: CallbackQueryPayload
): Promise<void> {
  const queryId = callbackQuery.id;
  const telegramId = callbackQuery.from.id.toString();
  const data = callbackQuery.data || "";
  const messageId = callbackQuery.message?.message_id;
  const chatId = callbackQuery.message?.chat.id;

  if (!data || !messageId || !chatId) {
    await answerTelegramCallbackQuery(queryId, "Erreur de callback");
    return;
  }

  // Parse action and toolCallId: format is "confirm:<id>" or "cancel:<id>"
  const [action, toolCallId] = data.split(":");
  if (!toolCallId || (action !== "confirm" && action !== "cancel")) {
    await answerTelegramCallbackQuery(queryId, "Action non reconnue");
    return;
  }

  // 1. Verify user is linked
  const tgAccount = await prisma.telegramAccount.findUnique({
    where: { telegramId },
    include: {
      admin: true,
      School: true,
    },
  });

  if (!tgAccount) {
    await answerTelegramCallbackQuery(queryId, "Compte non associé à SnapSchool", true);
    return;
  }

  // 2. Load the tool call record
  const toolCall = await prisma.aIToolCall.findUnique({
    where: { id: toolCallId },
    include: {
      conversation: {
        include: {
          telegramAccount: true,
        },
      },
    },
  });

  if (!toolCall) {
    await answerTelegramCallbackQuery(queryId, "Action introuvable ou expirée", true);
    return;
  }

  // 3. Multi-tenant security guard: Verify this tool call belongs to this user's school
  if (toolCall.conversation.telegramAccount.schoolId !== tgAccount.schoolId) {
    await answerTelegramCallbackQuery(queryId, "Accès non autorisé", true);
    return;
  }

  // 4. Check idempotency: Has this action already been processed?
  if (toolCall.status === "EXECUTED") {
    await answerTelegramCallbackQuery(queryId, "Cette action a déjà été exécutée.");
    return;
  }

  if (toolCall.status === "REJECTED") {
    await answerTelegramCallbackQuery(queryId, "Cette action a déjà été annulée.");
    return;
  }

  // 5. Handle cancellation
  if (action === "cancel") {
    await prisma.aIToolCall.update({
      where: { id: toolCallId },
      data: {
        status: "REJECTED",
      },
    });

    await answerTelegramCallbackQuery(queryId, "Action annulée");
    await editTelegramMessageText(
      chatId,
      messageId,
      `❌ **Action annulée** par l'administrateur.\nAucune modification n'a été effectuée.`
    );
    return;
  }

  // 6. Handle confirmation
  if (action === "confirm") {
    const tool = TOOLS[toolCall.toolName];
    if (!tool) {
      await answerTelegramCallbackQuery(queryId, "Outil introuvable", true);
      return;
    }

    await answerTelegramCallbackQuery(queryId, "Exécution en cours...");

    const context: ToolContext = {
      schoolId: tgAccount.schoolId,
      adminId: tgAccount.adminId,
      adminName:
        [tgAccount.admin.name, tgAccount.admin.surname].filter(Boolean).join(" ") ||
        tgAccount.admin.username,
      language: tgAccount.language,
    };

    try {
      const args = toolCall.arguments as Record<string, any>;
      const executionResult = await tool.execute(args, context);

      // Mark tool call as EXECUTED
      await prisma.aIToolCall.update({
        where: { id: toolCallId },
        data: {
          status: "EXECUTED",
          result: executionResult,
          confirmedAt: new Date(),
          executedAt: new Date(),
        },
      });

      // Update message in Telegram to show completed confirmation
      const confirmationMsg =
        executionResult.message || `✅ Action **${toolCall.toolName}** exécutée avec succès.`;

      await editTelegramMessageText(chatId, messageId, confirmationMsg);
    } catch (err: any) {
      console.error("[Confirmation] Tool execution error:", err);

      await prisma.aIToolCall.update({
        where: { id: toolCallId },
        data: {
          status: "FAILED",
          result: { error: err.message },
        },
      });

      await editTelegramMessageText(
        chatId,
        messageId,
        `⚠️ **Erreur lors de l'exécution :**\n${err.message || "Une erreur inconnue est survenue."}`
      );
    }
  }
}
