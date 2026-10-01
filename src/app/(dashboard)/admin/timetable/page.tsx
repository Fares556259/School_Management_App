export const dynamic = "force-dynamic";

import prisma from "@/lib/prisma";
import { getSchoolId } from "@/lib/school";
import TimetableClient from "./TimetableClient";

const TimetablePage = async ({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) => {
  let schoolId = await getSchoolId();

  // 1. Fetch classes for the resolved school
  let classes = await prisma.class.findMany({
    where: { schoolId },
    include: { level: true },
    orderBy: { name: "asc" },
  });

  // Fallback: If current schoolId has 0 classes, check leaders-1 or leaders
  if (classes.length === 0) {
    for (const fallbackId of ["leaders-1", "leaders"]) {
      if (fallbackId !== schoolId) {
        const fallbackClasses = await prisma.class.findMany({
          where: { schoolId: fallbackId },
          include: { level: true },
          orderBy: { name: "asc" },
        });
        if (fallbackClasses.length > 0) {
          schoolId = fallbackId;
          classes = fallbackClasses;
          break;
        }
      }
    }
  }

  // 2. Fetch all other timetable data in parallel for the effective schoolId
  const [subjects, teachers, institution, rooms, allActiveSlots] = await Promise.all([
    prisma.subject.findMany({
      where: { schoolId, parentId: null },
      orderBy: { name: "asc" },
    }),
    prisma.teacher.findMany({
      where: { schoolId },
      include: {
        classes: { select: { id: true } },
        subjects: { select: { id: true } },
      },
      orderBy: [{ name: "asc" }, { surname: "asc" }],
    }),
    prisma.institution.findFirst({
      where: { schoolId },
      select: { dayStartTime: true, dayEndTime: true },
    }),
    prisma.room.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
    }),
    prisma.timetableSlot.findMany({
      where: { schoolId, isDraft: false },
      include: {
        subject: true,
        teacher: true,
        room: true,
      },
    }),
  ]);

  const configuredStartTime = institution?.dayStartTime || "08:00";
  const configuredEndTime = institution?.dayEndTime || "14:00";

  // Calculate earliest start and latest end from slots if any slot extends beyond configured bounds
  const earliestSlotStartTime = allActiveSlots.reduce((earliest, s) => {
    if (s.startTime && s.startTime < earliest) return s.startTime;
    return earliest;
  }, configuredStartTime);

  const latestSlotEndTime = allActiveSlots.reduce((latest, s) => {
    if (s.endTime && s.endTime > latest) return s.endTime;
    return latest;
  }, configuredEndTime);

  const dayStartTime = earliestSlotStartTime < configuredStartTime ? earliestSlotStartTime : configuredStartTime;
  const dayEndTime = latestSlotEndTime > configuredEndTime ? latestSlotEndTime : configuredEndTime;

  return (
    <TimetableClient
      classes={classes}
      subjects={subjects}
      teachers={teachers}
      dayStartTime={dayStartTime}
      dayEndTime={dayEndTime}
      rooms={rooms}
      allActiveSlots={allActiveSlots}
    />
  );
};

export default TimetablePage;
