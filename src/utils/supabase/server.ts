import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = () => {
  // Use PUBLISHABLE_KEY with ANON_KEY as fallback (both names are used across the codebase)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // During `next build` prerendering, env vars may be empty.
  // Use placeholder values to prevent the build from crashing.
  const safeUrl = url || 'https://placeholder.supabase.co';
  const safeKey = key || 'placeholder-key';

  const cookieStore = cookies();
  return createServerClient(
    safeUrl,
    safeKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};
