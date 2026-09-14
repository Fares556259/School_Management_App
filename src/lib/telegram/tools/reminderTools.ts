import prisma from "@/lib/prisma";
import { ToolContext } from "./readTools";
import { sendTelegramMessage } from "../telegram";
import { formatTelegramMessage } from "../formatter";
import { waitUntil } from "@vercel/functions";


export interface ScheduleReminderArgs {
  subject: string;
  delayMinutes?: number;
  targetTime?: string;
}

export interface GetRemindersArgs {
  limit?: number;
}

export interface CancelReminderArgs {
  query?: string;
  reminderId?: string;
}

/**
 * Deliver a single reminder by ID (idempotent, atomic)
 */
export async function deliverSingleReminder(reminderId: string): Promise<boolean> {
  try {
    // 1. Atomic lock: change status from PENDING to DELIVERING
    const claimed = await prisma.aIReminder.updateMany({
      where: { id: reminderId, status: "PENDING" },
      data: { status: "DELIVERING" },
    });

    if (claimed.count === 0) {
      return false; // Already delivered or cancelled
    }

    // 2. Fetch reminder details
    const reminder = await prisma.aIReminder.findUnique({
      where: { id: reminderId },
      include: {
        School: true,
      },
    });

    if (!reminder) return false;

    const timeStr = reminder.remindAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const alertMessage = formatTelegramMessage(
      `🔔 <b>RAPPEL PROGRAMMÉ DE HNIA !</b>
━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>Sujet :</b> <b>${reminder.subject}</b>
⏰ <b>Échéance convenue :</b> <code>${timeStr}</code>

<blockquote>💡 <b>Hnia :</b> C'est l'heure ! Vous m'aviez demandé de vous rappeler ceci. Bon travail ! 🚀</blockquote>`,
      reminder.School?.name
    );

    // 3. Send Telegram notification to the chat
    await sendTelegramMessage(reminder.chatId, alertMessage, {
      parse_mode: "HTML",
    });

    // 4. Mark as DELIVERED
    await prisma.aIReminder.update({
      where: { id: reminderId },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });

    return true;
  } catch (error) {
    console.error(`[Reminder] Failed to deliver reminder ${reminderId}:`, error);
    // Reset to PENDING so retry or dispatcher can pick it up
    await prisma.aIReminder.updateMany({
      where: { id: reminderId, status: "DELIVERING" },
      data: { status: "PENDING" },
    }).catch(() => null);
    return false;
  }
}

/**
 * Spawns the next hop asynchronously via HTTP fetch to /api/cron/dispatch-reminders
 */
export function chainToNextRelayHop(nextHop: number) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://www.snapschool.academy");

  fetch(`${appUrl}/api/cron/dispatch-reminders?hop=${nextHop}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-relay": "true",
    },
  }).catch((e) => {
    console.warn(`[Reminder Relay] Hop ${nextHop} fetch error (non-critical):`, e.message);
  });
}

/**
 * Executes or continues the precision reminder dispatcher relay.
 * Guaranteed to respect serverless limits (max ~25s per hop)
 * and self-perpetuates until all pending reminders within reach are dispatched.
 */
export async function runReminderRelay(hop = 1): Promise<number> {
  const MAX_HOPS = 40; // Supports continuous precision relay up to ~15-20 minutes
  if (hop > MAX_HOPS) return 0;

  try {
    // 1. Deliver all reminders that are already due now (remindAt <= now)
    let delivered = await dispatchPendingReminders();

    // 2. Find the earliest pending reminder
    const nextDue = await prisma.aIReminder.findFirst({
      where: {
        status: "PENDING",
      },
      orderBy: { remindAt: "asc" },
    });

    if (!nextDue) {
      return delivered; // No pending reminders — relay stops cleanly!
    }

    const waitMs = nextDue.remindAt.getTime() - Date.now();

    // If it's already due or due within 25 seconds, wait the exact time and deliver it!
    if (waitMs <= 25_000) {
      if (waitMs > 0) {
        await new Promise((r) => setTimeout(r, waitMs));
      }
      const ok = await deliverSingleReminder(nextDue.id);
      if (ok) delivered++;

      // Check if there are more pending reminders
      const remainingCount = await prisma.aIReminder.count({
        where: { status: "PENDING" },
      });

      if (remainingCount > 0) {
        chainToNextRelayHop(hop + 1);
      }
      return delivered;
    }

    // If it's due further out (> 25s, like 1m, 2m, etc.):
    // Sleep safely for 20 seconds, then spawn next hop
    await new Promise((r) => setTimeout(r, 20_000));
    chainToNextRelayHop(hop + 1);

    return delivered;
  } catch (err) {
    console.error("[Reminder Relay Error]:", err);
    return 0;
  }
}

/**
 * Check and dispatch all pending reminders whose remindAt <= now
 */
export async function dispatchPendingReminders(): Promise<number> {
  try {
    const dueReminders = await prisma.aIReminder.findMany({
      where: {
        status: "PENDING",
        remindAt: { lte: new Date() },
      },
      take: 20,
    });

    if (dueReminders.length === 0) return 0;

    let deliveredCount = 0;
    for (const reminder of dueReminders) {
      const ok = await deliverSingleReminder(reminder.id);
      if (ok) deliveredCount++;
    }

    return deliveredCount;
  } catch (error) {
    console.error("[Reminder Dispatcher] Error:", error);
    return 0;
  }
}

/**
 * Tool: schedule_reminder
 * Schedules an active reminder for the admin with automated Telegram alert
 */
export async function scheduleReminderTool(args: ScheduleReminderArgs, context: ToolContext) {
  const subject = (args.subject || "").trim();
  if (!subject) {
    return {
      error: true,
      message: "Veuillez préciser le sujet ou la tâche de ce rappel (ex: 'Vérifier la salle', 'Clôture de caisse').",
    };
  }

  const chatId = context.chatId;
  if (!chatId) {
    return {
      error: true,
      message: "Impossible d'identifier votre conversation Telegram pour ce rappel.",
    };
  }

  const now = new Date();
  let remindAt: Date;
  let delayMinutes = args.delayMinutes;

  if (delayMinutes && delayMinutes > 0) {
    remindAt = new Date(now.getTime() + Math.round(delayMinutes * 60 * 1000));
  } else if (args.targetTime && args.targetTime.trim()) {
    // Parse targetTime like "14:30" or "14h30" or "8:00"
    const cleaned = args.targetTime.replace(/h/i, ":").trim();
    const parts = cleaned.split(":");
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;

    if (!isNaN(hours) && hours >= 0 && hours <= 23) {
      const target = new Date(now);
      target.setHours(hours, minutes, 0, 0);

      // If target time is earlier today, schedule for tomorrow
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      remindAt = target;
      delayMinutes = Math.max(1, Math.round((remindAt.getTime() - now.getTime()) / (60 * 1000)));
    } else {
      // Default to 5 minutes
      delayMinutes = 5;
      remindAt = new Date(now.getTime() + 5 * 60 * 1000);
    }
  } else {
    // Default fallback: 2 minutes
    delayMinutes = 2;
    remindAt = new Date(now.getTime() + 2 * 60 * 1000);
  }

  // Save in database
  const record = await prisma.aIReminder.create({
    data: {
      schoolId: context.schoolId,
      adminId: context.adminId || null,
      chatId: chatId.toString(),
      subject,
      remindAt,
      status: "PENDING",
    },
  });

  // Kick off background precision relay
  try {
    waitUntil(runReminderRelay(1));
  } catch {
    runReminderRelay(1).catch(() => null);
  }

  const targetTimeDisplay = remindAt.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const dateDisplay = remindAt.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  });

  const delayLabel =
    delayMinutes === 1
      ? "1 minute"
      : delayMinutes < 60
      ? `${delayMinutes} minutes`
      : `${Math.floor(delayMinutes / 60)}h${delayMinutes % 60 ? (delayMinutes % 60) + "m" : ""}`;

  const formattedText = `⏰ <b>Rappel Programmé !</b>
━━━━━━━━━━━━━━━━━━━━━━
🎯 <b>Sujet :</b> ${subject}
⏱️ <b>Échéance :</b> Dans ${delayLabel} (à <code>${targetTimeDisplay}</code>)
📅 <b>Date :</b> <code>${dateDisplay}</code>

<blockquote>💡 <b>Hnia :</b> C'est bien noté ! Je veille au grain et je vous enverrai une alerte directement ici à l'heure convenue. Restons concentrés ! ⏰</blockquote>`;

  return {
    success: true,
    reminderId: record.id,
    subject,
    remindAt: record.remindAt,
    delayMinutes,
    formattedText,
    message: formattedText,
  };
}

/**
 * Tool: get_reminders
 * List pending reminders for the current admin
 */
export async function getRemindersTool(args: GetRemindersArgs, context: ToolContext) {
  const reminders = await prisma.aIReminder.findMany({
    where: {
      schoolId: context.schoolId,
      status: "PENDING",
    },
    orderBy: { remindAt: "asc" },
    take: Math.min(args.limit || 10, 20),
  });

  if (reminders.length === 0) {
    const emptyText = `⏰ <b>Rappels Programmés</b>
━━━━━━━━━━━━━━━━━━━━━━
Aucun rappel en attente pour le moment.

<blockquote>💡 <b>Hnia :</b> Dites-moi simplement : <i>« Hnia rappelle-moi dans 15 minutes d'appeler le prof de français »</i> ou <i>« فكرني بعد درجين »</i>.</blockquote>`;
    return {
      success: true,
      count: 0,
      reminders: [],
      formattedText: emptyText,
      message: emptyText,
    };
  }

  const lines = reminders.map((r, idx) => {
    const timeStr = r.remindAt.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    const dateStr = r.remindAt.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
    const diffMin = Math.round((r.remindAt.getTime() - Date.now()) / (60 * 1000));
    const countLabel = diffMin <= 0 ? "Imminent" : `Dans ~${diffMin} min`;
    return `<b>${idx + 1}.</b> <b>${r.subject}</b>\n   📅 <code>${dateStr} à ${timeStr}</code> (${countLabel})`;
  });

  const formattedText = `⏰ <b>Rappels Programmés en Attente (${reminders.length})</b>
━━━━━━━━━━━━━━━━━━━━━━
Voici vos prochains rappels prévus :

${lines.join("\n\n")}

<blockquote>💡 <b>Hnia :</b> Pour annuler un rappel, dites simplement : <i>« Annule le rappel [sujet] »</i>.</blockquote>`;

  return {
    success: true,
    count: reminders.length,
    reminders,
    formattedText,
    message: formattedText,
  };
}

/**
 * Tool: cancel_reminder
 * Cancel a pending reminder
 */
export async function cancelReminderTool(args: CancelReminderArgs, context: ToolContext) {
  const query = (args.query || "").trim();
  const reminderId = args.reminderId?.trim();

  if (!query && !reminderId) {
    return {
      error: true,
      message: "Veuillez préciser quel rappel vous souhaitez annuler.",
    };
  }

  const where: any = {
    schoolId: context.schoolId,
    status: "PENDING",
  };

  if (reminderId) {
    where.id = reminderId;
  } else if (query.toLowerCase() === "tous" || query.toLowerCase() === "tout") {
    // Clear all pending
  } else {
    where.subject = {
      contains: query,
      mode: "insensitive",
    };
  }

  const found = await prisma.aIReminder.findMany({ where });

  if (found.length === 0) {
    const notFoundText = `🔍 <b>Aucun rappel correspondant trouvé</b>
━━━━━━━━━━━━━━━━━━━━━━
Je n'ai trouvé aucun rappel en attente pour <i>« ${query} »</i>.`;
    return {
      success: false,
      notFound: true,
      formattedText: notFoundText,
      message: notFoundText,
    };
  }

  await prisma.aIReminder.updateMany({
    where: {
      id: { in: found.map((f) => f.id) },
    },
    data: {
      status: "CANCELLED",
    },
  });

  const cancelledList = found.map((f) => `• <s>${f.subject}</s>`).join("\n");

  const formattedText = `🗑️ <b>Rappel(s) Annulé(s) (${found.length})</b>
━━━━━━━━━━━━━━━━━━━━━━
Les rappels suivants ont été annulés :

${cancelledList}

<blockquote>💡 <b>Hnia :</b> Vous ne recevrez pas de notification pour ces éléments.</blockquote>`;

  return {
    success: true,
    count: found.length,
    formattedText,
    message: formattedText,
  };
}
