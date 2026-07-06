import { createClient } from "@/utils/supabase/server";
import prisma from "./prisma";

export const getRole = async () => {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) return undefined;

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
};
