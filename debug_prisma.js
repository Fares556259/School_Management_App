const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const student = await prisma.student.findFirst({ where: { name: { contains: 'fares', mode: 'insensitive' } } });
  if (!student) { console.log('Student not found'); return; }
  
  const todayLessons = await prisma.lesson.findMany({
    where: { classId: student.classId },
    include: { subject: true, teacher: true }
  });
  
  const slots = await prisma.timetableSlot.findMany({
    where: { classId: student.classId },
    include: { subject: true, teacher: true }
  });
  
  const attendance = await prisma.attendance.findMany({
    where: { studentId: student.id },
    include: { lesson: true }
  });
  
  console.log('--- Lessons ---');
  todayLessons.forEach(l => console.log(`ID: ${l.id}, Name: ${l.name}, Subject: ${l.subject?.name}`));
  
  console.log('--- Slots ---');
  slots.forEach(s => console.log(`ID: ${s.id}, ExpectedName: ${s.subject?.name || "Session"} - ${s.startTime}`));
  
  console.log('--- Attendance ---');
  attendance.forEach(a => console.log(`ID: ${a.id}, Status: ${a.status}, LessonID: ${a.lessonId}, LessonName: ${a.lesson?.name}`));
}

test().finally(() => prisma.$disconnect());
