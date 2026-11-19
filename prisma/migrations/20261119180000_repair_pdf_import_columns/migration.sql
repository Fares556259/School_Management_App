-- Repair known schema drift without replacing records or changing existing values.
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Parent" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE "Student" ALTER COLUMN "birthday" DROP NOT NULL;
