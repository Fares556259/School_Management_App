const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, parentId: true } });
  console.log(subjects);
}
run().then(() => process.exit(0));
