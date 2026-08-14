const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const student = await prisma.student.findUnique({
    where: { id: '04f52df5-1f10-49b2-b331-c6474cdf0c75' }
  });
  console.log("Student:", student);
}
run().catch(console.error).finally(() => prisma.$disconnect());
