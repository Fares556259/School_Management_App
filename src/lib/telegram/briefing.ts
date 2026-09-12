import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "./telegram";
import { getAttendanceTool, getPaymentsTool } from "./tools/readTools";

/**
 * Generates and sends a morning operational briefing to a linked administrator.
 */
export async function sendDailyBriefing(telegramAccountId: string): Promise<boolean> {
  const account = await prisma.telegramAccount.findUnique({
    where: { id: telegramAccountId },
    include: {
      admin: true,
      School: true,
    },
  });

  if (!account || !account.dailyBriefing) {
    return false;
  }

  const adminName =
    [account.admin.name, account.admin.surname].filter(Boolean).join(" ") ||
    account.admin.username;

  const now = new Date();
  const todayStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const context = {
    schoolId: account.schoolId,
    adminId: account.adminId,
    adminName,
    language: account.language || "fr",
  };

  // Fetch today's attendance snapshot
  const attendance = await getAttendanceTool({}, context);

  // Fetch this month's payments snapshot
  const payments = await getPaymentsTool(
    { month: now.getMonth() + 1, year: now.getFullYear() },
    context
  );

  // Fetch exams scheduled for today or next 2 days
  const in3Days = new Date(now);
  in3Days.setDate(in3Days.getDate() + 3);

  const upcomingExams = await prisma.exam.findMany({
    where: {
      schoolId: account.schoolId,
      startTime: {
        gte: now,
        lte: in3Days,
      },
    },
    include: {
      lesson: {
        include: {
          subject: true,
          class: true,
        },
      },
    },
    take: 5,
    orderBy: { startTime: "asc" },
  });

  const isArabic = account.language === "ar";

  let text: string;

  if (isArabic) {
    text = `☀️ **صباح الخير ${adminName} !**
إليك ملخص عمليات اليوم في **${account.School.name}** (${todayStr}) :

📍 **الحضور والغياب :**
• غيابات مسجلة اليوم : **${attendance.summary.absentCount}**
• تأخيرات : **${attendance.summary.lateCount}**

💰 **متابعة الرسوم المدرسية (الشهر الحالي) :**
• اشتراكات مدفوعة : **${payments.overview.paidCount}** (${payments.overview.paidAmount} د.ت)
• اشتراكات معلقة : **${payments.overview.unpaidCount}** (${payments.overview.unpaidAmount} د.ت)`;

    if (upcomingExams.length > 0) {
      text += `\n\n📝 **الامتحانات القادمة (خلال 3 أيام) :**\n` +
        upcomingExams
          .map(
            (e) =>
              `• ${e.title} (${e.lesson.class.name} - ${e.lesson.subject.name})`
          )
          .join("\n");
    }

    text += `\n\n💬 _أنا في انتظارك، أرسل لي أي رسالة أو تسجيل صوتي لإدارة شؤون مدرستك !_`;
  } else {
    text = `☀️ **Bonjour ${adminName} !**
Voici le point opérationnel du jour pour **${account.School.name}** (${todayStr}) :

📍 **Présences du jour :**
• Absents signalés : **${attendance.summary.absentCount}** élève(s)
• Retards : **${attendance.summary.lateCount}** élève(s)

💰 **Frais de scolarité (Mois en cours) :**
• Règlements perçus : **${payments.overview.paidCount}** (${payments.overview.paidAmount} DT)
• Frais en attente : **${payments.overview.unpaidCount}** (${payments.overview.unpaidAmount} DT)`;

    if (upcomingExams.length > 0) {
      text += `\n\n📝 **Examens prévus (prochains 3 jours) :**\n` +
        upcomingExams
          .map(
            (e) =>
              `• ${e.title} (${e.lesson.class.name} - ${e.lesson.subject.name})`
          )
          .join("\n");
    }

    text += `\n\n💬 _Envoyez-moi un message ou une note vocale à tout moment pour agir ou consulter vos données !_`;
  }

  // Find active chat or use telegramId as chat ID (for 1-on-1 private bots, user ID is the chat ID)
  await sendTelegramMessage(account.telegramId, text, {
    parse_mode: "Markdown",
  });

  return true;
}

/**
 * Dispatches morning briefings to all active accounts with dailyBriefing enabled
 */
export async function sendDailyBriefingsAll(): Promise<{ sent: number; total: number }> {
  const accounts = await prisma.telegramAccount.findMany({
    where: {
      dailyBriefing: true,
      NOT: {
        telegramId: { startsWith: "pending_" },
      },
    },
  });

  let sent = 0;
  for (const acc of accounts) {
    try {
      const ok = await sendDailyBriefing(acc.id);
      if (ok) sent++;
    } catch (err) {
      console.error(`[Briefing] Failed for account ${acc.id}:`, err);
    }
  }

  return { sent, total: accounts.length };
}
