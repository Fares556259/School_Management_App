const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const classes = await prisma.class.findMany();
  const schoolGroups = {};
  classes.forEach(c => {
    if (!schoolGroups[c.schoolId]) schoolGroups[c.schoolId] = [];
    schoolGroups[c.schoolId].push(c.name);
  });
  console.log(schoolGroups);
}
run().then(() => process.exit(0));
