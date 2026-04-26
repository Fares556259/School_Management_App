import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const teacher = await prisma.teacher.findUnique({ where: { id: 'teacher1' } });
  console.log('Teacher:', teacher);
  const students = await prisma.student.findMany({ where: { classId: 93 } });
  console.log('Students count:', students.length);
}
run().finally(() => prisma.$disconnect());
