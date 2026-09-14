import prisma from "@/lib/prisma";

/**
 * Regex patterns identifying that the user is actively correcting the bot
 * in French, Tunisian Derja (Arabizi), or English.
 */
const CORRECTION_PATTERNS = [
  // French
  /(?:^|\b)(?:non\s+c['’]est\s+pas|c['’]est\s+faux|tu\s+te\s+trompes|tu\s+t['’]es\s+trompée|pas\s+lui|pas\s+elle|mauvais|mauvaise|erreur|ce\s+n['’]est\s+pas|je\s+parle\s+de|je\s+te\s+demande|j['’]ai\s+dit|rectification|rectifie|rectifier|attention\s+hnia|faux\s+montant|mauvaise\s+classe|mauvais\s+élève)(?:\b|$)/i,
  // Tunisian Derja / Arabizi
  /(?:^|\b)(?:ghalet|ghalta|mouch\s+hedha|mouch\s+heya|la\s+mouch|le\s+mouch|chbik\s+dakhal|dakhalha|mouch\s+el\s+|famech\s+menha|chkoun\s+9al|9otlek|la\s+3ad|le\s+3ad|mouch\s+shih|mouch\s+s7i7)(?:\b|$)/i,
  // English
  /(?:^|\b)(?:no\s+not|wrong|that['’]s\s+incorrect|you\s+got\s+confused|i\s+meant|not\s+him|not\s+her|mistake|incorrect\s+amount|wrong\s+student|wrong\s+class)(?:\b|$)/i,
];

/**
 * Check if an incoming user message contains correction patterns.
 */
export function isCorrectionMessage(text?: string | null): boolean {
  if (!text || !text.trim()) return false;
  const normalized = text.trim();
  return CORRECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Asynchronously flags an active conversation for offline reflection and learning.
 */
export async function flagConversationForLearning(
  conversationId: string,
  reason = "USER_CORRECTION_DETECTED"
): Promise<void> {
  try {
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        status: "NEEDS_LEARNING",
      },
    });
    console.log(`[Feedback] Conversation ${conversationId} flagged for learning (Reason: ${reason})`);
  } catch (err) {
    console.warn(`[Feedback] Failed to flag conversation ${conversationId}:`, err);
  }
}

/**
 * Marks a conversation as having received positive feedback.
 */
export async function markConversationPositive(conversationId: string): Promise<void> {
  try {
    await prisma.aIConversation.update({
      where: { id: conversationId },
      data: {
        status: "POSITIVE",
      },
    });
  } catch (err) {
    console.warn(`[Feedback] Failed to mark positive for ${conversationId}:`, err);
  }
}

/**
 * Generates lightweight inline feedback buttons for key Telegram responses.
 */
export function getFeedbackKeyboard(conversationId: string) {
  return {
    inline_keyboard: [
      [
        { text: "👍", callback_data: `feedback:good:${conversationId}` },
        { text: "👎 Signaler", callback_data: `feedback:bad:${conversationId}` },
      ],
    ],
  };
}
