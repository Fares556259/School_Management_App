import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma";

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
  const secret =
    process.env.CALL_SESSION_SECRET ||
    process.env.TELEGRAM_WEBHOOK_SECRET ||
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Call session signing secret is not configured securely");
  }
  return secret;
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

export async function verifyActiveCallToken(token: string): Promise<CallTokenPayload | null> {
  const payload = verifyCallToken(token);
  if (!payload) return null;
  const admin = await prisma.admin.findFirst({
    where: {
      id: payload.adminId,
      schoolId: payload.schoolId,
      status: "active",
      School: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  return admin ? payload : null;
}
