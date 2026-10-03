import { cache } from "react";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "./prisma";

/** Resolve school membership from verified authentication and server-owned records. */
export const getSchoolId = cache(async (): Promise<string> => {
  try {
    const user = await getAuthenticatedUser();
    const userId = user?.id;

    if (!userId) {
      throw new Error("Authenticated school membership is required.");
    }

    // 2. Check DB Admin record (allows manual overrides for admins)
    const admin = await prisma.admin.findUnique({
      where: { id: userId },
      select: { schoolId: true },
    });
    if (admin?.schoolId) {
      return admin.schoolId;
    }

    const [teacher, parent, student] = await Promise.all([
      prisma.teacher.findUnique({ where: { id: userId }, select: { schoolId: true } }),
      prisma.parent.findUnique({ where: { id: userId }, select: { schoolId: true } }),
      prisma.student.findUnique({ where: { id: userId }, select: { schoolId: true } }),
    ]);
    const membership = teacher || parent || student;
    if (membership?.schoolId) return membership.schoolId;

    // 3. Try Supabase Admin API (in case session metadata is stale)
    try {
      const { data: { user: adminUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      const schoolIdFromAdmin = adminUser?.app_metadata?.schoolId as string | undefined;
      if (schoolIdFromAdmin) {
        return schoolIdFromAdmin;
      }
    } catch (e) {
      // Supabase Admin API check failed
    }

  } catch (err) {
    console.error("[getSchoolId] Resolution failed:", err);
  }

  throw new Error("Authenticated school membership is required.");
});
