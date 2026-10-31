import prisma from "@/lib/prisma";
import type { Prisma } from '@prisma/client';
import { TOOLS } from "@/lib/telegram/tools";
import { ToolContext } from "@/lib/telegram/tools/readTools";
import { cleanTelegramFormattingForMobile } from "./mobileFormatting";
import { prepareConfirmedArguments, isActionExpired, requiresActionConfirmation } from "./actionPolicy";
import { actionReviewFingerprint, sameActionArguments } from './actionReview';
import { buildActionCardMetadata } from './actionCards';
import { outputText } from './outputLanguage';

type ActionStatus = "PENDING" | "EXECUTING" | "EXECUTED" | "REJECTED" | "FAILED" | "EXPIRED";

/** The only mobile entry point allowed to execute a proposed change. */
export async function confirmMobileAction(params: {
  toolCallId: string;
  action: "confirm" | "cancel";
  adminId: string;
  schoolId: string;
  updatedArgs?: Record<string, any>;
  reviewFingerprint?: string;
  language?: string;
}) {
  const { toolCallId, action, adminId, schoolId, updatedArgs, reviewFingerprint, language = 'fr' } = params;
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
    message: outputText(language, message,
      status === 'EXECUTED' ? 'The action was recorded successfully.' : status === 'REJECTED' ? 'Action cancelled. No data was changed.' : status === 'EXECUTING' ? 'Check the action status before trying again.' : 'The action could not be recorded. Review its status and details.',
      status === 'EXECUTED' ? 'تم تسجيل العملية بنجاح.' : status === 'REJECTED' ? 'أُلغيت العملية. لم تُعدَّل أي بيانات.' : status === 'EXECUTING' ? 'يرجى التحقق من حالة العملية قبل إعادة المحاولة.' : 'تعذّر تسجيل العملية. يرجى مراجعة حالتها وتفاصيلها.'),
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
    await prisma.aIMessage.create({ data: { conversationId: toolCall.conversationId, role: "assistant", content: outputText(language, 'Action annulée. Aucune modification effectuée.', 'Action cancelled. No data was changed.', 'أُلغيت العملية. لم تُعدَّل أي بيانات.') } }).catch(() => null);
    return resultFor("REJECTED", "Action annulée. Aucune modification effectuée.");
  }
  if (isActionExpired(toolCall.createdAt)) {
    await prisma.aIToolCall.updateMany({ where: { id: toolCallId, status: "PENDING", ...ownership }, data: { status: "EXPIRED" } });
    return resultFor("EXPIRED", "Cette proposition a expiré. Préparez une nouvelle demande pour vérifier les détails.");
  }
  let args: Record<string, any>;
  try { args = prepareConfirmedArguments(tool, toolCall.arguments, updatedArgs); }
  catch (error: any) { return { success: false, message: error.message, actionStatus: "PENDING" as ActionStatus }; }

  const review = (message: string, reviewedArgs = toolCall.arguments as Record<string, any>, display: any = (toolCall.result as any)?.proposalDisplay) => ({
    success: false, actionStatus: 'PENDING' as ActionStatus, reviewRequired: true,
    message: outputText(language, message, 'Review the updated details, then press Confirm again. No action has been executed.', 'يرجى مراجعة التفاصيل المحدّثة ثم الضغط على «تأكيد» مجدداً. لم تُنفَّذ أي عملية بعد.'),
    proposal: buildActionCardMetadata(toolCall.id, toolCall.toolName, reviewedArgs, outputText(language, message, 'Review the updated details before confirming.', 'يرجى مراجعة التفاصيل المحدّثة قبل التأكيد.'), display || undefined),
  });
  if (reviewFingerprint !== actionReviewFingerprint(toolCall.id, toolCall.toolName, toolCall.arguments)) {
    return review('Vérifiez cette version de la proposition puis confirmez à nouveau. Si nécessaire, mettez votre application à jour.');
  }
  // Editing and executing are distinct decisions. The next card reflects saved, validated edits.
  if (!sameActionArguments(args, toolCall.arguments)) {
    const previousArgs = toolCall.arguments as Record<string, any>;
    const targetChanged = args.studentNameOrId !== previousArgs.studentNameOrId || args.parentNameOrId !== previousArgs.parentNameOrId;
    const revised = await prisma.aIToolCall.updateMany({
      where: { id: toolCallId, status: 'PENDING', arguments: { equals: toolCall.arguments as Prisma.InputJsonValue }, ...ownership },
      data: { arguments: args, ...(targetChanged ? { result: {} } : {}) },
    });
    if (!revised.count) return { success: false, actionStatus: 'PENDING' as ActionStatus, message: 'Cette proposition a changé sur un autre appareil. Actualisez la discussion.' };
    return review('Modifications préparées. Vérifiez les nouveaux détails puis appuyez sur Confirmer. Aucune action exécutée.', args, targetChanged ? null : (toolCall.result as any)?.proposalDisplay);
  }

  // Only one explicit button request can claim the proposal, even across concurrent taps/devices.
  const claimed = await prisma.aIToolCall.updateMany({
    where: { id: toolCallId, status: "PENDING", requiresConfirm: true, arguments: { equals: toolCall.arguments as Prisma.InputJsonValue }, ...ownership },
    data: { status: "EXECUTING", confirmedAt: new Date(), arguments: args },
  });
  if (!claimed.count) {
    const latest = await prisma.aIToolCall.findUnique({ where: { id: toolCallId }, include: { conversation: { include: { admin: true } } } });
    if (!latest || latest.conversation.adminId !== adminId || latest.conversation.admin?.schoolId !== schoolId || latest.conversation.status === 'DELETED') return { success: false, message: 'Cette action n’est plus accessible à votre compte.' };
    if (latest?.status === 'PENDING') return review('La proposition a changé. Vérifiez ces détails avant de confirmer.', latest.arguments as Record<string, any>);
    return resultFor((latest?.status || 'EXECUTING') as ActionStatus, 'La décision a changé. Actualisez la discussion pour vérifier son résultat.', latest?.result);
  }

  const admin = toolCall.conversation.admin!;
  const context: ToolContext = { schoolId, adminId, language, adminName: [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username || "Admin" };
  let executionFinished = false;
  try {
    const result = await tool.execute(args, context);
    const failed = !result || result.success === false || Boolean(result.error);
    executionFinished = !failed;
    const message = outputText(language, cleanTelegramFormattingForMobile(result?.message || result?.formattedText || (failed ? "L'action n'a pas pu être enregistrée." : 'Action enregistrée avec succès.')), failed ? 'The action could not be recorded. Check its status before trying again.' : 'The action was recorded successfully.', failed ? 'تعذّر تسجيل العملية. يرجى التحقق من حالتها قبل إعادة المحاولة.' : 'تم تسجيل العملية بنجاح.');
    await prisma.aIToolCall.update({ where: { id: toolCallId }, data: {
      status: failed ? "FAILED" : "EXECUTED", result: { ...result, ...((toolCall.result as any)?.proposalDisplay ? { proposalDisplay: (toolCall.result as any).proposalDisplay } : {}) },
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
