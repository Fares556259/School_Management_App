import prisma from "@/lib/prisma";
import { answerTelegramCallbackQuery, editTelegramMessageText } from "./telegram";
import { formatTelegramMessage } from "./formatter";
import { TOOLS } from "./tools";
import { ToolContext } from "./tools/readTools";
import { deliverTuitionReceipt, deliverSalaryPayslip } from "./tools/documentTools";

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

  // 4. Atomic idempotency guard: atomically claim PENDING → EXECUTING
  // This prevents double-execution if user double-taps or Telegram retries.
  if (toolCall.status === "EXECUTED") {
    await answerTelegramCallbackQuery(queryId, "Cette action a déjà été exécutée.");
    return;
  }

  if (toolCall.status === "REJECTED") {
    await answerTelegramCallbackQuery(queryId, "Cette action a déjà été annulée.");
    return;
  }

  if (toolCall.status === "EXECUTING") {
    await answerTelegramCallbackQuery(queryId, "Cette action est déjà en cours d'exécution.");
    return;
  }

  // Atomically transition PENDING → EXECUTING (prevents race condition on double-tap)
  const claimed = await prisma.aIToolCall.updateMany({
    where: { id: toolCallId, status: "PENDING" },
    data: { status: "EXECUTING" },
  });
  if (claimed.count === 0) {
    await answerTelegramCallbackQuery(queryId, "Cette action est déjà en cours ou a été traitée.");
    return;
  }

  // 5. Handle cancellation
  if (action === "cancel") {
    try {
      await prisma.aIToolCall.update({
        where: { id: toolCallId },
        data: { status: "REJECTED" },
      });
      await answerTelegramCallbackQuery(queryId, "Action annulée");

      if (toolCall.conversationId) {
        await prisma.aIMessage.create({
          data: {
            conversationId: toolCall.conversationId,
            role: "assistant",
            content: `❌ L'administrateur a annulé l'action ${toolCall.toolName}.`,
          },
        });
      }
    } catch (cancelErr) {
      console.error("[Confirmation] Cancel DB update error:", cancelErr);
    }
    try {
      const cancelMsg = formatTelegramMessage(
        `❌ **Action annulée** par l'administrateur.\nAucune modification n'a été effectuée.`
      );
      await editTelegramMessageText(chatId, messageId, cancelMsg, { parse_mode: "HTML" });
    } catch (editErr) {
      console.warn("[Confirmation] Failed to edit cancel message (non-critical):", editErr);
    }
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
      chatId: String(chatId),
    };

    // STEP A: Execute the tool — separate from UI update to prevent state inversion
    let executionResult: any;
    let toolError: any = null;
    try {
      const args = toolCall.arguments as Record<string, any>;
      executionResult = await tool.execute(args, context);

      // Mark EXECUTED only after confirmed success
      await prisma.aIToolCall.update({
        where: { id: toolCallId },
        data: {
          status: "EXECUTED",
          result: executionResult,
          confirmedAt: new Date(),
          executedAt: new Date(),
        },
      });

      // Persist completed action result into conversation memory so subsequent turns recall it
      if (toolCall.conversationId) {
        try {
          const rawConfirmationMsg =
            executionResult?.message || `✅ Action ${toolCall.toolName} exécutée avec succès.`;
          await prisma.aIMessage.create({
            data: {
              conversationId: toolCall.conversationId,
              role: "assistant",
              content: rawConfirmationMsg,
            },
          });
        } catch (memErr) {
          console.warn("[Confirmation] Memory logging error:", memErr);
        }
      }
    } catch (err: any) {
      toolError = err;
      console.error("[Confirmation] Tool execution error:", err);
      try {
        await prisma.aIToolCall.update({
          where: { id: toolCallId },
          data: { status: "FAILED", result: { error: err.message } },
        });

        if (toolCall.conversationId) {
          await prisma.aIMessage.create({
            data: {
              conversationId: toolCall.conversationId,
              role: "assistant",
              content: `⚠️ Erreur lors de l'exécution de ${toolCall.toolName} : ${err.message}`,
            },
          });
        }
      } catch (dbErr) {
        console.error("[Confirmation] Failed to mark tool as FAILED in DB:", dbErr);
      }
    }

    // STEP B: Update Telegram UI — independent try/catch so UI failure doesn't corrupt DB state
    try {
      if (toolError) {
        const errorMsg = formatTelegramMessage(
          `⚠️ **Erreur lors de l'exécution :**\n${toolError.message || "Une erreur inconnue est survenue."}`
        );
        await editTelegramMessageText(chatId, messageId, errorMsg, { parse_mode: "HTML" });
      } else {
        const rawConfirmationMsg =
          executionResult?.message || `✅ Action **${toolCall.toolName}** exécutée avec succès.`;
        const confirmationMsg = formatTelegramMessage(rawConfirmationMsg, tgAccount.School.name);
        await editTelegramMessageText(chatId, messageId, confirmationMsg, { parse_mode: "HTML" });
      }
    } catch (editErr) {
      console.warn("[Confirmation] Failed to edit Telegram message (non-critical — action already saved to DB):", editErr);
    }

    // STEP C: Automatically generate & deliver official PDF document (Receipt / Payslip)
    if (!toolError && executionResult?.success) {
      try {
        const schoolName = tgAccount.School.name;
        const schoolId = tgAccount.schoolId;
        const adminName = context.adminName;
        const args = (toolCall.arguments || {}) as Record<string, any>;
        const data = executionResult.data || {};

        if (toolCall.toolName === "record_payment") {
          const studentId = data.studentId;
          if (studentId) {
            await deliverTuitionReceipt({
              studentId,
              schoolId,
              schoolName,
              adminName,
              chatId,
              month: data.targetMonth || args.month,
              year: data.targetYear || args.year,
              amountOverride: data.amount || args.amount,
              paymentMethod: data.paymentMethod || args.paymentMethod,
              checkNumber: data.checkNumber || args.checkNumber,
              bankName: data.bankName || args.bankName,
            });
          }
        } else if (toolCall.toolName === "record_parent_payment") {
          const allocations = data.allocations || [];
          for (const alloc of allocations) {
            if (alloc.studentId && alloc.amount > 0) {
              await deliverTuitionReceipt({
                studentId: alloc.studentId,
                schoolId,
                schoolName,
                adminName,
                chatId,
                month: args.month,
                year: args.year,
                amountOverride: alloc.amount,
              });
            }
          }
        } else if (toolCall.toolName === "recover_partial_payment") {
          const studentId = data.studentId;
          if (studentId) {
            await deliverTuitionReceipt({
              studentId,
              schoolId,
              schoolName,
              adminName,
              chatId,
              month: args.month,
              year: args.year,
              amountOverride: data.recoveredAmount || args.amount,
            });
          }
        } else if (toolCall.toolName === "pay_teacher_salary") {
          const teacherId = data.teacherId;
          if (teacherId) {
            await deliverSalaryPayslip({
              employeeId: teacherId,
              employeeType: "TEACHER",
              schoolId,
              schoolName,
              adminName,
              chatId,
              month: data.month || args.month,
              year: data.year || args.year,
              amountOverride: data.amount || args.amount,
              isAdvance: data.isAdvance,
              missedHours: data.missedHours,
              deductionsAmount: data.deductionAmount,
              remainingAfter: data.remainingAfter,
            });
          }
        } else if (toolCall.toolName === "pay_staff_salary") {
          const staffId = data.staffId;
          if (staffId) {
            await deliverSalaryPayslip({
              employeeId: staffId,
              employeeType: "STAFF",
              schoolId,
              schoolName,
              adminName,
              chatId,
              month: data.month || args.month,
              year: data.year || args.year,
              amountOverride: data.amount || args.amount,
              isAdvance: data.isAdvance,
              remainingAfter: data.remainingAfter,
            });
          }
        }
      } catch (pdfErr) {
        console.warn("[Confirmation] Automatic PDF delivery error (non-critical):", pdfErr);
      }
    }
  }
}
