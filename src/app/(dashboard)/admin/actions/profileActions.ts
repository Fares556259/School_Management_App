"use server";

import prisma from "@/lib/prisma";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function getAdminProfile() {
  const { userId } = auth();
  if (!userId) return { data: null, error: "No user ID found" };

  try {
    // 1. Try finding by current ID
    let admin = await prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      const targetUsername = user.username || user.firstName || userId;

      // 2. Check if an admin already exists with this username (potential conflict)
      const existingByUsername = await prisma.admin.findUnique({
        where: { username: targetUsername },
      });

      if (existingByUsername) {
        await prisma.admin.delete({ where: { id: existingByUsername.id } });
      }

      // 3. Create with BASELINE fields only first (ensure core record exists)
      admin = await prisma.admin.create({
        data: {
          id: userId,
          username: targetUsername,
        }
      });

      // 4. Update with EXTENDED fields
      try {
        admin = await prisma.admin.update({
          where: { id: userId },
          data: {
            email: user.emailAddresses[0]?.emailAddress,
            name: user.firstName,
            surname: user.lastName,
          }
        });
      } catch (updateErr: any) {
        // Continue with skeleton if extended sync fails
      }
    }

    return { data: admin, error: null };
  } catch (error: any) {
    return { data: null, error: `Critical failure during identity synchronization: ${error.message}` };
  }
}

export async function updateAdminProfile(data: {
  name?: string;
  surname?: string;
  email?: string;
  phone?: string;
  img?: string;
}) {
  const { userId } = auth();
  if (!userId) return { success: false, error: "Unauthorized" };

  try {
    const updated = await prisma.admin.upsert({
      where: { id: userId },
      update: {
        name: data.name,
        surname: data.surname,
        email: data.email,
        phone: data.phone,
        img: data.img,
      },
      create: {
        id: userId,
        username: userId, // Fallback if no username
        name: data.name,
        surname: data.surname,
        email: data.email,
        phone: data.phone,
        img: data.img,
      },
    });

    // Optional: Sync with Clerk public metadata or profile
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      firstName: data.name,
      lastName: data.surname,
      // Note: updating email in Clerk is more complex (requires verification), 
      // so we only update our DB and display it.
    });

    revalidatePath("/profile");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating admin profile:", error);
    return { success: false, error: error.message };
  }
}
