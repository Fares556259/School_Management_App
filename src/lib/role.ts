import { auth, clerkClient } from "@clerk/nextjs/server";

export const getRole = async () => {
  const { userId } = auth();

  if (!userId) return undefined;

  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  return user.publicMetadata?.role as string | undefined;
};
