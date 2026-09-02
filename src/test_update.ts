import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const schoolId = "bringbringa138gmailcom-1"; // The user's schoolId
  
  // Find a class to test on
  const cls = await prisma.class.findFirst({ where: { schoolId } });
  if (!cls) return console.log("No class");
  
  // Find a timetable slot to simulate editing
  const existingSlot = await prisma.timetableSlot.findFirst({
    where: { classId: cls.id, schoolId }
  });
  if (!existingSlot) return console.log("No slot");
  
  console.log("Found slot:", existingSlot);
  
  // Simulate what ScheduleSlot does when adding a group to an existing slot
  const isDraft = existingSlot.isDraft;
  
  // They send { id: -1, slotNumber: existingSlot.slotNumber, day: existingSlot.day ... }
  const data = {
    id: -1,
    slotNumber: existingSlot.slotNumber,
    day: existingSlot.day,
    classId: existingSlot.classId,
    subjectId: existingSlot.subjectId, // Same subject or different, doesn't matter much
    teacherId: existingSlot.teacherId,
    roomId: existingSlot.roomId,
    duration: existingSlot.duration,
  };
  
  const existingSlots = await prisma.timetableSlot.findMany({
    where: { classId: data.classId, day: data.day, isDraft },
    orderBy: { slotNumber: "asc" }
  });
  const nextSlotNumber = data.slotNumber ?? (existingSlots.length + 1);
  const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
  const nextGroupId = existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1;
  
  console.log("Calculated nextGroupId:", nextGroupId, "nextSlotNumber:", nextSlotNumber);
  
  try {
    const created = await prisma.timetableSlot.create({
      data: {
        day: data.day,
        slotNumber: nextSlotNumber,
        startTime: existingSlot.startTime,
        endTime: existingSlot.endTime,
        duration: data.duration,
        classId: data.classId,
        schoolId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        groupId: nextGroupId,
        isDraft,
        examPeriod: false
      }
    });
    console.log("SUCCESS!", created);
  } catch (err) {
    console.error("FAIL!", err);
  }
}
main();
