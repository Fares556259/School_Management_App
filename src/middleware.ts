import { NextResponse, type NextRequest } from "next/server";
import { routeAccessMap } from "./lib/settings";
import { createServerClient } from "@supabase/ssr";

const isPublicRoute = (pathname: string) => {
  const publicPaths = [
    "/",
    "/sign-in",
    "/sign-up",
    "/waiting-approval",
    "/request-setup",
    "/join",
  ];
  if (publicPaths.some(p => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (pathname.startsWith("/api/join")) return true;
  if (pathname.startsWith("/api/mobile")) return true;
  if (pathname.startsWith("/uploads")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname.startsWith("/api/public")) return true;
  if (pathname.startsWith("/api/dev-promote")) return true;
  if (pathname.startsWith("/api/dev-reset-password")) return true;
  return false;
};

const isAuthRoute = (pathname: string) => {
  return pathname === "/sign-in" || pathname === "/sign-up";
};

const getMatcherRoles = (pathname: string) => {
  for (const route in routeAccessMap) {
    // For wildcard routes like "/admin(.*)", use the pattern as-is.
    // For static routes like "/list/teachers", match the exact path
    // OR any sub-paths (e.g. "/list/teachers/123").
    const hasWildcard = route.includes("(.*)");
    const pattern = hasWildcard
      ? `^${route.replace(/\(\.\*\)/, ".*")}$`
      : `^${route}(/.*)?$`;
    const regex = new RegExp(pattern);
    if (regex.test(pathname)) {
      return routeAccessMap[route];
    }
  }
  return null;
};

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Wrap in try/catch — if Supabase is unreachable, treat user as unauthenticated
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (error) {
    console.error("[MIDDLEWARE] Supabase auth error:", error);
    // Allow the request through for public routes; redirect to sign-in otherwise
  }

  const pathname = request.nextUrl.pathname;
  const isPublic = isPublicRoute(pathname);
  const isAuth = isAuthRoute(pathname);

  const redirectWithCookies = (url: URL) => {
    const redirectRes = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectRes.cookies.set(cookie.name, cookie.value);
    });
    return redirectRes;
  };

  // ── 1. NOT LOGGED IN ────────────────────────────────────────────────────────
  if (!user) {
    if (!isPublic) {
      return redirectWithCookies(new URL("/sign-in", request.url));
    }
    return supabaseResponse;
  }

  // ── 2. LOGGED IN — read role & status from metadata ─────────────────────────
  const role = user.user_metadata?.role as string | undefined;
  const status = user.user_metadata?.status as string | undefined;

  // Superadmin — always allow through + bounce away from auth/admin pages
  if (role === "superadmin") {
    if (isAuth || pathname === "/waiting-approval" || pathname.startsWith("/admin")) {
      return redirectWithCookies(new URL("/superadmin", request.url));
    }
    return supabaseResponse;
  }

  // Active admin — bounce away from auth/waiting pages
  if (role === "admin" && status === "active") {
    if (isAuth || pathname === "/waiting-approval") {
      return redirectWithCookies(new URL("/admin", request.url));
    }
    // Role-based route guard
    if (!isPublic) {
      const allowedRoles = getMatcherRoles(pathname);
      if (allowedRoles && !allowedRoles.includes(role)) {
        return redirectWithCookies(new URL("/admin", request.url));
      }
    }
    return supabaseResponse;
  }

  // Active teacher/student/parent — allow access with role-based guard
  const dashboardRoles = ["teacher", "student", "parent"];
  if (role && dashboardRoles.includes(role) && status === "active") {
    if (isAuth || pathname === "/waiting-approval") {
      // Redirect to the appropriate dashboard
      const dashboardPath = role === "parent" ? "/parent" : `/${role}`;
      return redirectWithCookies(new URL(dashboardPath, request.url));
    }
    // Role-based route guard
    if (!isPublic) {
      const allowedRoles = getMatcherRoles(pathname);
      if (allowedRoles && !allowedRoles.includes(role)) {
        const dashboardPath = role === "parent" ? "/parent" : `/${role}`;
        return redirectWithCookies(new URL(dashboardPath, request.url));
      }
    }
    return supabaseResponse;
  }

  // Pending user (any role without active status) — trap on waiting-approval
  if (!isPublic && pathname !== "/waiting-approval") {
    return redirectWithCookies(new URL("/waiting-approval", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|public|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|pdf)).*)",
    "/(api|trpc)(.*)",
  ],
};
