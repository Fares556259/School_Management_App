import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth();

  if (!userId) return;

  // 1. TRY: Session Claims (FAST - No Network)
  let role = (auth().sessionClaims as any)?.metadata?.role as string | undefined;

  // 2. FALLBACK: Fetch from Clerk API (Wait for user to fix JWT Template)
  // We only do this if role is missing to avoid locking out the user
  if (!role && userId) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      role = user.publicMetadata?.role as string | undefined;
      console.warn(`[PERF WARNING] Role missing from session claims for user ${userId}. Falling back to API fetch. Please configure Clerk JWT Templates for better performance.`);
    } catch (err) {
      console.error("Clerk Fallback Error:", err);
    }
  }

  // 3. AUTHORIZATION
  for (const { matcher, allowedRoles } of matchers) {
    if (matcher(req)) {
      if (!role || !allowedRoles.includes(role)) {
        const redirectUrl = role ? `/${role}` : "/";
        return NextResponse.redirect(new URL(redirectUrl, req.url));
      }
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
