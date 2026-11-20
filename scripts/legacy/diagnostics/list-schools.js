const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  console.log(schools);
}
run().then(() => process.exit(0));
