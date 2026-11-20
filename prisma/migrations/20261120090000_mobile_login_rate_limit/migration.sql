-- Required by the existing phone lookup and password sign-in rate limiter.
CREATE TABLE IF NOT EXISTS "MobileRateLimit" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 1,
  "resetAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "MobileRateLimit_resetAt_idx" ON "MobileRateLimit"("resetAt");
ALTER TABLE "MobileRateLimit" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "MobileRateLimit" FROM anon, authenticated;
