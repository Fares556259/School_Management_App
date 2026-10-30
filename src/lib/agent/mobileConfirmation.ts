import prisma from "@/lib/prisma";
import { TOOLS } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { cleanTelegramFormattingForMobile } from "./mobileFormatting";
import { prepareConfirmedArguments, isActionExpired, requiresActionConfirmation } from "./actionPolicy";

type ActionStatus = "PENDING" | "EXECUTING" | "EXECUTED" | "REJECTED" | "FAILED" | "EXPIRED";

/** The only mobile entry point allowed to execute a proposed change. */
export async function confirmMobileAction(params: {
  toolCallId: string;
  action: "confirm" | "cancel";
  adminId: string;
  schoolId: string;
  updatedArgs?: Record<string, any>;
}) {
  const { toolCallId, action, adminId, schoolId, updatedArgs } = params;
  if (action !== "confirm" && action !== "cancel") return { success: false, message: "Décision invalide." };
  const toolCall = await prisma.aIToolCall.findUnique({
    where: { id: toolCallId },
    include: { conversation: { include: { admin: true } } },
  });
  if (!toolCall || toolCall.conversation.adminId !== adminId ||
      toolCall.conversation.admin?.schoolId !== schoolId || toolCall.conversation.status === "DELETED") {
    return { success: false, message: "Action introuvable ou non autorisée pour votre compte." };
  }
  const resultFor = (status: ActionStatus, message: string, result?: any) => ({
    success: status === "EXECUTED" ? action === "confirm" : status === "REJECTED" && action === "cancel",
    message,
    actionStatus: status,
    result,
    undoExpenseId: status === 'EXECUTED' && toolCall.toolName === 'add_expense' && Number.isInteger(result?.data?.expenseId) ? result.data.expenseId : undefined,
    actionResult: {
      reference: `ACT-${toolCall.id}`,
      summary: message,
      timestamp: (toolCall.executedAt || new Date()).toISOString(),
      status,
    },
  });
  if (toolCall.status !== "PENDING") {
    const messages: Record<string, string> = {
      EXECUTED: "Cette action a déjà été exécutée avec succès.",
      REJECTED: "Cette action a été annulée. Aucune nouvelle exécution n'est autorisée.",
      EXECUTING: "Cette action est en cours. Vérifiez son résultat avant de réessayer.",
      FAILED: "Cette action a échoué. Vérifiez les données puis préparez une nouvelle demande.",
      EXPIRED: "Cette proposition a expiré. Préparez une nouvelle demande pour vérifier les détails.",
    };
    return resultFor((toolCall.status in messages ? toolCall.status : "FAILED") as ActionStatus, messages[toolCall.status] || "Action indisponible.", toolCall.result);
  }
  const tool = TOOLS[toolCall.toolName];
  if (!toolCall.requiresConfirm || !tool || !requiresActionConfirmation(toolCall.toolName, tool)) {
    return { success: false, message: "Cette action ne possède pas de demande de confirmation valide." };
  }
  const ownership = { conversation: { adminId, admin: { schoolId }, status: { not: "DELETED" } } };
  if (action === "cancel") {
    const cancelled = await prisma.aIToolCall.updateMany({
      where: { id: toolCallId, status: "PENDING", ...ownership }, data: { status: "REJECTED" },
    });
    if (!cancelled.count) return { success: false, message: "La décision a changé. Actualisez la discussion." };
    await prisma.aIMessage.create({ data: { conversationId: toolCall.conversationId, role: "assistant", content: `L'action ${toolCall.toolName} a été annulée.` } }).catch(() => null);
    return resultFor("REJECTED", "Action annulée. Aucune modification effectuée.");
  }
  if (isActionExpired(toolCall.createdAt)) {
    await prisma.aIToolCall.updateMany({ where: { id: toolCallId, status: "PENDING", ...ownership }, data: { status: "EXPIRED" } });
    return resultFor("EXPIRED", "Cette proposition a expiré. Préparez une nouvelle demande pour vérifier les détails.");
  }
  let args: Record<string, any>;
  try { args = prepareConfirmedArguments(tool, toolCall.arguments, updatedArgs); }
  catch (error: any) { return { success: false, message: error.message, actionStatus: "PENDING" as ActionStatus }; }

  // Only one explicit button request can claim the proposal, even across concurrent taps/devices.
  const claimed = await prisma.aIToolCall.updateMany({
    where: { id: toolCallId, status: "PENDING", requiresConfirm: true, ...ownership },
    data: { status: "EXECUTING", confirmedAt: new Date(), arguments: args },
  });
  if (!claimed.count) return resultFor("EXECUTING", "Cette action a déjà été prise en charge. Actualisez la discussion.");

  const admin = toolCall.conversation.admin!;
  const context: ToolContext = { schoolId, adminId, language: "fr", adminName: [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username || "Admin" };
  let executionFinished = false;
  try {
    const result = await tool.execute(args, context);
    const failed = !result || result.success === false || Boolean(result.error);
    executionFinished = !failed;
    const message = cleanTelegramFormattingForMobile(result?.message || result?.formattedText || (failed ? "L'action n'a pas pu être enregistrée." : `Action ${toolCall.toolName} exécutée avec succès.`));
    await prisma.aIToolCall.update({ where: { id: toolCallId }, data: {
      status: failed ? "FAILED" : "EXECUTED", result,
      ...(failed ? {} : { executedAt: new Date() }),
    } });
    // A history failure must never turn a completed write into a retryable failed write.
    await prisma.aIMessage.create({ data: { conversationId: toolCall.conversationId, role: "assistant", content: message } }).catch(error => console.warn("[MobileAgent] Action history unavailable", error));
    return resultFor(failed ? "FAILED" : "EXECUTED", message, result);
  } catch (error: any) {
    console.error("[MobileAgent] Confirmed action error:", error);
    if (executionFinished) return resultFor("EXECUTING", "L'action a été traitée mais sa vérification est indisponible. Vérifiez les données avant toute nouvelle demande.");
    await prisma.aIToolCall.update({ where: { id: toolCallId }, data: { status: "FAILED", result: { error: "EXECUTION_FAILED" } } }).catch(() => null);
    return resultFor("FAILED", "L'action n'a pas pu être confirmée. Vérifiez son résultat avant de préparer une nouvelle demande.");
  }
}
