CREATE TABLE "StudentChargeCategory" (
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

CREATE UNIQUE INDEX "StudentChargeCategory_schoolId_kind_key" ON "StudentChargeCategory"("schoolId", "kind");
CREATE INDEX "StudentChargeCategory_schoolId_active_idx" ON "StudentChargeCategory"("schoolId", "active");
ALTER TABLE "StudentChargeCategory" ADD CONSTRAINT "StudentChargeCategory_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE CASCADE ON UPDATE CASCADE;
