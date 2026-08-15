const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const classes = await prisma.class.findMany({
    where: { schoolId: 'bringbringa138gmailcom-1' },
    select: { id: true, name: true }
  });
  console.log(classes.map(c => c.name).sort());
}
run().then(() => process.exit(0));
