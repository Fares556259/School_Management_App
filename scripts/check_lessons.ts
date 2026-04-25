
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const lessons = await prisma.lesson.findMany({
    where: {
      classId: 93,
      day: 'MONDAY',
    }
  });

  console.log(`Lessons found: ${lessons.length}`);
  for (const l of lessons) {
    console.log(`ID: ${l.id}, SubjectID: ${l.subjectId}, TeacherID: ${l.teacherId}`);
  }

  const slots = await prisma.timetableSlot.findMany({
    where: {
      classId: 93,
      day: 'MONDAY',
    }
  });

  console.log(`Slots found: ${slots.length}`);
  for (const s of slots) {
    console.log(`ID: ${s.id}, SubjectID: ${s.subjectId}, Slot: ${s.slotNumber}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
