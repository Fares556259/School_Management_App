const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const teacher = await prisma.teacher.findFirst({
    where: { name: { contains: 'Fares' } },
    include: { classes: true, school: true }
  });
  console.log(JSON.stringify(teacher, null, 2));
}
run().then(() => process.exit(0));
