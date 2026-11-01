ALTER TABLE "Institution" ADD COLUMN "registrationReconciliationYear" TEXT;
ALTER TABLE "StudentChargePayment" ADD COLUMN "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
