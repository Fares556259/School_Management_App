import { cache } from "react";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "./prisma";

/**
 * Resolves the schoolId for the currently authenticated web admin.
 *
 * Priority chain:
 *   1. DB Admin.schoolId lookup (allows manual overrides)
 *   2. Supabase user_metadata.schoolId (set at provisioning time)
 *   3. Fallback: "default_school"
 */
export const getSchoolId = cache(async (): Promise<string> => {
  try {
    const user = await getAuthenticatedUser();
    const userId = user?.id;

    if (!userId) {
      return "default_school";
    }

    // 1. Fast path: Check Supabase user_metadata first (avoids DB hit for non-admins)
    const schoolIdFromMeta = user?.user_metadata?.schoolId as string | undefined;
    if (schoolIdFromMeta && schoolIdFromMeta !== "default_school") {
      return schoolIdFromMeta;
    }

    // 2. Check DB Admin record (allows manual overrides for admins)
    const role = user?.user_metadata?.role as string | undefined;
    if (role === "admin" || role === "superadmin") {
      const admin = await prisma.admin.findUnique({
        where: { id: userId },
        select: { schoolId: true },
      });
      if (admin?.schoolId && admin.schoolId !== "default_school") {
        return admin.schoolId;
      }
    }

    // 3. Try Supabase Admin API (in case session metadata is stale)
    try {
      const { data: { user: adminUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      const schoolIdFromAdmin = adminUser?.user_metadata?.schoolId as string | undefined;
      if (schoolIdFromAdmin) {
        return schoolIdFromAdmin;
      }
    } catch (e) {
      // Supabase Admin API check failed
    }

  } catch (err) {
    console.error("[getSchoolId] Resolution failed, using default:", err);
  }

  return "default_school";
});

/**
 * Resolves schoolId from a mobile API request header.
 * Mobile clients send X-School-Id after login.
 */
export function getSchoolIdFromHeader(
  headers: Headers | { get(name: string): string | null }
): string {
  return headers.get("x-school-id") || "default_school";
}
