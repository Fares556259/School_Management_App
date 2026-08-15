const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({
    select: { name: true, domain: true }
  });
  const names = new Set(subjects.map(s => s.name));
  console.log(Array.from(names));
}
run();
