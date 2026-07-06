"use server";

import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";

// ─── Unified Application Model ───────────────────────────────────────────────
export type ApplicationDisplayType = "pending" | "inquiry" | "active";

export type UnifiedApplication = {
  id: string;                   // row key (adminId or setupRequestId)
  displayType: ApplicationDisplayType;
  schoolName: string;
  ownerName: string;
  email: string | null;
  phone: string | null;
  source: string;               // "Signup" | "Synced" | "Test" | "Form"
  date: Date;
  adminId: string | null;       // present when there's a real account to approve
  setupRequestId: string | null;// present when a SetupRequest record exists
};

/**
 * Returns a merged, chronologically ordered list of all applications:
 *  - pending admins (highest priority)
 *  - unmatched setup requests that are not yet activated
 *  - activated setup requests (lowest priority, informational)
 */
export async function getUnifiedApplications(): Promise<UnifiedApplication[]> {
  await ensureSuperUser();

  const [pendingAdmins, allRequests] = await Promise.all([
    prisma.admin.findMany({ where: { status: "pending" } }),
    prisma.setupRequest.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const result: UnifiedApplication[] = [];
  const consumedRequestIds = new Set<string>();

  // 1. Pending admins → "pending" rows (merge with matching SetupRequest if found)
  for (const admin of pendingAdmins) {
    const fullName = [admin.name, admin.surname].filter(Boolean).join(" ") || admin.username;

    // Try to find a matching setup request
    const match = allRequests.find((r) => {
      if (consumedRequestIds.has(r.id)) return false;
      if (admin.email && r.ownerName === admin.email) return true;
      if (admin.pendingSchoolName && r.schoolName === admin.pendingSchoolName) return true;
      if (fullName && r.ownerName === fullName) return true;
      return false;
    });

    if (match) consumedRequestIds.add(match.id);

    result.push({
      id: admin.id,
      displayType: "pending",
      schoolName: admin.pendingSchoolName || match?.schoolName || "—",
      ownerName: fullName,
      email: admin.email ?? null,
      phone: match?.phoneNumber || null,
      source: match ? mapSource(match.city) : "Signup",
      date: match?.createdAt ?? new Date(),
      adminId: admin.id,
      setupRequestId: match?.id ?? null,
    });
  }

  // 2. Remaining setup requests (not already merged with a pending admin)
  for (const req of allRequests) {
    if (consumedRequestIds.has(req.id)) continue;

    const isActive = req.status === "ACTIVATED";
    result.push({
      id: req.id,
      displayType: isActive ? "active" : "inquiry",
      schoolName: req.schoolName,
      ownerName: req.ownerName,
      email: null,
      phone: req.phoneNumber || null,
      source: mapSource(req.city),
      date: req.createdAt,
      adminId: null,
      setupRequestId: req.id,
    });
  }

  // Sort: pending first, then by date desc
  const order: Record<ApplicationDisplayType, number> = { pending: 0, inquiry: 1, active: 2 };
  result.sort((a, b) => {
    const diff = order[a.displayType] - order[b.displayType];
    return diff !== 0 ? diff : b.date.getTime() - a.date.getTime();
  });

  return result;
}

function mapSource(city: string | null | undefined): string {
  if (!city) return "Form";
  const c = city.toLowerCase();
  if (c.includes("sync")) return "Synced";
  if (c.includes("signup") || c.includes("sign")) return "Signup";
  if (c.includes("test")) return "Test";
  return city;
}

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

import { createClient } from "@/utils/supabase/server";
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

    const provisionResult = await provisionSchool(adminId, schoolId, schoolName);
    if (!provisionResult.success) {
      return provisionResult;
    }

    // 5. Update Supabase Auth Metadata so the user can access their dashboard
    await supabaseAdmin.auth.admin.updateUserById(adminId, {
      user_metadata: {
        role: "admin",
        status: "active",
        schoolId: schoolId,
        schoolName: schoolName,
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
    
    await supabaseAdmin.auth.admin.deleteUser(adminId);

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
    const rand = Math.floor(Math.random() * 10000);
    const schoolName = `Test Academy ${rand}`;
    
    // Create a SetupRequest (lead) only — no fake auth user needed
    await prisma.setupRequest.create({
      data: {
        schoolName: schoolName,
        ownerName: `Test Owner ${rand}`,
        phoneNumber: "+216 00 000 000",
        city: "Test City",
        status: "PENDING",
      },
    });

    revalidatePath("/superadmin");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Shared logic to provision all database records required for a school.
 */
export async function provisionSchool(adminId: string, schoolId: string, schoolName: string) {
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
          activatedAt: new Date(),
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
    });

    return { success: true };
  } catch (error: any) {
    console.error("Provisioning Error:", error);
    return { success: false, error: error.message || "Failed to provision school." };
  }
}

// ─── Subscriptions ─────────────────────────────────────────────────────────────

export async function getSubscriptions() {
  await ensureSuperUser();
  try {
    const schools = await prisma.school.findMany({
      include: {
        Admin: {
          take: 1, // Get the primary admin
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return schools.map(school => ({
      id: school.id,
      name: school.name,
      subdomain: school.subdomain,
      logo: school.logo,
      status: school.status || "ACTIVE", // ACTIVE, SUSPENDED, TRIAL
      plan: school.plan || "FREE",
      createdAt: school.createdAt,
      activatedAt: school.activatedAt || school.createdAt,
      admin: school.Admin[0] ? {
        name: `${school.Admin[0].name || ""} ${school.Admin[0].surname || ""}`.trim() || school.Admin[0].username,
        email: school.Admin[0].email,
        phone: school.Admin[0].phone,
      } : null,
    }));
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    throw new Error("Failed to fetch subscriptions.");
  }
}

export async function toggleSchoolStatus(schoolId: string, newStatus: string) {
  await ensureSuperUser();
  try {
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: newStatus },
    });
    revalidatePath("/superadmin/subscriptions");
    return { success: true };
  } catch (error: any) {
    console.error("Toggle Status Error:", error);
    return { success: false, error: error.message || "Failed to update school status." };
  }
}
