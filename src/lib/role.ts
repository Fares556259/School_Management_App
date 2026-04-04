import { auth, clerkClient } from "@clerk/nextjs/server";

export const getRole = async () => {
  const { userId, sessionClaims } = auth();

  if (!userId) return undefined;

  // 1. Try session claims (fastest, no API call)
  const role = (sessionClaims as any)?.metadata?.role as string | undefined;
  if (role) return role;

  // 2. Fallback to Clerk API fetch
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role as string | undefined;
  } catch (error) {
    console.error("Error fetching user role from Clerk:", error);
    return undefined;
  }
};
