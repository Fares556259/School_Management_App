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
  const { userId } = auth();
  const isPublic = isPublicRoute(req);
  const isWaitingPage = req.nextUrl.pathname === "/waiting-approval";

  // 1. If not logged in and not public, Clerk handles the redirect to sign-in
  if (!userId && !isPublic) return;

  // 2. If logged in, we check metadata for redirect logic
  let role: string | undefined;
  let status: string | undefined;

  if (userId) {
    // Session claims for speed
    const metadata = (auth().sessionClaims as any)?.metadata;
    role = metadata?.role as string | undefined;
    status = metadata?.status as string | undefined;

    // Fallback to API
    if (!role || !status) {
      try {
        const client = await clerkClient();
        const user = await client.users.getUser(userId);
        role = user.publicMetadata?.role as string | undefined;
        status = user.publicMetadata?.status as string | undefined;
      } catch (err) { }
    }

    // 🚀 REDIRECT ACTIVE USERS AWAY FROM WAITING PAGE
    if (status === "active" && isWaitingPage) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }

    // 🔒 TRAP PENDING USERS ON WAITING PAGE
    if (status !== "active" && role !== "superadmin" && !isPublic) {
      return NextResponse.redirect(new URL("/waiting-approval", req.url));
    }
  }

  if (isPublic) return;

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
