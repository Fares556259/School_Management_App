"use server";

import prisma from "@/lib/prisma";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { revalidatePath } from "next/cache";
import { cache } from "react";

export const getAdminProfile = cache(async () => {
  const user = await getAuthenticatedUser();
  const userId = user?.id;
  if (!userId) return { data: null, error: "No user ID found" };

  try {
    // 1. Try finding by current ID
    let admin = await prisma.admin.findUnique({
      where: { id: userId },
    });

    if (!admin) {
      const adminUser = (await supabaseAdmin.auth.admin.getUserById(userId)).data.user;
      if (!adminUser) return { data: null, error: "User not found in Supabase Auth" };

      const targetUsername = adminUser.user_metadata?.username || adminUser.user_metadata?.firstName || userId;

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
            name: adminUser.user_metadata?.firstName,
            surname: adminUser.user_metadata?.lastName,
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
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;
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
    
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        firstName: data.name,
        lastName: data.surname,
      }
    });

    revalidatePath("/profile");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("Error updating admin profile:", error);
    return { success: false, error: error.message };
  }
}
