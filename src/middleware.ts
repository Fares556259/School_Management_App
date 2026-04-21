import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/waiting-approval",
  "/request-setup(.*)",
  "/api/mobile(.*)", 
  "/uploads(.*)",
  "/public(.*)",
  "/api/public(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  
  const { userId } = auth();

  if (!userId) return;

  // 1. TRY: Session Claims (FAST - No Network)
  let metadata = (auth().sessionClaims as any)?.metadata;
  let role = metadata?.role as string | undefined;
  let status = metadata?.status as string | undefined;

  // 2. FALLBACK: Fetch from Clerk API
  if ((!role || !status) && userId) {
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(userId);
      role = user.publicMetadata?.role as string | undefined;
      status = user.publicMetadata?.status as string | undefined;
    } catch (err) {
      console.error("Clerk Fallback Error:", err);
    }
  }

  // 3. ENFORCE APPROVAL STATUS
  // Only 'active' users can enter the app dashboards (Superusers are exempt)
  if (status !== "active" && role !== "superuser") {
    return NextResponse.redirect(new URL("/waiting-approval", req.url));
  }

  // 4. ROLE-BASED AUTHORIZATION
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
    // Also explicitly skip /uploads-proxy to ensure mobile app can always access it
    "/((?!_next|uploads-proxy|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
