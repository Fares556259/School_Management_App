const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const students = await prisma.student.findMany({ select: { id: true, name: true, surname: true } });
  console.log(students);
}
run().catch(console.error).finally(() => prisma.$disconnect());
