const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const student = await prisma.student.findFirst({ where: { name: { contains: 'fares faress', mode: 'insensitive' } } });
  
  if (!student) { console.log('Student not found'); return; }
  
  const attendance = await prisma.attendance.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  
  console.log(`--- Recent Attendance for Student ${student.id} (${student.name} ${student.surname}) ---`);
  attendance.forEach(a => console.log(`ID: ${a.id}, Status: ${a.status}, LessonID: ${a.lessonId}, Date: ${a.date.toISOString()}, SchoolID: ${a.schoolId}, CreatedAt: ${a.createdAt.toISOString()}`));
}

test().finally(() => prisma.$disconnect());
