ALTER TABLE "Institution" ADD COLUMN "transportFrequency" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Institution" ADD COLUMN "gardeFrequency" TEXT NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Institution" ADD COLUMN "transportNextFrequency" TEXT;
ALTER TABLE "Institution" ADD COLUMN "gardeNextFrequency" TEXT;
ALTER TABLE "Institution" ADD COLUMN "transportFrequencyYear" TEXT;
ALTER TABLE "Institution" ADD COLUMN "gardeFrequencyYear" TEXT;
ALTER TABLE "StudentServiceAssignment" ADD COLUMN "discountType" TEXT;
ALTER TABLE "StudentServiceAssignment" ADD COLUMN "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
CREATE TABLE "StudentBillingReceipt" (
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
CREATE UNIQUE INDEX "StudentBillingReceipt_schoolId_idempotencyKey_key" ON "StudentBillingReceipt"("schoolId", "idempotencyKey");
CREATE INDEX "StudentBillingReceipt_schoolId_studentId_createdAt_idx" ON "StudentBillingReceipt"("schoolId", "studentId", "createdAt");
ALTER TABLE "StudentBillingReceipt" ADD CONSTRAINT "StudentBillingReceipt_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentBillingReceipt" ADD CONSTRAINT "StudentBillingReceipt_studentId_schoolId_fkey" FOREIGN KEY ("studentId", "schoolId") REFERENCES "Student"("id", "schoolId") ON DELETE CASCADE ON UPDATE CASCADE;
