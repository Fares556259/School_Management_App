const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const teacher = await prisma.teacher.findFirst({
    where: { name: { contains: 'Fares' } },
    include: { timetable: { include: { class: true } } }
  });
  console.log(JSON.stringify(teacher.timetable, null, 2));
}
run().then(() => process.exit(0));
