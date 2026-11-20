const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany();
  console.log("Admins:", admins.map(a => ({ id: a.id, schoolId: a.schoolId })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
