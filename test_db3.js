const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: { classId: 105 },
    include: { subject: true, teacher: true }
  });
  console.log(JSON.stringify(lessons.map(s => ({ subject: s.subject?.name, teacherName: s.teacher?.name })), null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
