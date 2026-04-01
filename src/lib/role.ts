import { auth, clerkClient } from "@clerk/nextjs/server";

export const getRole = async () => {
  const { userId } = auth();

  if (!userId) return undefined;

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    return user.publicMetadata?.role as string | undefined;
  } catch (error) {
    console.error("Error fetching user role from Clerk:", error);
    return undefined;
  }
};
