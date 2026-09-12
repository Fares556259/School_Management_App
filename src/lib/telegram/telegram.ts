/**
 * Telegram Bot API Client for SnapSchool AI (Hnia)
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN || "8740615331:AAEa9Xzx_WJnlw-XEgkhoO5Vcbb9KEWl7HU";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in environment variables");
  }
  return token;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface SendMessageOptions {
  parse_mode?: "Markdown" | "HTML" | "MarkdownV2";
  reply_markup?: InlineKeyboardMarkup;
  reply_to_message_id?: number;
}

/**
 * Send a text message to a Telegram chat
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options?: SendMessageOptions
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendMessage`;

  const payload: Record<string, any> = {
    chat_id: chatId,
    text,
  };

  if (options?.parse_mode) {
    payload.parse_mode = options.parse_mode;
  }
  if (options?.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }
  if (options?.reply_to_message_id) {
    payload.reply_to_message_id = options.reply_to_message_id;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("[Telegram] sendMessage error:", data);
      // Fallback: If parsing failed, try sending as plain text
      if (options?.parse_mode && data.description?.includes("can't parse entities")) {
        delete payload.parse_mode;
        if (options.parse_mode === "HTML") {
          payload.text = payload.text.replace(/<[^>]*>/g, "");
        }
        const retryRes = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        return await retryRes.json();
      }
    }
    return data;
  } catch (error) {
    console.error("[Telegram] sendMessage fetch failed:", error);
    throw error;
  }
}

/**
 * Edit an existing message's text and buttons
 */
export async function editTelegramMessageText(
  chatId: string | number,
  messageId: number,
  text: string,
  options?: SendMessageOptions
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/editMessageText`;

  const payload: Record<string, any> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };

  if (options?.parse_mode) {
    payload.parse_mode = options.parse_mode;
  }
  if (options?.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return await res.json();
}

/**
 * Send chat action (e.g. typing, record_voice)
 */
export async function sendTelegramChatAction(
  chatId: string | number,
  action: "typing" | "upload_document" | "record_voice" | "upload_voice" = "typing"
): Promise<void> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendChatAction`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action }),
    });
  } catch (err) {
    console.warn("[Telegram] sendChatAction failed:", err);
  }
}

/**
 * Acknowledge an inline keyboard callback query
 */
export async function answerTelegramCallbackQuery(
  callbackQueryId: string,
  text?: string,
  showAlert: boolean = false
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: showAlert,
    }),
  });

  return await res.json();
}

/**
 * Get file details from Telegram to download voice/audio
 */
export async function getTelegramFile(fileId: string): Promise<{ file_path: string; file_size?: number }> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/getFile?file_id=${fileId}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.ok || !data.result?.file_path) {
    throw new Error(`Failed to get file from Telegram: ${JSON.stringify(data)}`);
  }

  return data.result;
}

/**
 * Download file buffer from Telegram
 */
export async function downloadTelegramFileBuffer(filePath: string): Promise<Buffer> {
  const token = getBotToken();
  const downloadUrl = `${TELEGRAM_API_BASE}/file/bot${token}/${filePath}`;

  const res = await fetch(downloadUrl);
  if (!res.ok) {
    throw new Error(`Failed to download file from ${downloadUrl}: ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Set webhook for the bot
 */
export async function setTelegramWebhook(url: string, secretToken?: string): Promise<any> {
  const token = getBotToken();
  const apiUrl = `${TELEGRAM_API_BASE}/bot${token}/setWebhook`;

  const payload: Record<string, any> = {
    url,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  };

  if (secretToken) {
    payload.secret_token = secretToken;
  }

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return await res.json();
}

/**
 * Get current webhook info
 */
export async function getTelegramWebhookInfo(): Promise<any> {
  const token = getBotToken();
  const apiUrl = `${TELEGRAM_API_BASE}/bot${token}/getWebhookInfo`;

  const res = await fetch(apiUrl);
  return await res.json();
}
