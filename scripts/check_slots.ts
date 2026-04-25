
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slots = await prisma.timetableSlot.findMany({
    where: {
      teacherId: 'teacher1',
      day: 'MONDAY',
    },
    include: {
      class: true
    }
  });

  console.log(`Slots found for teacher1 on MONDAY: ${slots.length}`);
  slots.forEach(s => {
    console.log(`Class: ${s.class.name} (ID: ${s.classId}), Slot: ${s.slotNumber}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
