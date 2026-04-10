import { clerkMiddleware, clerkClient, createRouteMatcher } from "@clerk/nextjs/server";
import { routeAccessMap } from "./lib/settings";
import { NextResponse } from "next/server";

const matchers = Object.keys(routeAccessMap).map((route) => ({
  matcher: createRouteMatcher([route]),
  allowedRoles: routeAccessMap[route],
}));

export default clerkMiddleware(async (auth, req) => {
  const { userId } = auth();

  // 1. If not logged in, we let the route matcher handle public/private logic
  // However, we only care about role-based access if they ARE logged in
  if (!userId) return;

  // 2. EXTRACTION: Get role from Session Claims (FAST - No Network)
  // This requires the user to set up a JWT Template in Clerk Dashboard: 
  // { "metadata": { "role": "{{user.public_metadata.role}}" } }
  const role = (auth().sessionClaims as any)?.metadata?.role as string | undefined;

  // 3. AUTHORIZATION: Check matching routes
  for (const { matcher, allowedRoles } of matchers) {
    if (matcher(req)) {
      // If the user has NO role, or their role isn't allowed, redirect them.
      // We redirect to their own dashboard if they have one, otherwise to the root.
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
