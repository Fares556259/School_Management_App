import jwt from "jsonwebtoken";

export interface CallTokenPayload {
  adminId: string;
  schoolId: string;
  telegramChatId: string | number;
  telegramId: string;
  adminName: string;
  schoolName: string;
  language?: string;
}

function getJwtSecret(): string {
  return (
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    "snapschool_call_session_secret_2026"
  );
}

/**
 * Generate a signed JWT token valid for 2 hours for entering the Call Room
 */
export function generateCallToken(payload: CallTokenPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, {
    expiresIn: "2h",
  });
}

/**
 * Verify and decode a call session token
 */
export function verifyCallToken(token: string): CallTokenPayload | null {
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as CallTokenPayload;
    if (!decoded.schoolId || !decoded.adminId || !decoded.telegramChatId) {
      return null;
    }
    return decoded;
  } catch (err) {
    return null;
  }
}
