const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({
    select: { name: true, domain: true }
  });
  console.log(JSON.stringify(subjects, null, 2));
}
run();
