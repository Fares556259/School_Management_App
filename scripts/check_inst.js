const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const inst = await prisma.institution.findMany();
  console.log("Institutions:", inst);
}

main().catch(console.error).finally(() => prisma.$disconnect());
