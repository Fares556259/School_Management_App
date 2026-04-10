import { auth, clerkClient } from "@clerk/nextjs/server";

export const getRole = async () => {
  const { userId, sessionClaims } = auth();

  if (!userId) return undefined;

  // 1. USE SESSION CLAIMS ONLY (Maximum Performance)
  // This reads the role directly from the JWT token.
  // Requires "role" to be added to the Clerk JWT Template.
  const role = (sessionClaims as any)?.metadata?.role as string | undefined;
  
  return role;
};
