import prisma from "@/lib/prisma";
import { sendTelegramMessage } from "./telegram";
import { getAttendanceTool, getPaymentsTool } from "./tools/readTools";
import { formatTelegramMessage } from "./formatter";

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
    text = `🏛️ <b>SNAPSCHOOL</b> │ <b>ملخص العمليات الصباحي</b>
━━━━━━━━━━━━━━━━━━━━━━
☀️ <b>صباح الخير ${adminName} !</b>
📅 <code>${todayStr}</code> • 🏫 <b>${account.School.name}</b>

📍 <b>الحضور والغياب :</b>
• غيابات مسجلة : <code>${attendance.summary.absentCount}</code>
• تأخيرات : <code>${attendance.summary.lateCount}</code>

💰 <b>الرسوم المدرسية (الشهر الحالي) :</b>
• مدفوع : <code>${payments.overview.paidAmount} DT</code> (${payments.overview.paidCount} تلميذ ✅)
• معلق : <code>${payments.overview.unpaidAmount} DT</code> (${payments.overview.unpaidCount} تلميذ ⏳)`;

    if (upcomingExams.length > 0) {
      text += `\n\n📝 <b>الامتحانات القادمة (خلال 3 أيام) :</b>\n` +
        upcomingExams
          .map(
            (e) =>
              `• <b>${e.title}</b> (<code>${e.lesson.class.name}</code> - <i>${e.lesson.subject.name}</i>)`
          )
          .join("\n");
    }

    text += `\n\n<blockquote>💡 <b>هنية :</b> جاهزة لمساعدتك في أي لحظة. أرسل رسالة أو تسجيلاً صوتياً للبدء !</blockquote>`;
  } else {
    text = `🏛️ <b>SNAPSCHOOL</b> │ <b>BRIEFING EXÉCUTIF DU MATIN</b>
━━━━━━━━━━━━━━━━━━━━━━
☀️ <b>Bonjour ${adminName} !</b>
📅 <code>${todayStr}</code> • 🏫 <b>${account.School.name}</b>

📍 <b>Présences & Vie Scolaire :</b>
• Absents signalés : <code>${attendance.summary.absentCount} élève(s)</code>
• Retards : <code>${attendance.summary.lateCount} élève(s)</code>

💰 <b>Frais de Scolarité (Mois en cours) :</b>
• Encaissé : <code>+${payments.overview.paidAmount} DT</code> (${payments.overview.paidCount} soldés 🟢)
• En attente : <code>${payments.overview.unpaidAmount} DT</code> (${payments.overview.unpaidCount} élèves ⏳)`;

    if (upcomingExams.length > 0) {
      text += `\n\n📝 <b>Examens Prévus (Prochains 3 jours) :</b>\n` +
        upcomingExams
          .map(
            (e) =>
              `• <b>${e.title}</b> (<code>${e.lesson.class.name}</code> - <i>${e.lesson.subject.name}</i>)`
          )
          .join("\n");
    }

    text += `\n\n<blockquote>💡 <b>Hnia :</b> Journée opérationnelle lancée. Utilisez les boutons ci-dessous pour agir rapidement.</blockquote>`;
  }

  const styledMessage = formatTelegramMessage(text);

  // Find active chat or use telegramId as chat ID
  await sendTelegramMessage(account.telegramId, styledMessage, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⏱️ Pointer présence", callback_data: "action:mark_attendance" },
          { text: "🔄 Trouver remplaçant", callback_data: "action:find_substitute" },
        ],
        [
          { text: "📢 Relancer impayés", callback_data: "action:send_reminders" },
          { text: "💵 Caisse du jour", callback_data: "action:view_caisse" },
        ],
      ],
    },
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
