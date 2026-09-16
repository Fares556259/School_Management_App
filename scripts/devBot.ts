/**
 * Hnia Local Telegram Bot Runner
 *
 * Bridges your real Telegram chat directly to your local Next.js agent
 * and local Mock School Portal (http://localhost:3001/test-school-portal).
 *
 * Features:
 * - Automatically ensures mock portal is running on port 3001
 * - Long-polls Telegram Bot API (no ngrok required!)
 * - Runs Playwright automation locally on your Mac
 * - Sends real PDF downloads directly into your Telegram chat
 * - Restores original webhook when stopped
 */

import "dotenv/config";
import http from "http";
import { createMockPortalServer } from "./mockPortalServer";
import { runTelegramAgent } from "../src/lib/telegram/agent";
import { getLinkedAccount } from "../src/lib/telegram/linking";
import { handleConfirmationCallback } from "../src/lib/telegram/confirmation";
import { sendTelegramMessage } from "../src/lib/telegram/telegram";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("TELEGRAM_BOT_TOKEN must be set in environment variables");
}
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const ORIGINAL_WEBHOOK = "https://www.snapschool.academy/api/telegram/webhook";

let isRunning = true;
let mockServer: http.Server | null = null;

async function apiCall(method: string, payload: Record<string, any> = {}) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35000),
  });
  return await res.json();
}

async function processUpdate(update: any) {
  try {
    // 1. Handle Inline Buttons (Confirmation / Cancel)
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data || "";
      const chatId = cb.message?.chat?.id;

      console.log(`[DevBot] Button clicked: "${data}" by chat ${chatId}`);

      if (data.startsWith("confirm:") || data.startsWith("cancel:")) {
        await handleConfirmationCallback(cb);
      }
      return;
    }

    // 2. Handle Text Messages
    const message = update.message;
    if (!message || !message.text) return;

    const chatId = message.chat.id;
    const telegramId = message.from.id.toString();
    const rawText = message.text.trim();

    console.log(`\n=================================================`);
    console.log(`[DevBot] Received message from ${message.from.first_name || "Admin"} (${telegramId}):`);
    console.log(`💬 "${rawText}"`);
    console.log(`=================================================`);

    // Retrieve or mock linked account
    let tgAccount = await getLinkedAccount(telegramId);
    if (!tgAccount) {
      console.log(`[DevBot] User not linked in DB. Providing temporary local session for testing.`);
      // Mock account for instant local testing
      tgAccount = {
        id: "local_tg_account_01",
        telegramId,
        telegramUsername: message.from.username || "local_admin",
        language: "ar",
        schoolId: "default_school",
        adminId: "local_admin_id",
        createdAt: new Date(),
        updatedAt: new Date(),
        admin: {
          id: "local_admin_id",
          username: "directeur",
          name: "Directeur",
          surname: "SnapSchool",
        } as any,
        School: {
          id: "default_school",
          name: "SnapSchool Academy",
        } as any,
      } as any;
    }

    await runTelegramAgent({
      userMessage: rawText,
      chatId,
      telegramId,
      tgAccount,
    });
  } catch (err: any) {
    console.error("[DevBot] Error processing update:", err);
  }
}

async function start() {
  console.log("=================================================");
  console.log("🤖  HNIA LOCAL TELEGRAM RUNNER (DEV MODE)");
  console.log("=================================================");

  // 1. Ensure Mock Portal is running
  try {
    mockServer = createMockPortalServer();
    await new Promise<void>((resolve) => {
      mockServer!.listen(3001, "0.0.0.0", () => {
        console.log("✅ Mock Portal running on http://localhost:3001/test-school-portal");
        resolve();
      });
      mockServer!.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.log("✅ Mock Portal already running on port 3001.");
          mockServer = null;
        }
        resolve();
      });
    });
  } catch (err) {
    console.log("Mock portal init:", err);
  }

  // 2. Temporarily switch from webhook to getUpdates polling
  console.log("🔄 Temporarily detaching remote webhook to receive updates locally...");
  const delRes = await apiCall("deleteWebhook", { drop_pending_updates: false });
  console.log("Webhook detached:", delRes.ok ? "SUCCESS" : delRes.description);

  console.log("\n🚀 Hnia is LIVE and LISTENING to your Telegram messages!");
  console.log("👉 Send 'هنيّة جيبلي معلومات أحمد بن علي من المنصة' in Telegram now!\n");

  let offset = 0;

  // Cleanup on exit
  const cleanup = async () => {
    if (!isRunning) return;
    isRunning = false;
    console.log("\n🛑 Stopping local runner...");
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    await apiCall("setWebhook", {
      url: ORIGINAL_WEBHOOK,
      ...(secret ? { secret_token: secret } : {}),
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: false,
    });
    console.log("✅ Remote webhook restored with proper security configuration.");
    if (mockServer) {
      mockServer.close();
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // 3. Polling loop
  while (isRunning) {
    try {
      const data = await apiCall("getUpdates", {
        offset,
        timeout: 15,
        allowed_updates: ["message", "callback_query"],
      });

      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;
          await processUpdate(update);
        }
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (pollErr) {
      if (isRunning) {
        console.warn("[DevBot] Polling connection hiccup, retrying...", pollErr);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
}

start().catch(console.error);
