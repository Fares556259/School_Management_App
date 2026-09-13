/**
 * Telegram Bot API Client for SnapSchool AI (Hnia)
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

function getBotToken(): string {
  const token =
    process.env.TELEGRAM_BOT_TOKEN ||
    "8740615331:AAEa9Xzx_WJnlw-XEgkhoO5Vcbb9KEWl7HU";
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured in environment variables. Set it in your Vercel/local .env settings.");
  }
  return token;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
  request_contact?: boolean;
  request_location?: boolean;
}

export interface ReplyKeyboardMarkup {
  keyboard: KeyboardButton[][];
  resize_keyboard?: boolean;
  one_time_keyboard?: boolean;
  is_persistent?: boolean;
}

export type TelegramReplyMarkup =
  | InlineKeyboardMarkup
  | ReplyKeyboardMarkup
  | { remove_keyboard: true };

export interface SendMessageOptions {
  parse_mode?: "Markdown" | "HTML" | "MarkdownV2";
  reply_markup?: TelegramReplyMarkup;
  reply_to_message_id?: number;
}

/**
 * Returns the persistent bottom keyboard for quick access to school operations.
 * Designed for administrators who prefer tapping on mobile.
 */
export function getMainHubKeyboard(language = "fr"): ReplyKeyboardMarkup {
  const isArabic = language === "ar";
  return {
    keyboard: isArabic
      ? [
          [{ text: "🏫 مدرستي" }, { text: "💰 المالية" }],
          [{ text: "👨‍🏫 الأساتذة" }, { text: "👨‍🎓 التلاميذ" }],
          [{ text: "📅 الجدول" }, { text: "📊 التقارير" }],
        ]
      : [
          [{ text: "🏫 Mon École" }, { text: "💰 Finances" }],
          [{ text: "👨‍🏫 Enseignants" }, { text: "👨‍🎓 Élèves" }],
          [{ text: "📅 Emploi du Temps" }, { text: "📊 Rapports" }],
        ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/**
 * Returns the inline hub action buttons for greeting / overview cards.
 */
export function getMainHubInlineKeyboard(language = "fr"): InlineKeyboardMarkup {
  const isArabic = language === "ar";
  return {
    inline_keyboard: isArabic
      ? [
          [
            { text: "🏫 مدرستي", callback_data: "hub:school" },
            { text: "💰 المالية", callback_data: "hub:finance" },
          ],
          [
            { text: "👨‍🏫 الأساتذة", callback_data: "hub:teachers" },
            { text: "👨‍🎓 التلاميذ", callback_data: "hub:students" },
          ],
          [
            { text: "📅 الجدول", callback_data: "hub:timetable" },
            { text: "📊 التقارير", callback_data: "hub:reports" },
          ],
        ]
      : [
          [
            { text: "🏫 Mon École", callback_data: "hub:school" },
            { text: "💰 Finances", callback_data: "hub:finance" },
          ],
          [
            { text: "👨‍🏫 Enseignants", callback_data: "hub:teachers" },
            { text: "👨‍🎓 Élèves", callback_data: "hub:students" },
          ],
          [
            { text: "📅 Emploi du Temps", callback_data: "hub:timetable" },
            { text: "📊 Rapports", callback_data: "hub:reports" },
          ],
        ],
  };
}

/**
 * Split a long text into chunks of at most maxLen characters,
 * breaking at newlines to preserve formatting.
 */
function splitMessage(text: string, maxLen = 3900): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLen) {
    // Try to break at the last newline before maxLen
    let breakAt = remaining.lastIndexOf("\n", maxLen);
    if (breakAt <= 0) breakAt = maxLen;
    chunks.push(remaining.slice(0, breakAt));
    remaining = remaining.slice(breakAt).trimStart();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
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

  // Chunk long messages to stay within Telegram's 4096-char limit
  const chunks = splitMessage(text);
  let lastResult: any;
  for (const chunk of chunks) {
    const payload: Record<string, any> = {
      chat_id: chatId,
      text: chunk,
      link_preview_options: { is_disabled: true },
      disable_web_page_preview: true,
    };

    if (options?.parse_mode) {
      payload.parse_mode = options.parse_mode;
    }
    // Only add reply_markup to the last chunk
    if (options?.reply_markup && chunk === chunks[chunks.length - 1]) {
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
          lastResult = await retryRes.json();
          continue;
        }
      }
      lastResult = data;
    } catch (error) {
      console.error("[Telegram] sendMessage fetch failed:", error);
      // Don't throw — log and continue with next chunk
    }
  }
  return lastResult;
}

/**
 * Send a native Telegram contact card to a chat.
 * Tapping a contact card on mobile directly opens native 1-tap phone dialing without any browser redirect.
 */
export async function sendTelegramContact(
  chatId: string | number,
  phoneNumber: string,
  firstName: string,
  lastName?: string
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/sendContact`;

  const digits = phoneNumber.replace(/\D/g, "");
  let cleanPhone = phoneNumber.trim().startsWith("+")
    ? `+${digits}`
    : digits.startsWith("216")
    ? `+${digits}`
    : `+216${digits}`;

  const payload: Record<string, any> = {
    chat_id: chatId,
    phone_number: cleanPhone,
    first_name: firstName,
  };
  if (lastName) {
    payload.last_name = lastName;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error("[Telegram] sendTelegramContact error:", err);
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

  const parseMode = options?.parse_mode !== undefined ? options.parse_mode : "HTML";

  const payload: Record<string, any> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };

  if (parseMode) {
    payload.parse_mode = parseMode;
  }
  if (options?.reply_markup) {
    payload.reply_markup = options.reply_markup;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.ok) {
      console.error("[Telegram] editMessageText error:", data);
      // Fallback: If parsing failed, retry as plain text stripping HTML tags
      if (payload.parse_mode && data.description?.includes("can't parse entities")) {
        delete payload.parse_mode;
        payload.text = payload.text.replace(/<[^>]*>/g, "");
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
    console.error("[Telegram] editMessageText fetch failed:", error);
    throw error;
  }
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

/**
 * Configure Telegram chat menu button (e.g. to open Mini App)
 */
export async function setChatMenuButton(
  chatId?: string | number,
  menuButton?: {
    type: "default" | "commands" | "web_app";
    text?: string;
    web_app?: { url: string };
  }
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/setChatMenuButton`;
  const payload: Record<string, any> = {};
  if (chatId) payload.chat_id = chatId;
  if (menuButton) payload.menu_button = menuButton;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return await res.json();
}

/**
 * Register the official command list with Telegram so it appears in the [/] menu
 */
export async function setTelegramBotCommands(
  commands?: Array<{ command: string; description: string }>
): Promise<any> {
  const token = getBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/setMyCommands`;

  const defaultCommands = commands || [
    { command: "menu", description: "🏛️ Menu principal & Accès direct" },
    { command: "school", description: "🏫 Mon École (Vue d'ensemble)" },
    { command: "finance", description: "💰 Finances & Caisse" },
    { command: "teachers", description: "👨‍🏫 Enseignants & Salaires" },
    { command: "students", description: "👨‍🎓 Élèves & Classes" },
    { command: "timetable", description: "📅 Emploi du Temps" },
    { command: "reports", description: "📊 Rapports & Tableau de bord" },
    { command: "briefing", description: "🌅 Briefing du matin" },
    { command: "caisse", description: "🌇 Clôture de caisse du jour" },
    { command: "call", description: "📞 Appel vocal direct avec Hnia" },
    { command: "help", description: "❓ Guide complet d'utilisation" },
    { command: "lang", description: "🌐 Changer la langue" },
  ];

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: defaultCommands }),
  });
  return await res.json();
}
