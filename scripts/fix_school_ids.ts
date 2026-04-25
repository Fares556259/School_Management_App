
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const targetSchool = 'rayens-school';
  const targetClass = 93;

  console.log(`Fixing slots for Class ${targetClass} to use School: ${targetSchool}...`);

  const updatedSlots = await prisma.timetableSlot.updateMany({
    where: {
      classId: targetClass,
    },
    data: {
      schoolId: targetSchool
    }
  });

  console.log(`Updated ${updatedSlots.count} slots.`);

  const updatedLessons = await prisma.lesson.updateMany({
    where: {
      classId: targetClass,
    },
    data: {
      schoolId: targetSchool
    }
  });
  console.log(`Updated ${updatedLessons.count} lessons.`);

  const updatedAttendance = await prisma.attendance.updateMany({
    where: {
      student: { classId: targetClass }
    },
    data: {
      schoolId: targetSchool
    }
  });
  console.log(`Updated ${updatedAttendance.count} attendance records.`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
