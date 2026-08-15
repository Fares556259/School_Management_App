const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const schoolId = 'bringbringa138gmailcom';
  const subjects = await prisma.subject.findMany({
    where: { schoolId }
  });
  console.log("Subjects for bringbringa138gmailcom:");
  subjects.forEach(s => console.log(s.name));
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
