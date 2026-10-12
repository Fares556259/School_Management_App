-- Some legacy timetable rows retained the old default tenant after their
-- classes were assigned to a real school. Class ownership is authoritative.
UPDATE "TimetableSlot" AS slot
SET "schoolId" = class."schoolId"
FROM "Class" AS class
WHERE slot."classId" = class."id"
  AND slot."schoolId" <> class."schoolId";
