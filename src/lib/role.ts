import { cache } from "react";
import { getAuthenticatedUser } from "@/utils/supabase/server";
import prisma from "./prisma";

export const getRole = cache(async () => {
  const user = await getAuthenticatedUser();

  if (!user) return undefined;

  // 1. USE USER METADATA (Fast Path)
  const role = user.user_metadata?.role as string | undefined;
  if (role) return role;

  // 2. DATABASE FALLBACK (Final Safety Net)
  // If metadata is empty, check if they exist in our Admin table
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: user.id },
      select: { id: true }
    });
    if (admin) return "admin";
  } catch (dbErr) {
    console.error("Database fallback error in getRole:", dbErr);
  }

  return undefined;
});
