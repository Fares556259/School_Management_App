const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const config = await prisma.schoolConfig.findFirst({ where: { id: 1 } });
  console.log(JSON.stringify(config, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
