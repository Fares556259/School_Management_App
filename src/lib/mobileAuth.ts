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
  parentAccessStatus?: string;
  iat?: number;
  exp?: number;
}

interface StudentClaimPayload {
  purpose: "parent-signup";
  studentId: string;
  schoolId: string;
  iat?: number;
  exp?: number;
}

interface MobilePrintTokenPayload {
  purpose: "caisse-print";
  userId: string;
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

export function generateStudentClaimToken(studentId: string, schoolId: string): string {
  return jwt.sign({ purpose: "parent-signup", studentId, schoolId }, getJwtSecret(), { expiresIn: "2h" });
}

export function verifyStudentClaimToken(token: string): StudentClaimPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string" || payload.purpose !== "parent-signup" ||
        typeof payload.studentId !== "string" || typeof payload.schoolId !== "string") return null;
    return payload as StudentClaimPayload;
  } catch {
    return null;
  }
}

export function generateMobilePrintToken(userId: string, schoolId: string): string {
  return jwt.sign({ purpose: "caisse-print", userId, schoolId }, getJwtSecret(), { expiresIn: "5m" });
}

export function verifyMobilePrintToken(token: string): MobilePrintTokenPayload | null {
  try {
    const payload = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] });
    if (typeof payload === "string" || payload.purpose !== "caisse-print" ||
        typeof payload.userId !== "string" || typeof payload.schoolId !== "string") return null;
    return payload as MobilePrintTokenPayload;
  } catch {
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
// Usage: const auth = await authenticateMobileRequest(request);
//        if (auth.error) return auth.error;
//        const { userId, userType, schoolId } = auth.payload;
export async function authenticateMobileRequest(
  request: NextRequest | Request,
  options: { allowPendingParent?: boolean } = {}
): Promise<{ payload: MobileJWTPayload; error: null } | { payload: null; error: NextResponse }> {
  const authHeader = request.headers.get("Authorization");

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

  // Read current server-owned access on every request, including with an old JWT.
  if (payload.userType === "parent") {
    try {
      const { default: prisma } = await import("./prisma");
      const parent = await prisma.parent.findFirst({
        where: { id: payload.userId, schoolId: payload.schoolId, School: { status: "ACTIVE" } },
        select: { accessStatus: true },
      });
      if (!parent) return { payload: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
      payload.parentAccessStatus = parent.accessStatus;
      if (parent.accessStatus !== "ACTIVE" && !options.allowPendingParent) {
        return { payload: null, error: NextResponse.json({ code: "PARENT_APPROVAL_REQUIRED", error: "School approval required" }, { status: 403 }) };
      }
    } catch {
      return { payload: null, error: NextResponse.json({ error: "Access verification unavailable" }, { status: 503 }) };
    }
  }
  // A signed token is not a permanent grant. Deleted, disabled or transferred
  // staff must lose access even while their previously issued JWT is valid.
  if (payload.userType === "admin" || payload.userType === "teacher") {
    try {
      const { default: prisma } = await import("./prisma");
      const where = { id: payload.userId, schoolId: payload.schoolId, School: { status: "ACTIVE" } };
      const member = payload.userType === "admin"
        ? await prisma.admin.findFirst({ where: { ...where, status: "active" }, select: { id: true } })
        : await prisma.teacher.findFirst({ where, select: { id: true } });
      if (!member) return { payload: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    } catch {
      return { payload: null, error: NextResponse.json({ error: "Access verification unavailable" }, { status: 503 }) };
    }
  }
  return { payload, error: null };
}
