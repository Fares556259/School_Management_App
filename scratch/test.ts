import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const attendance = await prisma.attendance.findMany({
    orderBy: { id: 'desc' },
    take: 5,
    include: { lesson: true }
  });
  console.log(JSON.stringify(attendance, null, 2));

  const lessons = await prisma.lesson.findMany({
    orderBy: { id: 'desc' },
    take: 5,
  });
  console.log("Lessons:");
  console.log(JSON.stringify(lessons, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
