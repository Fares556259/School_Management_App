import { InlineKeyboardMarkup } from "./telegram";

/**
 * Format raw assistant responses into executive-grade Telegram cards with HTML styling.
 */
export function formatTelegramMessage(raw: string, schoolName?: string): string {
  if (!raw) return "";

  let text = raw.trim();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.snapschool.academy";

  // 1. Sanitize standard HTML angle brackets that are NOT Telegram tags
  // Preserve: <b>, </b>, <i>, </i>, <code>, </code>, <pre>, </pre>, <blockquote>, </blockquote>, <a href="...">, </a>, <u>, </u>, <s>, </s>
  const validTagTokens: { token: string; tag: string }[] = [];
  let tokenCounter = 0;

  const validTagRegex = /<\/?(?:b|i|code|pre|blockquote|u|s|a(?:\s+href="[^"]*")?)>/gi;
  text = text.replace(validTagRegex, (match) => {
    let safeTag = match;
    // Intercept tel: links in <a> tags and convert them to web call redirect URLs (Telegram Bot API forbids tel: URLs)
    if (/^<a\s+href="tel:/i.test(match)) {
      safeTag = match.replace(/href="tel:([^"]+)"/i, (_, p) => {
        const clean = p.replace(/[^0-9+]/g, "");
        return `href="${appUrl}/api/call?phone=${encodeURIComponent(clean)}"`;
      });
    }
    const token = `___TAG_${tokenCounter++}___`;
    validTagTokens.push({ token, tag: safeTag });
    return token;
  });

  // Escape any raw HTML entities in the remaining text
  text = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore valid tags
  for (const { token, tag } of validTagTokens) {
    text = text.replace(token, tag);
  }

  // 2. Convert Markdown headers (### Header, ## Header, # Header) to bold
  text = text.replace(/^#{1,6}\s*(.+)$/gm, "<b>$1</b>");

  // 3. Convert Markdown bold (**text**) to <b>text</b>
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");

  // 4. Convert Markdown italic (*text* or _text_) to <i>text</i>
  text = text.replace(/(?<![<a-zA-Z0-9])\*([^*\n]+?)\*(?![>a-zA-Z0-9])/g, "<i>$1</i>");
  text = text.replace(/(?<![<a-zA-Z0-9])_([^_\n]+?)_(?![>a-zA-Z0-9])/g, "<i>$1</i>");

  // 5. Convert Markdown code (`code`) to <code>code</code>
  text = text.replace(/`([^`\n]+?)`/g, "<code>$1</code>");

  // 6. Convert Markdown horizontal dividers
  text = text.replace(/^---+$/gm, "━━━━━━━━━━━━━━━━━━━━━━");

  // 7. Convert Markdown blockquotes (> text)
  text = text.replace(/^>\s*(.+)$/gm, "<blockquote>$1</blockquote>");
  text = text.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // 8. Mobile Cleanup: Strip technical UUIDs and database IDs
  text = text.replace(/(?:🏷️|🆔|•)?\s*(?:ID|Id|id)\s*:\s*[a-f0-9-]{8,}(?:\.{3})?/gi, "");
  text = text.replace(/\[ID:\s*[a-f0-9-]+\]/gi, "");
  text = text.replace(/\([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\)/gi, "");

  // 9. Mobile Cleanup: Translate English month names to French
  const monthMap: Record<string, string> = {
    January: "Janvier",
    February: "Février",
    March: "Mars",
    April: "Avril",
    May: "Mai",
    June: "Juin",
    July: "Juillet",
    August: "Août",
    September: "Septembre",
    October: "Octobre",
    November: "Novembre",
    December: "Décembre",
  };
  for (const [en, fr] of Object.entries(monthMap)) {
    text = text.replace(new RegExp(`\\b${en}\\b`, "g"), fr);
  }

  // 10. Mobile Cleanup: Unwrap single-line clarification questions from blockquotes
  text = text.replace(/<blockquote>\s*(?:💡\s*(?:Analyse\s+Hnia\s*:\s*)?)?([^<>\n]+?\?)\s*<\/blockquote>/gi, "❓ $1");

  // 10b. Convert Markdown hyperlinks [text](url) to <a href="url">text</a>
  // Also converts tel: links to web call redirect URLs
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+|tel:[^)]+)\)/gi, (match, linkText, url) => {
    if (url.toLowerCase().startsWith("tel:")) {
      const cleanPhone = url.slice(4).replace(/[^0-9+]/g, "");
      return `<a href="${appUrl}/api/call?phone=${encodeURIComponent(cleanPhone)}">${linkText}</a>`;
    }
    return `<a href="${url}">${linkText}</a>`;
  });

  // 10c. Convert triple-backtick code blocks to <pre><code>...</code></pre>
  text = text.replace(/```(?:[a-z]*)\n?([\s\S]*?)```/g, (_, code) => {
    const escaped = code.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<pre><code>${escaped}</code></pre>`;
  });

  // 10d. Auto-link bare phone numbers following phone icons (e.g. 📞 12 357 5478) into direct call URLs
  // This ensures that when the user presses on the phone number in Telegram on their mobile,
  // it immediately opens the phone dialer with the number prefilled!
  text = text.replace(/(📞|☎️)\s*(?!<a\b)(?![^<]*<\/a>)([+0-9][0-9\s.-]{2,18}\d)/g, (match, icon, phoneStr) => {
    const digits = phoneStr.replace(/\D/g, "");
    if (digits.length < 4) return match;

    let cleanNumber: string;
    let displayNumber: string;
    if (phoneStr.trim().startsWith("+")) {
      cleanNumber = `+${digits}`;
      displayNumber = cleanNumber;
    } else if (digits.startsWith("00216")) {
      cleanNumber = `+${digits.slice(2)}`;
      displayNumber = cleanNumber;
    } else if (digits.startsWith("216") && digits.length > 8) {
      cleanNumber = `+${digits}`;
      displayNumber = cleanNumber;
    } else if (digits.length === 8) {
      cleanNumber = `+216${digits}`;
      displayNumber = `+216 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
    } else {
      cleanNumber = `+216${digits}`;
      displayNumber = `+216 ${phoneStr.trim()}`;
    }

    return `<a href="${appUrl}/api/call?phone=${encodeURIComponent(cleanNumber)}">${icon} ${displayNumber}</a>`;
  });

  // 11. Auto-pill monetary amounts (e.g. 6 304 DT, 450 DT, 180 DT) if not already inside <code>
  // Fix: Use a safe replacement that avoids nested <code> tags (which Telegram rejects).
  // First collect all existing <code>...</code> blocks and skip amounts inside them.
  text = text.replace(/(<code>[^<]*<\/code>)|(([-+]?\d[\d\s]*\s*DT))/g, (match, codeBlock, _outer, amount) => {
    if (codeBlock) return codeBlock; // Already in a code block — leave untouched
    if (amount) return `<code>${amount}</code>`; // Wrap bare amount
    return match;
  });

  // 12. Clean up dangling bullet points and redundant empty lines
  text = text.replace(/[ \t]*•\s*•/g, "•");
  text = text.replace(/[ \t]*•\s*$/gm, "");
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Returns contextual quick action buttons based on the tool that was executed or the message content.
 */
export function getQuickActionButtons(
  lastTool?: string,
  responseText?: string
): InlineKeyboardMarkup | undefined {
  const lower = (responseText || "").toLowerCase();
  const isAnnouncementDraft =
    lower.includes("proposition d'annonce") ||
    lower.includes("proposition d’annonce") ||
    lower.includes("projet d'annonce") ||
    lower.includes("projet d’annonce") ||
    lower.includes("créer une annonce") ||
    lower.includes("nouvelle annonce") ||
    lower.includes("options de diffusion") ||
    lower.includes("souhaitez-vous publier") ||
    lower.includes("voulez-vous publier") ||
    lower.includes("dites simplement « publier »") ||
    lower.includes("dites simplement «publier»") ||
    lower.includes("pour quelle classe souhaitez-vous diffuser") ||
    lower.includes("avez-vous une photo") ||
    lower.includes("avez-vous une affiche") ||
    (lower.includes("annonce") &&
      (lower.includes("destinataire") ||
        lower.includes("portée") ||
        lower.includes("urgent") ||
        lower.includes("affiche") ||
        lower.includes("image") ||
        lower.includes("publier ce message") ||
        lower.includes("publier cette annonce") ||
        lower.includes("options de diffusion")));

  if (isAnnouncementDraft) {
    return {
      inline_keyboard: [
        [
          { text: "🚀 Publier l'Annonce", callback_data: "announce:publish" },
          { text: "🔄 Régénérer", callback_data: "announce:regenerate" },
        ],
        [
          { text: "🚨 Basculer Urgent", callback_data: "announce:urgent" },
          { text: "🎯 Choisir une classe", callback_data: "announce:class" },
        ],
        [
          { text: "✏️ Modifier le texte", callback_data: "announce:edit" },
        ],
      ],
    };
  }

  if (!lastTool) return undefined;

  switch (lastTool) {
    case "get_daily_caisse":
      return {
        inline_keyboard: [
          [
            { text: "➕ Enregistrer dépense", callback_data: "action:add_expense" },
            { text: "💳 Encaisser scolarité", callback_data: "action:record_payment" },
          ],
          [
            { text: "📊 Bilan mensuel", callback_data: "action:financial_summary" },
            { text: "📢 Relancer impayés", callback_data: "action:send_reminders" },
          ],
        ],
      };

    case "get_morning_briefing":
      return {
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
      };

    case "get_partial_payments":
      return {
        inline_keyboard: [
          [
            { text: "🤝 Recouvrer un reliquat", callback_data: "action:recover_partial" },
            { text: "📅 Fixer une échéance", callback_data: "action:schedule_recovery" },
          ],
          [
            { text: "📢 Relancer les impayés", callback_data: "action:send_reminders" },
          ],
        ],
      };

    case "get_incomes":
      return {
        inline_keyboard: [
          [
            { text: "➕ Ajouter un revenu", callback_data: "action:add_income" },
            { text: "📊 Bilan financier", callback_data: "action:financial_summary" },
          ],
        ],
      };

    case "get_expenses":
      return {
        inline_keyboard: [
          [
            { text: "➕ Ajouter une dépense", callback_data: "action:add_expense" },
            { text: "📊 Bilan financier", callback_data: "action:financial_summary" },
          ],
        ],
      };

    case "get_financial_summary":
    case "get_financial_anomalies":
      return {
        inline_keyboard: [
          [
            { text: "📢 Relancer les impayés", callback_data: "action:send_reminders" },
            { text: "🔍 Détails dépenses", callback_data: "action:view_expenses" },
          ],
          [
            { text: "➕ Enregistrer un paiement", callback_data: "action:record_payment" },
          ],
        ],
      };

    case "get_teachers":
    case "get_staff":
      return {
        inline_keyboard: [
          [
            { text: "💸 Payer un salaire", callback_data: "action:pay_salary" },
            { text: "➕ Nouvel enseignant", callback_data: "action:add_teacher" },
          ],
        ],
      };

    case "get_attendance":
    case "get_student_attendance_history":
      return {
        inline_keyboard: [
          [
            { text: "❌ Pointer une absence", callback_data: "action:mark_attendance" },
            { text: "📜 Historique 30j", callback_data: "action:attendance_history" },
          ],
        ],
      };

    case "get_payments":
      return {
        inline_keyboard: [
          [
            { text: "📢 Relancer les familles", callback_data: "action:send_reminders" },
            { text: "➕ Enregistrer paiement", callback_data: "action:record_payment" },
          ],
        ],
      };

    case "get_class_timetable":
    case "find_available_teachers":
      return {
        inline_keyboard: [
          [
            { text: "🔄 Trouver remplaçant", callback_data: "action:find_substitute" },
            { text: "➕ Ajouter un cours", callback_data: "action:add_slot" },
          ],
        ],
      };

    case "get_student_grades":
    case "get_class_grade_sheet":
    case "get_exams":
      return {
        inline_keyboard: [
          [
            { text: "📝 Saisir une note", callback_data: "action:record_grade" },
            { text: "📅 Planifier examen", callback_data: "action:schedule_exam" },
          ],
        ],
      };

    case "get_students":
    case "get_student_profile":
    case "get_parents":
      return {
        inline_keyboard: [
          [
            { text: "💳 Enregistrer scolarité", callback_data: "action:record_payment" },
            { text: "⏱️ Pointer absence", callback_data: "action:mark_attendance" },
          ],
        ],
      };

    default:
      return undefined;
  }
}
