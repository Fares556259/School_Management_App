const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  subjects.forEach(s => {
    if (s.name.includes("التاريخ") || s.name.includes("الجغرافيا") || s.name.includes("المدنية") || s.name.includes("تاريخ") || s.name.includes("جغرافيا") || s.name.includes("مدنية")) {
      console.log(s.name);
    }
  });
}
run().then(() => process.exit(0));
