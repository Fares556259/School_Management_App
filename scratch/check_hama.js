
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.admin.findFirst({
    where: { email: 'fares.selmi@essai.ucar.tn' }
  });
  console.log('Admin in DB:', admin);

  if (admin && admin.schoolId) {
    const school = await prisma.school.findUnique({
      where: { id: admin.schoolId }
    });
    console.log('School in DB:', school);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
