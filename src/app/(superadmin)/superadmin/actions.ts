"use server";

import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";

/**
 * Ensures the caller has the 'superuser' role.
 */
async function ensureSuperUser() {
  const role = await getRole();
  if (role !== "superadmin") {
    throw new Error("Unauthorized: Superuser access required.");
  }
}

export async function getSetupRequests() {
  await ensureSuperUser();

  try {
    return await prisma.setupRequest.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  } catch (error) {
    console.error("Error fetching setup requests:", error);
    throw new Error("Failed to fetch setup requests.");
  }
}

export async function updateSetupRequestStatus(id: string, status: string) {
  await ensureSuperUser();

  try {
    await prisma.setupRequest.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/superadmin");
    return { success: true };
  } catch (error) {
    console.error("Error updating setup request:", error);
    throw new Error("Failed to update setup request status.");
  }
}

export async function deleteSetupRequest(id: string) {
  await ensureSuperUser();

  try {
    await prisma.setupRequest.delete({
      where: { id },
    });
    revalidatePath("/superadmin");
    return { success: true };
  } catch (error) {
    console.error("Error deleting setup request:", error);
    throw new Error("Failed to delete setup request.");
  }
}

import { clerkClient } from "@clerk/nextjs/server";
import slugify from "slugify";

export async function getPendingAdmins() {
  await ensureSuperUser();
  try {
    return await prisma.admin.findMany({
      where: { status: "pending" },
      orderBy: { lastAiUpdate: "desc" }, // reusing a date field or just default
    });
  } catch (error) {
    console.error("Error fetching pending admins:", error);
    throw new Error("Failed to fetch pending admins.");
  }
}

export async function approveAdmin(adminId: string) {
  await ensureSuperUser();

  try {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
    });

    if (!admin || !admin.pendingSchoolName) {
      return { success: false, error: "Admin or school name not found." };
    }

    const schoolName = admin.pendingSchoolName;
    const baseSlug = slugify(schoolName, { lower: true, strict: true });
    let schoolId = baseSlug;
    let counter = 1;

    // Ensure uniqueness
    while (await prisma.school.findFirst({ where: { id: schoolId } })) {
      schoolId = `${baseSlug}-${counter}`;
      counter++;
    }

    const provisionResult = await provisionSchool(adminId, schoolId, schoolName, admin.email || undefined);
    if (!provisionResult.success) {
      return provisionResult;
    }

    // 5. Update Clerk Metadata
    const client = await clerkClient();
    await client.users.updateUserMetadata(adminId, {
      publicMetadata: {
        role: "admin",
        status: "active",
        schoolId: schoolId,
      },
    });

    revalidatePath("/superadmin");
    return { success: true };
  } catch (error: any) {
    console.error("Approval Error:", error);
    return { success: false, error: error.message || "Failed to approve user." };
  }
}

export async function rejectAdmin(adminId: string) {
  await ensureSuperUser();

  try {
    // 1. Delete from Clerk
    const client = await clerkClient();
    await client.users.deleteUser(adminId);

    // 2. Identify and Update the setup request to 'REFUSED'
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (admin?.email) {
      await prisma.setupRequest.updateMany({
        where: { email: admin.email },
        data: { status: "REFUSED" }
      });
    }

    // 3. Delete from Prisma
    await prisma.admin.delete({
      where: { id: adminId },
    });

    revalidatePath("/superadmin");
    return { success: true };
  } catch (error: any) {
    console.error("Rejection Error:", error);
    return { success: false, error: error.message || "Failed to reject user." };
  }
}

export async function createTestLead() {
  await ensureSuperUser();
  try {
    const testId = "test_lead_" + Math.floor(Math.random() * 10000);
    const schoolName = "Emerald Heights Academy";
    
    // 1. Create SetupRequest
    await prisma.setupRequest.create({
      data: {
        schoolName: schoolName,
        ownerName: "Sarah Jenkins",
        phoneNumber: "+1 555-0123",
        email: "sarah.jenkins@example.com",
        city: "Seattle",
        status: "PENDING"
      }
    });

    // 2. Create Admin record
    await prisma.admin.create({
      data: {
        id: testId,
        username: "sarah_admin",
        email: "sarah.jenkins@example.com",
        name: "Sarah",
        surname: "Jenkins",
        status: "pending",
        pendingSchoolName: schoolName,
        schoolId: "default_school"
      }
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Shared logic to provision all database records required for a school.
 */
export async function provisionSchool(adminId: string, schoolId: string, schoolName: string, email?: string) {
  // Note: Caller should handle ensureSuperUser() or similar authorization
  try {
    // 1. Check if school already exists to prevent crashes
    const existingSchool = await prisma.school.findFirst({ where: { id: schoolId } });
    if (existingSchool) return { success: true };

    await prisma.$transaction(async (tx) => {
      // 1. Create School
      await tx.school.create({
        data: {
          id: schoolId,
          name: schoolName,
          subdomain: schoolId,
          updatedAt: new Date(),
        },
      });

      // 2. Create Institution Settings
      const safeId = Math.floor(Math.random() * 1000000) + 10;
      await tx.institution.create({
        data: {
          id: safeId,
          schoolId: schoolId,
          schoolName: schoolName,
          academicYear: "2025-2026",
          currentSemester: 1,
        },
      });

      // 3. Create Default Levels
      for (const l of [1, 2, 3, 4, 5, 6]) {
        await tx.level.create({
          data: { level: l, schoolId: schoolId },
        });
      }

      // 4. Update Admin
      await tx.admin.update({
        where: { id: adminId },
        data: {
          status: "active",
          schoolId: schoolId,
          pendingSchoolName: null,
        },
      });

      // 5. Update SetupRequest status to 'ACTIVATED'
      if (email) {
        await tx.setupRequest.updateMany({
          where: { email: email },
          data: { status: "ACTIVATED" }
        });
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Provisioning Error:", error);
    return { success: false, error: error.message || "Failed to provision school." };
  }
}
