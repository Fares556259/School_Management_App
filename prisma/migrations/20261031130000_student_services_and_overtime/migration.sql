ALTER TABLE "Institution" ADD COLUMN "registrationFeeEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "registrationFee" DOUBLE PRECISION NOT NULL DEFAULT 150,
  ADD COLUMN "transportMonthlyFee" DOUBLE PRECISION,
  ADD COLUMN "gardeMonthlyFee" DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("overtimeHours" >= 0), ADD COLUMN "overtimeRate" DOUBLE PRECISION CHECK ("overtimeRate" >= 0);
CREATE UNIQUE INDEX "Student_id_schoolId_key" ON "Student" (id, "schoolId");
CREATE TABLE "StudentServiceAssignment" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('TRANSPORT', 'GARDE')),
  "monthlyFee" DOUBLE PRECISION NOT NULL CHECK ("monthlyFee" >= 0),
  "startPeriod" TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("schoolId", "studentId", kind),
  FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX "StudentServiceAssignment_schoolId_active_idx" ON "StudentServiceAssignment" ("schoolId", active);
CREATE TABLE "StudentCharge" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "studentId" TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('REGISTRATION', 'TRANSPORT', 'GARDE')),
  "academicYear" TEXT NOT NULL, period TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount >= 0), "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK ("paidAmount" >= 0 AND "paidAmount" <= amount),
  "voidedAt" TIMESTAMP(3), "voidReason" TEXT,
  "dueDate" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "studentId", kind, period),
  UNIQUE (id, "schoolId"),
  FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX "StudentCharge_schoolId_academicYear_dueDate_idx" ON "StudentCharge" ("schoolId", "academicYear", "dueDate");
CREATE INDEX "StudentCharge_studentId_idx" ON "StudentCharge" ("studentId");
CREATE TABLE "StudentChargePayment" (
  id TEXT PRIMARY KEY, "schoolId" TEXT NOT NULL REFERENCES "School"(id) ON DELETE CASCADE,
  "chargeId" TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL CHECK (amount > 0), "paymentMethod" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("schoolId", "idempotencyKey"),
  FOREIGN KEY ("chargeId", "schoolId") REFERENCES "StudentCharge"(id, "schoolId") ON DELETE CASCADE
);
CREATE INDEX "StudentChargePayment_schoolId_chargeId_idx" ON "StudentChargePayment" ("schoolId", "chargeId");
