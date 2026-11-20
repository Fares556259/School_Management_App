import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all classes to normalize schoolIds...');
  const classes = await prisma.class.findMany({
    select: { id: true, schoolId: true }
  });

  let totalUpdated = 0;

  for (const c of classes) {
    const { count } = await prisma.timetableSlot.updateMany({
      where: {
        classId: c.id,
        schoolId: { not: c.schoolId }
      },
      data: {
        schoolId: c.schoolId
      }
    });
    
    if (count > 0) {
      console.log(`Updated ${count} slots for class ${c.id} to schoolId ${c.schoolId}`);
      totalUpdated += count;
    }
  }

  console.log(`Finished normalizing. Total slots updated: ${totalUpdated}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
