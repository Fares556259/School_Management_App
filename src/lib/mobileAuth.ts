import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "snapschool_mobile_jwt_super_secret_key_2026";

export interface MobileJWTPayload {
  userId: string;
  userType: "parent" | "teacher";
  schoolId: string;
  iat?: number;
  exp?: number;
}

// ─── 1. JWT Token Issuer & Verifier ──────────────────────────────────────────
export function generateToken(payload: Omit<MobileJWTPayload, "iat" | "exp">): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): MobileJWTPayload | null {
  try {
    const cleanToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    return jwt.verify(cleanToken, JWT_SECRET) as MobileJWTPayload;
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

// ─── 3. In-Memory OTP Store (Phone -> { code, expiresAt }) ────────────────────
interface OTPRecord {
  code: string;
  expiresAt: number;
}

const otpStore = new Map<string, OTPRecord>();

export function generateAndStoreOTP(phone: string): string {
  // Generate 6-digit random code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes
  otpStore.set(phone.trim(), { code, expiresAt });
  console.log(`[OTP GENERATED] Phone: ${phone.trim()} -> Code: ${code} (Expires in 10m)`);
  return code;
}

export function verifyOTP(phone: string, inputCode: string): boolean {
  const record = otpStore.get(phone.trim());
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone.trim());
    return false;
  }
  const isValid = record.code === inputCode.trim();
  if (isValid) {
    otpStore.delete(phone.trim()); // Delete after single use
  }
  return isValid;
}
