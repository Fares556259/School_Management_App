import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const atts = await prisma.attendance.findMany({ 
    where: { 
      studentId: 'student1', 
      date: { 
        gte: new Date('2026-04-26T00:00:00Z'), 
        lt: new Date('2026-04-27T00:00:00Z') 
      } 
    },
    select: { id: true, status: true, score: true, lessonId: true, date: true }
  });
  console.log('Attendance records for student1 today:', JSON.stringify(atts, null, 2));
}
run().finally(() => prisma.$disconnect());
