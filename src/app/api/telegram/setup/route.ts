import { NextRequest, NextResponse } from "next/server";
import { setTelegramWebhook, getTelegramWebhookInfo } from "@/lib/telegram/telegram";

export const dynamic = "force-dynamic";

/**
 * Setup and verify the Telegram Bot Webhook.
 * URL: /api/telegram/setup
 */
export async function GET(req: NextRequest) {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.snapschool.academy";
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

    // Check query param action: ?action=info or ?action=set
    const action = req.nextUrl.searchParams.get("action") || "set";

    if (action === "info") {
      const info = await getTelegramWebhookInfo();
      return NextResponse.json({
        ok: true,
        webhookInfo: info,
      });
    }

    // Set webhook
    const setResult = await setTelegramWebhook(webhookUrl, secret);
    const updatedInfo = await getTelegramWebhookInfo();

    return NextResponse.json({
      ok: true,
      result: setResult,
      webhookUrl,
      webhookInfo: updatedInfo,
    });
  } catch (error: any) {
    console.error("[Telegram Setup Error]:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
