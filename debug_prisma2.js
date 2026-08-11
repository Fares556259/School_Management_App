const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const students = await prisma.student.findMany({ where: { name: { contains: 'fares', mode: 'insensitive' } } });
  
  for (const student of students) {
    console.log('Student:', student.id, student.name, student.surname, student.classId);
    
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
    
    console.log(`--- Lessons for Class ${student.classId} ---`);
    todayLessons.forEach(l => console.log(`ID: ${l.id}, Name: ${l.name}, Subject: ${l.subject?.name}, Date: ${l.day}`));
    
    console.log(`--- Slots for Class ${student.classId} ---`);
    slots.forEach(s => console.log(`ID: ${s.id}, ExpectedName: ${s.subject?.name || "Session"} - ${s.startTime}, Day: ${s.day}`));
    
    console.log(`--- Attendance for Student ${student.id} ---`);
    attendance.forEach(a => console.log(`ID: ${a.id}, Status: ${a.status}, LessonID: ${a.lessonId}, LessonName: ${a.lesson?.name}`));
    console.log('\n=================================\n');
  }
}

test().finally(() => prisma.$disconnect());
