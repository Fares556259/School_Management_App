const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom-1' } });
  console.log('Subjects for school:', subjects.length);
  
  const lessons = await prisma.lesson.findMany({ where: { classId: { in: [111, 112] } } });
  console.log('Lessons for classes 111, 112:', lessons.length);
}
main();
