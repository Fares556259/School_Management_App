const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const subjects = await prisma.subject.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  subjects.forEach(s => console.log(s.name));
}
run().then(() => process.exit(0));
