const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const incomes = await prisma.income.findMany({
    where: { category: { equals: "KARMOUS", mode: "insensitive" } }
  });
  console.log(incomes);
}
main().catch(console.error).finally(() => prisma.$disconnect());
