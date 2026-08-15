const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany();
  subjects.forEach(s => {
    if (s.name.includes("التاريخ") || s.name.includes("تاريخ") || s.name.includes("جغرافيا") || s.name.includes("مدنية") || s.name.includes("تنشئة")) {
      console.log(`School: ${s.schoolId}, Subject: ${s.name}`);
    }
  });
}
run().then(() => process.exit(0));
