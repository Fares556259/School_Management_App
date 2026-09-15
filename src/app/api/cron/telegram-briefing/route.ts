import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { runTelegramAgent } from "@/lib/telegram/agent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Endpoint for automated Telegram school briefings.
 * - Morning (07:45): Daily schedule, absent teachers, due tuitions, urgent alerts.
 * - Evening (17:00): Daily cash register closing (recettes, dépenses, solde net).
 *
 * Can be triggered with query param: ?type=morning or ?type=evening
 * Defaults to morning if before 13h, evening if after 13h.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const typeParam = searchParams.get("type");

    // Determine mode: morning briefing, evening caisse, or proactive overdue alert
    const currentHour = new Date().getHours();
    const isOverdueAlert = typeParam === "overdue" || typeParam === "reminders";
    const isEvening = !isOverdueAlert && (typeParam === "evening" || (typeParam !== "morning" && currentHour >= 14));

    let prompt = "Donne-moi le briefing exécutif du matin pour aujourd'hui (séances prévues, absences récentes à suivre, échéances de paiement et alertes urgentes).";
    if (isOverdueAlert) {
      prompt = "Fais le point proactif sur les impayés de scolarité du mois en cours, et propose à l'administrateur de lancer la campagne de relances par notifications push aux familles.";
    } else if (isEvening) {
      prompt = "Fais le bilan officiel de clôture de caisse du jour avec get_daily_caisse (total des recettes perçues, dépenses décaissées, solde physique net en caisse et récapitulatif des présences).";
    }

    // Find all linked Telegram accounts with dailyBriefing enabled
    const accounts = await prisma.telegramAccount.findMany({
      where: { dailyBriefing: true },
      include: {
        admin: true,
        School: true,
        conversations: {
          where: { status: "ACTIVE" },
          orderBy: { updatedAt: "desc" },
          take: 1,
        },
      },
    });

    console.log(
      `[CRON Telegram Briefing] Dispatching ${isEvening ? "Evening Caisse" : "Morning Briefing"} to ${accounts.length} admin(s)...`
    );

    let sentCount = 0;
    const errors: any[] = [];

    for (const account of accounts) {
      const activeConv = account.conversations[0];
      const chatId = activeConv?.telegramChatId || account.telegramId;

      try {
        await runTelegramAgent({
          userMessage: prompt,
          chatId,
          telegramId: account.telegramId,
          tgAccount: account,
        });
        sentCount++;
      } catch (err: any) {
        console.error(`[CRON Telegram Briefing] Error for admin ${account.admin.username}:`, err);
        errors.push({ admin: account.admin.username, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      mode: isEvening ? "evening_caisse" : "morning_briefing",
      recipients: accounts.length,
      sentCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[CRON Telegram Briefing] Fatal error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
