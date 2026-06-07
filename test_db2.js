const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: { classId: 105 },
    include: { subject: true, teacher: true }
  });
  console.log(JSON.stringify(slots.map(s => ({ subject: s.subject?.name, teacherName: s.teacher?.name, isDraft: s.isDraft })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
