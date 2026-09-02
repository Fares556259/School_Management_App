const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify&connection_limit=1&pool_timeout=60&connect_timeout=60"
    }
  }
});

async function main() {
  const data = {
    id: -1,
    classId: 111,
    day: 'SATURDAY',
    slotNumber: 3,
    startTime: '11:00',
    endTime: '13:00',
    duration: 120,
    subjectId: 99,
    teacherId: '4f196a73-433b-496e-8a24-495910a8fbe2',
    roomId: 12,
    isDraft: false
  };

  const existingSlots = await prisma.timetableSlot.findMany({
    where: { classId: data.classId, day: data.day, isDraft: false },
    orderBy: { slotNumber: "asc" }
  });
  
  const nextSlotNumber = data.slotNumber ?? (existingSlots.length + 1);
  const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
  const nextGroupId = existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1;
  
  console.log("Calculated nextGroupId:", nextGroupId, "for slotNumber:", nextSlotNumber);
  
  const institution = await prisma.institution.findFirst({ where: { schoolId: 'bringbringa138gmailcom-1' } });
  const dayEnd = institution?.dayEndTime || "14:00";
  const prevSlot = existingSlots[existingSlots.length - 1];
  const slotStart = prevSlot ? prevSlot.endTime : "08:00";
  const slotEnd = "13:00"; // simulated addMinutes
  
  const actualSlotEnd = data.endTime || slotEnd;
  const [eH, eM] = dayEnd.split(":").map(Number);
  const [sH, sM] = actualSlotEnd.split(":").map(Number);
  
  if (sH * 60 + sM > eH * 60 + eM) {
    console.log(`FAIL! Exceeds school day. actualSlotEnd: ${actualSlotEnd}, dayEnd: ${dayEnd}`);
    return;
  }
  
  console.log("Validation passed! Creating slot...");
  
  try {
    const created = await prisma.timetableSlot.create({
      data: {
        day: data.day,
        slotNumber: nextSlotNumber,
        startTime: data.startTime,
        endTime: data.endTime,
        duration: data.duration,
        classId: data.classId,
        schoolId: 'bringbringa138gmailcom-1',
        subjectId: data.subjectId,
        teacherId: data.teacherId,
        roomId: data.roomId,
        groupId: nextGroupId,
        isDraft: false,
        examPeriod: false
      }
    });
    console.log("Successfully created!", created);
    
    // Cleanup so we don't mess up their DB
    await prisma.timetableSlot.delete({ where: { id: created.id } });
    console.log("Cleaned up successfully.");
  } catch (err) {
    console.error("Prisma error:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
