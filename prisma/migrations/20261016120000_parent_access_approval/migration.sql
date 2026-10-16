-- AlterTable
ALTER TABLE "Parent" ADD COLUMN     "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "preferredLocale" TEXT NOT NULL DEFAULT 'fr';

-- CreateTable
CREATE TABLE "ParentAccessRequest" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentAccessDelivery" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentAccessDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MobileRateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileRateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "ParentAccessRequest_schoolId_status_createdAt_idx" ON "ParentAccessRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ParentAccessRequest_studentId_status_idx" ON "ParentAccessRequest"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccessRequest_parentId_studentId_key" ON "ParentAccessRequest"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentAccessDelivery_notificationId_key" ON "ParentAccessDelivery"("notificationId");

-- CreateIndex
CREATE INDEX "ParentAccessDelivery_status_nextAttemptAt_idx" ON "ParentAccessDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "ParentAccessDelivery_requestId_status_idx" ON "ParentAccessDelivery"("requestId", "status");

-- CreateIndex
CREATE INDEX "MobileRateLimit_resetAt_idx" ON "MobileRateLimit"("resetAt");

-- AddForeignKey
ALTER TABLE "ParentAccessRequest" ADD CONSTRAINT "ParentAccessRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessRequest" ADD CONSTRAINT "ParentAccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentAccessDelivery" ADD CONSTRAINT "ParentAccessDelivery_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backend-only tables: do not expose requests, delivery data or rate limits via Supabase REST.
-- The trusted database owner/service role used by the server bypasses RLS.
ALTER TABLE "ParentAccessRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccessDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MobileRateLimit" ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "ParentAccessRequest", "ParentAccessDelivery", "MobileRateLimit" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "ParentAccessRequest", "ParentAccessDelivery", "MobileRateLimit" FROM authenticated;
  END IF;
END $$;
