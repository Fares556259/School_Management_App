import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "./prisma";

/**
 * Resolves the schoolId for the currently authenticated web admin.
 *
 * Priority chain:
 *   1. Clerk session claims (fast — no extra network call)
 *   2. Clerk API user lookup
 *   3. DB Admin.schoolId lookup
 *   4. Fallback: "default_school" (keeps existing single-school installs working)
 */
export async function getSchoolId(): Promise<string> {
  try {
    const { userId, sessionClaims } = auth();
    console.log(`[getSchoolId] Resolving for User: ${userId}`);

    if (!userId) {
      console.log(`[getSchoolId] No userId found, returning default_school`);
      return "default_school";
    }

    // 1. Check DB Admin record first (allows manual overrides)
    const admin = await prisma.admin.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (admin?.schoolId) {
      console.log(`[getSchoolId] Resolved from DB for ${userId}: ${admin.schoolId}`);
      return admin.schoolId;
    }

    // 2. Fallback to JWT session claims
    const schoolIdFromClaims = (sessionClaims as any)?.metadata?.schoolId as string | undefined;
    if (schoolIdFromClaims) {
      console.log(`[getSchoolId] Resolved from CLAIMS for ${userId}: ${schoolIdFromClaims}`);
      return schoolIdFromClaims;
    }
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const schoolIdFromClerk = user.publicMetadata?.schoolId as string | undefined;
      if (schoolIdFromClerk) {
        console.log(`[getSchoolId] Resolved from CLERK API for ${userId}: ${schoolIdFromClerk}`);
        return schoolIdFromClerk;
      }
    } catch (e) {
      console.log(`[getSchoolId] Clerk API check failed for ${userId}`);
    }

  } catch (err) {
    console.error("[getSchoolId] Resolution failed, using default:", err);
  }

  console.log(`[getSchoolId] Using default fallback: default_school`);
  return "default_school";
}

/**
 * Resolves schoolId from a mobile API request header.
 * Mobile clients send X-School-Id after login.
 */
export function getSchoolIdFromHeader(
  headers: Headers | { get(name: string): string | null }
): string {
  return headers.get("x-school-id") || "default_school";
}
