const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  subjects.forEach(s => {
    if (s.name.toLowerCase().includes("anglais") || s.name.toLowerCase().includes("english") || s.name.toLowerCase().includes("انقليزية") || s.name.toLowerCase().includes("انجليزية")) {
      console.log(s.name);
    }
  });
}
run().then(() => process.exit(0));
