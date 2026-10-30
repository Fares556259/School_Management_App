import assert from "node:assert/strict";
import fs from "node:fs";
import { GET as devReset } from "../app/api/dev-reset-password/route";
import { POST as legacyJoin } from "../app/api/join/submit/route";
import { POST as legacyCallSession } from "../app/api/call/session/route";
import { GET as legacyDailyReport } from "../app/api/cron/daily-report/route";
import { hasValidBearerSecret, hasValidHeaderSecret } from "../lib/requestSecrets";
import { generateCallToken, verifyCallToken } from "../lib/call/token";

async function main() {
  const nextConfig = fs.readFileSync(new URL("../../next.config.js", import.meta.url), "utf8");
  assert.match(nextConfig, /frame-ancestors 'none'/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /Access-Control-Allow-Origin[^\n]+https:\/\/www\.snapschool\.academy/);
  assert.doesNotMatch(nextConfig, /Access-Control-Allow-Origin[^\n]+\*/);
  assert.equal((await devReset()).status, 410);
  assert.equal((await legacyJoin()).status, 410);
  assert.equal((await legacyCallSession()).status, 410);
  assert.equal((await legacyDailyReport()).status, 410);

  const bearerRequest = new Request("http://localhost/cron", {
    headers: { authorization: "Bearer correct-secret" },
  });
  assert.equal(hasValidBearerSecret(bearerRequest, undefined), false);
  assert.equal(hasValidBearerSecret(bearerRequest, "wrong-secret"), false);
  assert.equal(hasValidBearerSecret(bearerRequest, "correct-secret"), true);

  const webhookRequest = new Request("http://localhost/telegram", {
    headers: { "x-telegram-bot-api-secret-token": "telegram-secret" },
  });
  assert.equal(hasValidHeaderSecret(webhookRequest, "x-telegram-bot-api-secret-token", undefined), false);
  assert.equal(hasValidHeaderSecret(webhookRequest, "x-telegram-bot-api-secret-token", "wrong"), false);
  assert.equal(hasValidHeaderSecret(webhookRequest, "x-telegram-bot-api-secret-token", "telegram-secret"), true);

  const oldCallSecret = process.env.CALL_SESSION_SECRET;
  const oldWebhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const oldBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const oldCronSecret = process.env.CRON_SECRET;
  try {
    delete process.env.CALL_SESSION_SECRET;
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.CRON_SECRET;
    assert.throws(
      () => generateCallToken({
        adminId: "admin-a",
        schoolId: "school-a",
        telegramChatId: "chat-a",
        telegramId: "telegram-a",
        adminName: "Admin A",
        schoolName: "School A",
      }),
      /signing secret/
    );

    process.env.CALL_SESSION_SECRET = "test-call-secret-with-at-least-32-characters";
    const token = generateCallToken({
      adminId: "admin-a",
      schoolId: "school-a",
      telegramChatId: "chat-a",
      telegramId: "telegram-a",
      adminName: "Admin A",
      schoolName: "School A",
    });
    assert.equal(verifyCallToken(token)?.schoolId, "school-a");
  } finally {
    if (oldCallSecret === undefined) delete process.env.CALL_SESSION_SECRET;
    else process.env.CALL_SESSION_SECRET = oldCallSecret;
    if (oldWebhookSecret === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = oldWebhookSecret;
    if (oldBotToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = oldBotToken;
    if (oldCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = oldCronSecret;
  }

  const middleware = fs.readFileSync("src/middleware.ts", "utf8");
  assert.equal(middleware.includes('pathname.startsWith("/api/dev-reset-password")'), false);
  assert.equal(middleware.includes('pathname.startsWith("/api/dev-promote")'), false);

  const voiceTurn = fs.readFileSync("src/app/api/call/voice-turn/route.ts", "utf8");
  assert.match(voiceTurn, /if \(!token\)/);
  assert.equal(voiceTurn.includes("context: verifiedContext"), true);

  console.log("Security surface checks passed: retired maintenance routes, fail-closed secrets, signed call tokens, and mandatory voice authentication.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
