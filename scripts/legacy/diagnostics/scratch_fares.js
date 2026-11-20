const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const student = await prisma.student.findFirst({ where: { name: { contains: 'fares', mode: 'insensitive' } } });
  if (!student) { console.log('Student not found'); return; }
  console.log('Student:', student.id, student.name, student.surname);
  
  const attendance = await prisma.attendance.findMany({
    where: { studentId: student.id },
    orderBy: { id: 'desc' },
    take: 5,
    include: { lesson: true }
  });
  console.log(JSON.stringify(attendance, null, 2));
}
check().finally(() => prisma.$disconnect());
