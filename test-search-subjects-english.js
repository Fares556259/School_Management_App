const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  subjects.forEach(s => {
    if (s.name.includes("History") || s.name.includes("Geography") || s.name.includes("Civic")) {
      console.log(s.name);
    }
  });
}
run().then(() => process.exit(0));
