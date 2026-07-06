"use server";

import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";
import { provisionSchool } from "./actions";

async function ensureSuperAdmin() {
  const role = await getRole();
  if (role !== "superadmin") {
    throw new Error("Unauthorized: Superadmin access required.");
  }
}

export async function syncClerkUsers() {
  await ensureSuperAdmin();

  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    if (error) throw error;

    // Collect all superadmin emails so we can exclude them from leads
    const superadminEmails = new Set<string>(
      users
        .filter(u => (u.user_metadata?.role as string) === "superadmin" && u.email)
        .map(u => u.email as string)
    );

    let synchronizedCount = 0;
    let alreadySyncedCount = 0;
    let prunedCount = 0;

    const activeUserIds = new Set<string>();

    for (const user of users) {
      activeUserIds.add(user.id);
      const email = user.email;
      if (!email) continue;

      const meta = user.user_metadata || {};
      const role = meta.role as string;
      const status = meta.status as string;

      // Skip superadmins — they are never treated as school admins
      if (role === "superadmin") continue;

      const dbAdminStatus = status === "active" ? "active" : "pending";
      const dbLeadStatus  = status === "active" ? "ACTIVATED" : "PENDING";

      const firstName = (meta.firstName as string) || "";
      const lastName  = (meta.lastName  as string) || "";
      // Never use the email as the school name — use a readable default
      const schoolName =
        (meta.schoolName as string) ||
        (firstName ? `${firstName}'s School` : "Unnamed School");

      // 1. Try to find by Supabase ID
      let existingAdmin = await prisma.admin.findUnique({ where: { id: user.id } });

      // 2. If not found by ID, check by email (handles Clerk→Supabase ID change)
      if (!existingAdmin) {
        const emailMatch = await prisma.admin.findFirst({ where: { email } });
        if (emailMatch) {
          // Re-key: delete old record (wrong ID) — the create below will use the correct ID
          await prisma.admin.delete({ where: { id: emailMatch.id } });
        }
      }

      // 3. Re-check after potential delete
      existingAdmin = await prisma.admin.findUnique({ where: { id: user.id } });

      // CASE A: Record exists — check if status needs updating
      if (existingAdmin) {
        if (status === "active" && existingAdmin.status === "pending") {
          const schoolId    = (meta.schoolId   as string) || existingAdmin.schoolId;
          const resolvedName = (meta.schoolName as string) || existingAdmin.pendingSchoolName || schoolName;
          await provisionSchool(user.id, schoolId, resolvedName);
          synchronizedCount++;
          continue;
        }
        alreadySyncedCount++;
        continue;
      }

      // CASE B: Completely new — create Admin record
      await prisma.admin.create({
        data: {
          id:               user.id,
          username:         (meta.username as string) || "user_" + user.id.slice(-5),
          name:             firstName || "New",
          surname:          lastName  || "Admin",
          email,
          status:           dbAdminStatus,
          pendingSchoolName: status === "active" ? null : schoolName,
          schoolId:         (meta.schoolId as string) || "default_school",
        },
      });

      // Create a lead SetupRequest only if one doesn't already exist for this email
      const existingRequest = await prisma.setupRequest.findFirst({
        where: { ownerName: email },
      });

      if (!existingRequest) {
        await prisma.setupRequest.create({
          data: {
            schoolName,
            ownerName: [firstName, lastName].filter(Boolean).join(" ") || email,
            phoneNumber: (meta.phone as string) || "",
            city: "Sync Engine",
            status: dbLeadStatus,
          },
        });
      }

      if (status === "active") {
        const schoolId = (meta.schoolId as string) || "default_school";
        await provisionSchool(user.id, schoolId, schoolName);
      }

      synchronizedCount++;
    }

    // PRUNING: Remove zombie admin records no longer in Supabase Auth
    // Commented out to prevent deleting local test admins that aren't in Supabase Auth yet.
    /*
    const supabase = createClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    const currentUserId = currentUser?.id;

    const allKnownAdmins = await prisma.admin.findMany();
    for (const admin of allKnownAdmins) {
      if (!activeUserIds.has(admin.id) && admin.id !== currentUserId) {
        await prisma.admin.delete({ where: { id: admin.id } });
        prunedCount++;
      }
    }
    */

    // CLEANUP: Remove any SetupRequests whose schoolName or ownerName is a superadmin email
    // (these are stale records from before the role was set)
    for (const email of Array.from(superadminEmails)) {
      await prisma.setupRequest.deleteMany({
        where: {
          OR: [
            { schoolName: email },
            { ownerName: email },
          ],
        },
      });
    }

    revalidatePath("/superadmin");
    return { success: true, synchronizedCount, alreadySyncedCount, prunedCount };
  } catch (error: any) {
    console.error("Sync Error:", error);
    return { success: false, error: error.message };
  }
}
