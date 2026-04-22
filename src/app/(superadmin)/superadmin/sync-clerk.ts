"use server";

import prisma from "@/lib/prisma";
import { clerkClient, auth } from "@clerk/nextjs/server";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";
import { provisionSchool } from "./actions";

/**
 * Ensures the caller is a superadmin.
 */
async function ensureSuperAdmin() {
  const role = await getRole();
  if (role !== "superadmin") {
    throw new Error("Unauthorized: Superadmin access required.");
  }
}

export async function syncClerkUsers() {
  await ensureSuperAdmin();

  try {
    const client = await clerkClient();
    const users = await client.users.getUserList({ limit: 100 });
    
    let synchronizedCount = 0;
    let alreadySyncedCount = 0;
    let prunedCount = 0;

    const activeClerkIds = new Set<string>();

    for (const user of users.data) {
      activeClerkIds.add(user.id);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) continue;

      // 1. Skip superadmins
      if (user.publicMetadata?.role === "superadmin") continue;

      const clerkStatus = user.publicMetadata?.status as string;
      const dbAdminStatus = clerkStatus === "active" ? "active" : "pending";
      const dbLeadStatus = clerkStatus === "active" ? "ACTIVATED" : "PENDING";

      // 2. Check current DB state
      const existingAdminById = await prisma.admin.findUnique({ where: { id: user.id } });
      const existingAdminByEmail = await prisma.admin.findUnique({ where: { email: email } });
      const existingLead = await prisma.setupRequest.findFirst({ where: { email: email } });

      // 3. CASE A: User exists but status is outdated (Manual Clerk activation)
      if (existingAdminById) {
        if (clerkStatus === "active" && existingAdminById.status === "pending") {
          const schoolId = user.publicMetadata?.schoolId as string || existingAdminById.schoolId;
          const schoolName = (user.unsafeMetadata?.schoolName as string) 
                          || (user.publicMetadata?.schoolName as string) 
                          || existingAdminById.pendingSchoolName
                          || "My School";

          await provisionSchool(user.id, schoolId, schoolName, email);
          
          synchronizedCount++;
          continue;
        }
      }

      // 4. CASE B: User or Lead is missing COMPLETELY
      if (!existingAdminById || !existingLead) {
        const schoolName = (user.unsafeMetadata?.schoolName as string) 
                        || (user.publicMetadata?.schoolName as string) 
                        || `${user.firstName || "New"}'s School`;

        // Handle re-registration with same email
        if (!existingAdminById && existingAdminByEmail) {
           await prisma.admin.delete({ where: { email: email } });
        }

        if (!existingAdminById) {
          await prisma.admin.create({
            data: {
              id: user.id,
              username: user.username || email.split("@")[0] || "user_" + user.id.slice(-5),
              email: email,
              name: user.firstName || "New",
              surname: user.lastName || "Admin",
              status: dbAdminStatus,
              pendingSchoolName: clerkStatus === "active" ? null : schoolName,
              schoolId: user.publicMetadata?.schoolId as string || "default_school",
            }
          });
        }

        if (!existingLead) {
          await prisma.setupRequest.create({
            data: {
              schoolName: schoolName,
              ownerName: `${user.firstName || "New"} ${user.lastName || "Admin"}`,
              phoneNumber: "N/A",
              email: email,
              city: "Sync Engine",
              status: dbLeadStatus
            }
          });
        }

        // AUTO-PROVISION if active
        if (clerkStatus === "active") {
          const schoolId = user.publicMetadata?.schoolId as string || "default_school";
          await provisionSchool(user.id, schoolId, schoolName, email);
        }
        
        synchronizedCount++;
      } else {
        alreadySyncedCount++;
      }
    }

    // 5. PRUNING: Remove Zombie Admins/Leads that are NOT in Clerk anymore
    const { userId: currentUserId } = await auth();
    const allKnownAdmins = await prisma.admin.findMany();

    for (const admin of allKnownAdmins) {
      // PROTECTION: Never prune the active superadmin or anyone in the current Clerk slice
      if (!activeClerkIds.has(admin.id) && admin.id !== currentUserId) {
        // Safety: If Admin record has no Clerk account, delete it and its lead
        await prisma.admin.delete({ where: { id: admin.id } });
        
        if (admin.email) {
          await prisma.setupRequest.deleteMany({
            where: { email: admin.email }
          });
        }
        prunedCount++;
      }
    }

    revalidatePath("/superadmin");
    return { success: true, synchronizedCount, alreadySyncedCount, prunedCount };
  } catch (error: any) {
    console.error("Manual Sync Error:", error);
    return { success: false, error: error.message };
  }
}
