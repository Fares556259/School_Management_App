require('dotenv').config({ path: '.env' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pendingAdmins = await prisma.admin.findMany({ where: { status: 'pending' } });
  console.log("Pending admins:", pendingAdmins);
}
main().catch(console.error).finally(() => prisma.$disconnect());
