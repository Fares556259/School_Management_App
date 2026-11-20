const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const reqs = await prisma.setupRequest.findMany();
  console.log("SetupRequests:", reqs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
