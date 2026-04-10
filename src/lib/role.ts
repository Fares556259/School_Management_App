import { auth, clerkClient } from "@clerk/nextjs/server";

export const getRole = async () => {
  const { userId, sessionClaims } = auth();

  if (!userId) return undefined;

  // 1. USE SESSION CLAIMS (Fast Path)
  const role = (sessionClaims as any)?.metadata?.role as string | undefined;
  if (role) return role;

  // 2. DEFENSIVE FALLBACK (Safe Path - API call)
  // Re-added this to prevent lockouts while user configures JWT Templates
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role as string | undefined;
  } catch (error) {
    console.error("Error fetching user role from Clerk fallback:", error);
    return undefined;
  }
};
