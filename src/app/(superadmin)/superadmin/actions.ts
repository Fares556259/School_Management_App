"use server";

import prisma from "@/lib/prisma";
import { getRole } from "@/lib/role";
import { revalidatePath } from "next/cache";

/**
 * Ensures the caller has the 'superuser' role.
 */
async function ensureSuperUser() {
  const role = await getRole();
  if (role !== "superuser") {
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

/**
 * Activates a setup request, enabling that email to sign up.
 * The school infrastructure will be auto-provisioned after sign-up.
 */
export async function activateSetup(id: string) {
  await ensureSuperUser();

  try {
    const request = await prisma.setupRequest.findUnique({ where: { id } });
    if (!request) return { success: false, error: "Request not found." };
    if (request.status === "ACTIVATED" || request.status === "PROVISIONED") {
      return { success: false, error: "This request is already activated or provisioned." };
    }

    await prisma.setupRequest.update({
      where: { id },
      data: { status: "ACTIVATED" },
    });

    revalidatePath("/superadmin");
    return { success: true, email: request.email };
  } catch (error: any) {
    console.error("Error activating setup request:", error);
    return { success: false, error: error.message || "Failed to activate." };
  }
}
