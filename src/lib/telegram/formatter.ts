import { InlineKeyboardMarkup } from "./telegram";

/**
 * Format raw assistant responses into executive-grade Telegram cards with HTML styling.
 */
export function formatTelegramMessage(raw: string, schoolName?: string): string {
  if (!raw) return "";

  let text = raw.trim();

  // 1. Sanitize standard HTML angle brackets that are NOT Telegram tags
  // Preserve: <b>, </b>, <i>, </i>, <code>, </code>, <pre>, </pre>, <blockquote>, </blockquote>, <a href="...">, </a>, <u>, </u>, <s>, </s>
  const validTagTokens: { token: string; tag: string }[] = [];
  let tokenCounter = 0;

  const validTagRegex = /<\/?(?:b|i|code|pre|blockquote|u|s|a(?:\s+href="[^"]*")?)>/gi;
  text = text.replace(validTagRegex, (match) => {
    const token = `___TAG_${tokenCounter++}___`;
    validTagTokens.push({ token, tag: match });
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

  // 11. Auto-pill monetary amounts (e.g. 6 304 DT, 450 DT, 180 DT) if not already inside <code>
  text = text.replace(/(?<!<code>)([-+]?\d[\d\s]*\s*DT)(?!<\/code>)/g, "<code>$1</code>");

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
