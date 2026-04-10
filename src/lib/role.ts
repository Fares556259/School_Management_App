import { auth, clerkClient } from "@clerk/nextjs/server";
import prisma from "./prisma";

export const getRole = async () => {
  const { userId, sessionClaims } = auth();

  if (!userId) return undefined;

  // 1. USE SESSION CLAIMS (Fast Path)
  const role = (sessionClaims as any)?.metadata?.role as string | undefined;
  if (role) return role;

  // 2. DEFENSIVE FALLBACK (Safe Path - API call)
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const role = user.publicMetadata?.role as string | undefined;
    if (role) return role;
  } catch (error) {
    console.warn("Clerk Role Fetch failed, trying DB fallback:", error);
  }

  // 3. DATABASE FALLBACK (Final Safety Net)
  // If Clerk is unreachable or metadata is empty, check if they exist in our Admin table
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    if (admin) return "admin";
  } catch (dbErr) {
    console.error("Database fallback error in getRole:", dbErr);
  }

  return undefined;
};
