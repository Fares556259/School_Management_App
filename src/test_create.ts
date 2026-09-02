import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const schoolId = "bringbringa138gmailcom-1"; // the user's schoolId
    const cls = await prisma.class.findFirst({ where: { schoolId } });
    if (!cls) return console.log("No class");
    
    // find a slot
    const existingSlot = await prisma.timetableSlot.findFirst({
      where: { classId: cls.id, schoolId }
    });
    if (!existingSlot) return console.log("No slot");
    
    console.log("Existing slot:", existingSlot);
    
    // Simulate what ScheduleSlot sends
    const data = {
      id: -1,
      classId: existingSlot.classId,
      day: existingSlot.day,
      slotNumber: existingSlot.slotNumber,
      startTime: existingSlot.startTime,
      endTime: existingSlot.endTime,
      duration: existingSlot.duration,
      subjectId: existingSlot.subjectId,
      teacherId: existingSlot.teacherId,
      roomId: existingSlot.roomId,
      examPeriod: false,
      isDraft: false
    };

    // run the updateTimetableSlot logic
    const existingSlots = await prisma.timetableSlot.findMany({
      where: { classId: data.classId, day: data.day, isDraft: false },
      orderBy: { slotNumber: "asc" }
    });
    
    const nextSlotNumber = data.slotNumber ?? (existingSlots.length + 1);
    const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
    const nextGroupId = existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1;
    
    console.log("Next Group ID:", nextGroupId);
    
    const institution = await prisma.institution.findFirst({ where: { schoolId } });
    const dayEnd = (institution as any)?.dayEndTime || "14:00";
    const actualSlotEnd = data.endTime;
    const [eH, eM] = dayEnd.split(":").map(Number);
    const [sH, sM] = actualSlotEnd.split(":").map(Number);
    
    if (sH * 60 + sM > eH * 60 + eM) {
      console.log("Validation failed! slotEnd exceeds dayEnd");
      return;
    }
    
    const created = await prisma.timetableSlot.create({
      data: {
        day: data.day,
        slotNumber: nextSlotNumber,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        classId: data.classId,
        schoolId,
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        groupId: nextGroupId,
        isDraft: false,
        examPeriod: false
      }
    });
    
    console.log("Success:", created);
  } catch (err) {
    console.error("Error creating slot:", err);
  }
}
main();
