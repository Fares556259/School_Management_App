-- Restore the optional field expected by existing student and finance queries.
ALTER TABLE "Student" ADD COLUMN IF NOT EXISTS "tuitionOverrides" JSONB;
