const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://postgres.hvkqjfihjvnqvdmotdzo:p-%21P%40T.iq%407G%23%2BQ@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify&connection_limit=1&pool_timeout=60&connect_timeout=60"
    }
  }
});

async function simulateServerAction(data) {
  const existingSlots = await prisma.timetableSlot.findMany({
    where: { classId: data.classId, day: data.day, isDraft: false },
    orderBy: { slotNumber: "asc" }
  });
  
  const nextSlotNumber = data.slotNumber !== undefined ? Number(data.slotNumber) : (existingSlots.length + 1);
  const existingGroupSlots = existingSlots.filter(s => s.slotNumber === nextSlotNumber);
  const nextGroupId = existingGroupSlots.length > 0 ? Math.max(...existingGroupSlots.map(s => s.groupId || 1)) + 1 : 1;
  
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
      groupId: nextGroupId,
      isDraft: false
    }
  });
  
  return created;
}

async function main() {
  await prisma.timetableSlot.deleteMany({
    where: { classId: 116, day: 'MONDAY', slotNumber: 2 }
  });

  const sessions = [
    { id: -1, subjectId: 99 },
    { id: -1, subjectId: 103 }
  ];
  
  // PARALLEL EXECUTION
  try {
    const results = await Promise.all(sessions.map(sess => simulateServerAction({
      id: sess.id,
      classId: 116,
      day: 'MONDAY',
      slotNumber: 2,
      startTime: '10:00',
      endTime: '12:00',
      duration: 120,
      subjectId: sess.subjectId
    })));
    console.log(`Created:`, results.map(r => r.id));
  } catch (e) {
    console.error(`FAILED!`, e.message);
  }
  
  await prisma.timetableSlot.deleteMany({
    where: { classId: 116, day: 'MONDAY', slotNumber: 2 }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
