const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const classes = await prisma.class.findMany({ where: { schoolId: 'bringbringa138gmailcom' } });
  console.log("Total classes:", classes.length);
  classes.forEach(c => console.log(c.name));
}
run().then(() => process.exit(0));
