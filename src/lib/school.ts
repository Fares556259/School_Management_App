import { cache } from "react";
import { getAuthenticatedUser } from "@/utils/supabase/server";
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
    const admin = await prisma.admin.findFirst({
      where: { id: userId, status: "active", School: { status: "ACTIVE" } },
      select: { schoolId: true },
    });
    if (admin?.schoolId) {
      return admin.schoolId;
    }

    const [teacher, parent, student] = await Promise.all([
      prisma.teacher.findFirst({ where: { id: userId, School: { status: "ACTIVE" } }, select: { schoolId: true } }),
      prisma.parent.findFirst({ where: { id: userId, accessStatus: "ACTIVE", School: { status: "ACTIVE" } }, select: { schoolId: true } }),
      prisma.student.findFirst({ where: { id: userId, School: { status: "ACTIVE" } }, select: { schoolId: true } }),
    ]);
    const membership = teacher || parent || student;
    if (membership?.schoolId) return membership.schoolId;

    // Stale auth metadata cannot restore a deleted or suspended membership.

  } catch (err) {
    console.error("[getSchoolId] Resolution failed:", err);
  }

  throw new Error("Authenticated school membership is required.");
});
