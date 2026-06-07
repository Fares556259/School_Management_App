const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const teacher = await prisma.teacher.findFirst({ where: { username: 'fares.tuf705' } });
  const cls = await prisma.class.findFirst({ where: { name: '4C' } });
  
  if (!cls) { console.log('Class 4C not found'); return; }
  
  const slots = await prisma.timetableSlot.findMany({
    where: { classId: cls.id, isDraft: false },
    include: { subject: true, teacher: true }
  });
  console.log('Teacher:', teacher?.id, teacher?.name, teacher?.surname);
  console.log('Class:', cls.id, cls.name);
  console.log(JSON.stringify(slots.map(s => ({ id: s.id, subject: s.subject?.name, teacher: s.teacher?.id, teacherName: s.teacher?.name })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
