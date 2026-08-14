const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const studentId = '04f52df5-1f10-49b2-b331-c6474cdf0c75';
  const payments = await prisma.payment.findMany({
    where: { studentId }
  });
  console.log("Payments for student:", payments);
}

run().catch(console.error).finally(() => prisma.$disconnect());
