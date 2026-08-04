const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({ include: { Admin: true } });
  console.log("Schools:", schools.map(s => s.id));
}

main().catch(console.error).finally(() => prisma.$disconnect());
