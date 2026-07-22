import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Use ANON_KEY with PUBLISHABLE_KEY as fallback (both names are used across the codebase)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || ''

  // During `next build` prerendering, env vars may be empty.
  // Return a stub client that won't crash — pages using it will
  // be re-rendered at runtime with real values.
  if (!url || !key) {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

  return createBrowserClient(url, key)
}
