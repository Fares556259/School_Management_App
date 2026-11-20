const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const student = await prisma.student.findFirst({ where: { name: { contains: 'fares faress', mode: 'insensitive' } } });
  
  const attendance = await prisma.attendance.findMany({
    where: { studentId: student.id, lessonId: 423 }
  });
  
  console.log(`--- Attendance for Student ${student.id} Lesson 423 ---`);
  attendance.forEach(a => console.log(`ID: ${a.id}, Status: ${a.status}, Date: ${a.date.toISOString()}, CreatedAt: ${a.createdAt.toISOString()}`));
}

test().finally(() => prisma.$disconnect());
