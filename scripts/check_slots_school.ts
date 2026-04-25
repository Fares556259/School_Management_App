
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: {
      classId: 93,
      day: 'MONDAY',
    }
  });

  console.log(`Slots for Class 93 on Monday:`);
  for (const s of slots) {
    console.log(`ID: ${s.id}, Slot: ${s.slotNumber}, SchoolID: ${s.schoolId}, SubjectID: ${s.subjectId}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
