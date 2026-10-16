import { createHash } from 'crypto';
import prisma from './prisma';

/** Atomic fixed window counters shared across serverless instances. No raw IPs stored. */
export async function checkPersistentRateLimit(identity: string, action: string, limit = 10, windowMs = 60_000) {
  const bucket = Math.floor(Date.now() / windowMs);
  const key = createHash('sha256').update(`${action}:${identity}:${bucket}`).digest('hex');
  const resetAt = new Date((bucket + 1) * windowMs);
  const record = await prisma.mobileRateLimit.upsert({
    where: { key }, create: { key, resetAt, count: 1 }, update: { count: { increment: 1 } },
  });
  return { success: record.count <= limit, retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - Date.now()) / 1000)) };
}
