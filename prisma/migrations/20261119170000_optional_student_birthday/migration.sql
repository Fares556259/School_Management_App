-- Preserve existing birthdays; allow an unknown birthday without inventing a date.
ALTER TABLE "Student" ALTER COLUMN "birthday" DROP NOT NULL;
