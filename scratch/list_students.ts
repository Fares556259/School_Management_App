import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const students = await prisma.student.findMany({ 
    where: { classId: 93 },
    select: { id: true, name: true, surname: true }
  });
  console.log('Students in class 93:', JSON.stringify(students, null, 2));
}
run().finally(() => prisma.$disconnect());
