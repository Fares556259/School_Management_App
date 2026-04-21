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
