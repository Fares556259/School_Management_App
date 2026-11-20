const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const student = await prisma.student.findFirst({
    where: { id: { endsWith: '04f52df5' } },
  });
  if (!student) {
    console.log("Student not found.");
    return;
  }
  console.log("Student ID:", student.id);
  const payments = await prisma.payment.findMany({
    where: { studentId: student.id }
  });
  console.log("Payments:", payments);
}

run().catch(console.error).finally(() => prisma.$disconnect());
