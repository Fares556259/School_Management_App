-- Additive repair for a deployment missing the billing migrations.
-- Creates billing storage and missing supporting columns; no fee changes,
-- payment collection, ledger backfill, student updates, resets or seeds.
-- Existing tables must have compatible definitions; this is not a blanket drift repair.
BEGIN;
SET LOCAL search_path = public;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '45s';

ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "registrationFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 150,
  ADD COLUMN IF NOT EXISTS "transportMonthlyFee" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gardeMonthlyFee" DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("overtimeHours" >= 0), ADD COLUMN IF NOT EXISTS "overtimeRate" DOUBLE PRECISION CHECK ("overtimeRate" >= 0);
CREATE UNIQUE INDEX IF NOT EXISTS "Student_id_schoolId_key" ON "Student" (id, "schoolId");
CREATE TABLE IF NOT EXISTS "StudentServiceAssignment" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('REGISTRATION', 'TRANSPORT', 'GARDE') OR kind ~ '^CUSTOM_[a-z0-9]{20,32}$'),
  "monthlyFee" DOUBLE PRECISION NOT NULL CHECK ("monthlyFee" >= 0),
  "discountType" TEXT, "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startPeriod" TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("schoolId", "studentId", kind),
  FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentServiceAssignment_schoolId_active_idx" ON "StudentServiceAssignment" ("schoolId", active);
CREATE TABLE IF NOT EXISTS "StudentCharge" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('REGISTRATION', 'TRANSPORT', 'GARDE') OR kind ~ '^CUSTOM_[a-z0-9]{20,32}$'),
  "academicYear" TEXT NOT NULL, period TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0), "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("paidAmount" >= 0 AND "paidAmount" <= amount),
  "voidedAt" TIMESTAMP(3), "voidReason" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "studentId", kind, period),
  UNIQUE (id, "schoolId"),
  FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentCharge_schoolId_academicYear_dueDate_idx" ON "StudentCharge" ("schoolId", "academicYear", "dueDate");
CREATE INDEX IF NOT EXISTS "StudentCharge_studentId_idx" ON "StudentCharge" ("studentId");
CREATE TABLE IF NOT EXISTS "StudentChargePayment" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "chargeId" TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0), "paymentMethod" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "idempotencyKey"),
  FOREIGN KEY ("chargeId", "schoolId") REFERENCES "StudentCharge"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "StudentChargePayment_schoolId_chargeId_idx" ON "StudentChargePayment" ("schoolId", "chargeId");

ALTER TABLE "Institution" ADD COLUMN IF NOT EXISTS "registrationReconciliationYear" TEXT,
  ADD COLUMN IF NOT EXISTS "transportFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "gardeFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN IF NOT EXISTS "transportNextFrequency" TEXT,
  ADD COLUMN IF NOT EXISTS "gardeNextFrequency" TEXT,
  ADD COLUMN IF NOT EXISTS "transportFrequencyYear" TEXT,
  ADD COLUMN IF NOT EXISTS "gardeFrequencyYear" TEXT;
CREATE TABLE IF NOT EXISTS "StudentBillingReceipt" (
  "id" TEXT NOT NULL,
  "schoolId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,
  "allocations" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StudentBillingReceipt_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "StudentBillingReceipt" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT 'Espèces';
CREATE UNIQUE INDEX IF NOT EXISTS "StudentBillingReceipt_schoolId_idempotencyKey_key" ON "StudentBillingReceipt"("schoolId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "StudentBillingReceipt_schoolId_studentId_createdAt_idx" ON "StudentBillingReceipt"("schoolId", "studentId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBillingReceipt_schoolId_fkey' AND conrelid = '"StudentBillingReceipt"'::regclass) THEN
    ALTER TABLE "StudentBillingReceipt" ADD CONSTRAINT "StudentBillingReceipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentBillingReceipt_studentId_schoolId_fkey' AND conrelid = '"StudentBillingReceipt"'::regclass) THEN
    ALTER TABLE "StudentBillingReceipt" ADD CONSTRAINT "StudentBillingReceipt_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS "StudentChargeCategory" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "nextFrequency" TEXT,
    "frequencyYear" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudentChargeCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StudentChargeCategory_schoolId_kind_key" ON "StudentChargeCategory"("schoolId", "kind");
CREATE INDEX IF NOT EXISTS "StudentChargeCategory_schoolId_active_idx" ON "StudentChargeCategory"("schoolId", "active");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentChargeCategory_schoolId_fkey' AND conrelid = '"StudentChargeCategory"'::regclass) THEN
    ALTER TABLE "StudentChargeCategory" ADD CONSTRAINT "StudentChargeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Billing records are accessible only through the trusted, school-scoped backend.
ALTER TABLE "StudentServiceAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentChargePayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentBillingReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudentChargeCategory" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "StudentServiceAssignment", "StudentCharge", "StudentChargePayment", "StudentBillingReceipt", "StudentChargeCategory" FROM PUBLIC;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
  REVOKE ALL ON TABLE "StudentServiceAssignment", "StudentCharge", "StudentChargePayment", "StudentBillingReceipt", "StudentChargeCategory" FROM anon;
END IF; END $$;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
  REVOKE ALL ON TABLE "StudentServiceAssignment", "StudentCharge", "StudentChargePayment", "StudentBillingReceipt", "StudentChargeCategory" FROM authenticated;
END IF; END $$;

COMMIT;
