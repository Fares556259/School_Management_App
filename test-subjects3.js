const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({
    select: { name: true, domain: true }
  });
  const names = Array.from(new Set(subjects.map(s => s.name)));
  console.log("All subjects:", names);
  console.log("Matches for 'exp':", names.filter(n => n.toLowerCase().includes('exp')));
  console.log("Matches for 'قواعد':", names.filter(n => n.includes('قواعد')));
}
run();
