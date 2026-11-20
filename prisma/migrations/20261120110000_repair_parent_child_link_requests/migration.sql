-- Restore the child-link inbox/outbox on databases where parent access columns
-- were repaired manually without installing the original request tables.
-- Additive only: no students, guardians, passwords or existing links are changed.
BEGIN;

ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'fr';

-- CreateTable
CREATE TABLE IF NOT EXISTS "ParentAccessRequest" (
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
CREATE TABLE IF NOT EXISTS "ParentAccessDelivery" (
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

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentAccessRequest_schoolId_status_createdAt_idx" ON "ParentAccessRequest"("schoolId", "status", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentAccessRequest_studentId_status_idx" ON "ParentAccessRequest"("studentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ParentAccessRequest_parentId_studentId_key" ON "ParentAccessRequest"("parentId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ParentAccessDelivery_notificationId_key" ON "ParentAccessDelivery"("notificationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentAccessDelivery_status_nextAttemptAt_idx" ON "ParentAccessDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ParentAccessDelivery_requestId_status_idx" ON "ParentAccessDelivery"("requestId", "status");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParentAccessRequest_parentId_fkey' AND conrelid = '"ParentAccessRequest"'::regclass) THEN
    ALTER TABLE "ParentAccessRequest" ADD CONSTRAINT "ParentAccessRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParentAccessRequest_studentId_fkey' AND conrelid = '"ParentAccessRequest"'::regclass) THEN
    ALTER TABLE "ParentAccessRequest" ADD CONSTRAINT "ParentAccessRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ParentAccessDelivery_parentId_fkey' AND conrelid = '"ParentAccessDelivery"'::regclass) THEN
    ALTER TABLE "ParentAccessDelivery" ADD CONSTRAINT "ParentAccessDelivery_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Backend-only tables: do not expose requests or delivery data via Supabase REST.
-- The trusted database owner/service role used by the server bypasses RLS.
ALTER TABLE "ParentAccessRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ParentAccessDelivery" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "ParentAccessRequest", "ParentAccessDelivery" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "ParentAccessRequest", "ParentAccessDelivery" FROM authenticated;
  END IF;
END $$;

COMMIT;
