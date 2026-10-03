import jwt from "jsonwebtoken";
import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

export interface MobileJWTPayload {
  userId: string;
  userType: "parent" | "teacher" | "admin";
  schoolId: string;
  iat?: number;
  exp?: number;
}

// ─── 1. JWT Token Issuer & Verifier ──────────────────────────────────────────
export function generateToken(payload: Omit<MobileJWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): MobileJWTPayload | null {
  try {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const payload = jwt.verify(cleanToken, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string" || !payload.userId ||
        typeof payload.schoolId !== "string" || !payload.schoolId ||
        !["parent", "teacher", "admin"].includes(payload.userType)) return null;
    return payload as MobileJWTPayload;
  } catch (error) {
    return null;
  }
}

// ─── 2. Rate Limiting (5 requests per 60s per IP) ────────────────────────────
interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

export function checkRateLimit(ip: string, action: string = "auth"): { success: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 5; // 5 requests per minute

  const key = `${action}:${ip}`;
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true };
  }

  if (record.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);
    return { success: false, retryAfterSeconds };
  }

  record.count += 1;
  return { success: true };
}

// ─── 3. In-Memory OTP Store (Phone -> { code, expiresAt, attempts: 0 }) ────────────────────
interface OTPRecord {
  code: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OTPRecord>();

export function generateAndStoreOTP(phone: string): string {
  // Generate 6-digit random code
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes
  otpStore.set(phone.trim(), { code, expiresAt, attempts: 0 });

  return code;
}

export function verifyOTP(phone: string, inputCode: string): boolean {
  const record = otpStore.get(phone.trim());
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone.trim());
    return false;
  }
  record.attempts += 1;
  const isValid = record.code === inputCode.trim();
  if (record.attempts >= 5) otpStore.delete(phone.trim());
  if (isValid) {
    otpStore.delete(phone.trim()); // Delete after single use
  }
  return isValid;
}

// ─── 4. Reusable Auth Guard for Mobile Routes ─────────────────────────────────
// Usage: const auth = authenticateMobileRequest(request);
//        if (auth.error) return auth.error;
//        const { userId, userType, schoolId } = auth.payload;
export function authenticateMobileRequest(
  request: NextRequest | Request
): { payload: MobileJWTPayload; error: null } | { payload: null; error: NextResponse } {
  let authHeader = request.headers.get("Authorization");
  if (!authHeader && "url" in request) {
    try {
      const url = new URL(request.url);
      const queryToken = url.searchParams.get("token");
      if (queryToken) authHeader = queryToken;
    } catch {}
  }

  if (!authHeader) {
    return {
      payload: null,
      error: new NextResponse(JSON.stringify({ error: "Unauthorized: Missing token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  const payload = verifyToken(authHeader);
  if (!payload || !payload.userId || !payload.schoolId) {
    return {
      payload: null,
      error: new NextResponse(JSON.stringify({ error: "Unauthorized: Invalid or expired token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    };
  }

  return { payload, error: null };
}
