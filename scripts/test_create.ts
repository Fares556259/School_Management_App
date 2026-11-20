import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  try {
    const existingSlots = await prisma.timetableSlot.findMany({
      where: { classId: 111, day: "WEDNESDAY", isDraft: false },
      orderBy: { slotNumber: "asc" }
    });
    const nextSlotNumber = 2; // Simulating data.slotNumber
    
    const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
    console.log("existingGroupSlots count:", existingGroupSlots.length);
    const nextGroupId = existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1;
    console.log("nextGroupId:", nextGroupId);
    
    // Simulate what the second iteration does
    const created = await prisma.timetableSlot.create({
      data: {
        day: "WEDNESDAY",
        slotNumber: 2,
        startTime: "09:00",
        endTime: "11:00",
        duration: 120,
        classId: 111,
        schoolId: "bringbringa138gmailcom-1",
        subjectId: 103, // A different subject
        teacherId: "42de874d-da3c-4550-a7f6-b27e0cd7799a",
        roomId: 12,
        isDraft: false,
        groupId: nextGroupId
      }
    });
    console.log("Created successfully:", created.id);
  } catch (err) {
    console.error("Error creating:", err);
  }
}
test();
