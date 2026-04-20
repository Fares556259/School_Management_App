/**
 * Production Environment Validator
 * 
 * This utility ensures that all critical environment variables are present
 * before the application proceeds with sensitive operations.
 * It is designed to fail-fast during the build or startup phase.
 */

const REQUIRED_ENV_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "GEMINI_API_KEY",
  "RESEND_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
] as const;

export function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

  if (missing.length > 0) {
    const errorMsg = `❌ [ENV ERROR] The following required environment variables are missing: ${missing.join(
      ", "
    )}. Please check your production dashboard or .env file.`;
    
    // In production, we throw to prevent the app from starting in a broken state
    if (process.env.NODE_ENV === "production") {
      throw new Error(errorMsg);
    } else {
      console.error(errorMsg);
    }
    return false;
  }

  console.log("✅ [ENV] All required environment variables are present.");
  return true;
}

/**
 * Checks if a specific variable is present without throwing
 */
export function hasEnv(key: string): boolean {
  return !!process.env[key];
}
