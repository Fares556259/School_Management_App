import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.payment.findMany({
    where: { userType: "STAFF" }
  });
  console.log(p);
}

main().finally(() => prisma.$disconnect());
